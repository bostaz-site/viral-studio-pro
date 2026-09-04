/**
 * Auto-Cut Silences — removes dead air from clips using word timestamps.
 *
 * Uses Whisper word timestamps to detect gaps (silences) between words.
 * Gaps longer than the threshold are cut out, and the remaining speech
 * segments are concatenated into a tighter, punchier clip.
 *
 * Approach: extract each speech segment as .ts file, then concat protocol.
 * Same reliable method as the hook reorder.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { detectPeakMoment } from './hook-generator.js';

const execFileAsync = promisify(execFile);

/**
 * Classify audio intensity level from peak analysis.
 *
 * @param {number[]} peaks - Array of peak timestamps
 * @param {number} duration - Total clip duration in seconds
 * @returns {'high' | 'medium' | 'low'}
 */
export function classifyIntensity(peaks, duration) {
  if (!peaks || peaks.length === 0 || duration <= 0) return 'medium';
  const peakDensity = peaks.length / duration;
  if (peakDensity >= 0.5) return 'high';
  if (peakDensity >= 0.2) return 'medium';
  return 'low';
}

/**
 * Get adaptive silence threshold based on mood and/or audio intensity.
 *
 * @param {object} options
 * @param {string} [options.mood] - Detected mood (rage, funny, drama, wholesome, hype, story)
 * @param {string} [options.intensity] - Audio intensity ('high', 'medium', 'low')
 * @param {number|null} [options.density] - P5 analysis density (0-10). < 5 → one notch more aggressive (-0.1, floor 0.3)
 * @returns {number} Silence threshold in seconds
 */
export function getAdaptiveThreshold({ mood, intensity, density } = {}) {
  const moodThresholds = {
    rage: 0.35,
    hype: 0.40,
    funny: 0.45,
    drama: 0.55,
    wholesome: 0.60,
    story: 0.70,
  };

  let threshold = moodThresholds[mood] || 0.55;

  if (intensity === 'high') threshold = Math.max(0.3, threshold - 0.1);
  if (intensity === 'low') threshold = Math.min(0.8, threshold + 0.1);

  // P5 · low density (dead air flagged by the 4-criteria analysis) → cut harder, same bounds
  if (typeof density === 'number' && Number.isFinite(density) && density < 5) {
    threshold = Math.max(0.3, threshold - 0.1);
  }

  return Math.round(threshold * 100) / 100;
}

/**
 * P5 · Minimum word gap that an analysis dead_air_segment can turn into a cut.
 * Below this, cutting would clip syllables — even if the AI flagged the area.
 */
export const DEAD_AIR_MIN_GAP = 0.3;

/**
 * P5 · Does a word gap [gapStart, gapEnd] overlap one of the analysis dead-air segments?
 * Requires >= 50% of the gap to sit inside a segment (avoids edge grazes).
 *
 * @param {number} gapStart
 * @param {number} gapEnd
 * @param {Array<{start:number,end:number}>} deadAirSegments
 * @returns {boolean}
 */
export function gapOverlapsDeadAir(gapStart, gapEnd, deadAirSegments) {
  if (!Array.isArray(deadAirSegments) || deadAirSegments.length === 0) return false;
  const gapLen = gapEnd - gapStart;
  if (gapLen <= 0) return false;
  for (const seg of deadAirSegments) {
    if (!seg || !Number.isFinite(seg.start) || !Number.isFinite(seg.end) || seg.end <= seg.start) continue;
    const overlap = Math.min(gapEnd, seg.end) - Math.max(gapStart, seg.start);
    if (overlap >= gapLen * 0.5) return true;
  }
  return false;
}

/**
 * Compute speech segments from word timestamps by merging consecutive words
 * and detecting silence gaps.
 *
 * @param {Array<{word: string, start: number, end: number}>} wordTimestamps
 * @param {number} duration - Total clip duration in seconds
 * @param {object} options
 * @param {number} options.silenceThreshold - Minimum gap (seconds) to cut (default 1.2)
 * @param {number} options.padding - Extra padding before/after each segment (default 0.15)
 * @param {Array<{start:number,end:number}>} [options.deadAirSegments] - P5 analysis dead-air ranges (clip-relative seconds).
 *   A word gap shorter than silenceThreshold but >= DEAD_AIR_MIN_GAP that overlaps one of them becomes a cut candidate.
 * @returns {{ segments: Array<{start: number, end: number}>, cutDuration: number, originalDuration: number, deadAirCuts: number }}
 */
export function computeSpeechSegments(wordTimestamps, duration, options = {}) {
  const {
    silenceThreshold = 1.2,
    padding = 0.15,
    deadAirSegments = [],
  } = options;

  if (!wordTimestamps || wordTimestamps.length < 2) {
    return { segments: [], cutDuration: duration, originalDuration: duration, deadAirCuts: 0 };
  }

  const segments = [];
  let segStart = Math.max(0, wordTimestamps[0].start - padding);
  let deadAirCuts = 0;

  for (let i = 0; i < wordTimestamps.length - 1; i++) {
    const currentEnd = wordTimestamps[i].end;
    const nextStart = wordTimestamps[i + 1].start;
    const gap = nextStart - currentEnd;

    // P5 · analysis-flagged dead air: cut a sub-threshold gap only if it is still a real pause
    // (>= DEAD_AIR_MIN_GAP) and sits inside a dead_air_segment from the 4-criteria analysis.
    const isDeadAirCut = gap < silenceThreshold
      && gap >= DEAD_AIR_MIN_GAP
      && gapOverlapsDeadAir(currentEnd, nextStart, deadAirSegments);
    if (isDeadAirCut) deadAirCuts++;

    if (gap >= silenceThreshold || isDeadAirCut) {
      // End current segment with padding
      const segEnd = Math.min(duration, currentEnd + padding);
      segments.push({ start: Math.round(segStart * 100) / 100, end: Math.round(segEnd * 100) / 100 });
      // Start new segment
      segStart = Math.max(0, nextStart - padding);
    }
  }

  // Close final segment
  const lastWord = wordTimestamps[wordTimestamps.length - 1];
  const finalEnd = Math.min(duration, lastWord.end + padding);
  segments.push({ start: Math.round(segStart * 100) / 100, end: Math.round(finalEnd * 100) / 100 });

  const cutDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);

  return {
    segments,
    cutDuration: Math.round(cutDuration * 100) / 100,
    originalDuration: Math.round(duration * 100) / 100,
    deadAirCuts,
  };
}

/**
 * Apply auto-cut to a video file by extracting speech segments and concatenating.
 *
 * @param {string} inputPath - Path to input video
 * @param {string} tempDir - Temporary directory for segment files
 * @param {Array<{word: string, start: number, end: number}>} wordTimestamps
 * @param {number} duration - Original clip duration
 * @param {object} options
 * @param {number} options.silenceThreshold - Min gap to cut (default 0.7s)
 * @param {number} options.clipStartTime - Offset for user clips (default 0)
 * @param {Array<{start:number,end:number}>} [options.deadAirSegments] - P5 analysis dead-air ranges (candidate cuts)
 * @param {function} options.trc - Trace logging function
 * @returns {Promise<{outputPath: string, cutDuration: number, segments: Array, wordTimestamps: Array}>}
 */
export async function applyAutoCut(inputPath, tempDir, wordTimestamps, duration, options = {}) {
  const {
    silenceThreshold = 0.7,
    clipStartTime = 0,
    deadAirSegments = [],
    trc = console.log,
  } = options;

  const { segments, cutDuration, originalDuration, deadAirCuts } = computeSpeechSegments(
    wordTimestamps, duration, { silenceThreshold, padding: options.padding, deadAirSegments }
  );
  if (deadAirCuts > 0) {
    trc(`AUTO-CUT: ${deadAirCuts} extra cut(s) from analysis dead_air_segments (${deadAirSegments.length} ranges, gap >= ${DEAD_AIR_MIN_GAP}s)`);
  }

  // If no meaningful cuts (< 0.5s saved or < 2 segments), skip
  if (segments.length < 2 || (originalDuration - cutDuration) < 0.5) {
    trc(`AUTO-CUT: skipped — only ${segments.length} segments, saves ${(originalDuration - cutDuration).toFixed(1)}s`);
    return null;
  }

  // SAFETY: never remove more than 40% of the clip, and never produce
  // a result shorter than 3s. Both prevent over-aggressive cutting on
  // clips with sparse dialogue, music, or action with few words.
  const MIN_CUT_DURATION = 3;
  const MAX_REMOVAL_RATIO = 0.40; // never cut more than 40%
  const minAllowed = originalDuration * (1 - MAX_REMOVAL_RATIO);
  if (cutDuration < MIN_CUT_DURATION || cutDuration < minAllowed) {
    trc(`AUTO-CUT: ABORTED — result too short (${cutDuration.toFixed(1)}s = ${((cutDuration / originalDuration) * 100).toFixed(0)}% of ${originalDuration.toFixed(1)}s, min=${Math.max(MIN_CUT_DURATION, minAllowed).toFixed(1)}s).`);

    // ── Fallback: trim a 25-40s window around the peak moment ──
    // Instead of keeping the full original, use the Smart Hook peak detector
    // to find the most intense moment and trim around it.
    const PEAK_WIN_MIN = 25;
    const PEAK_WIN_MAX = 40;
    if (originalDuration > PEAK_WIN_MIN) {
      try {
        const peak = detectPeakMoment({
          wordTimestamps,
          transcript: wordTimestamps.map(w => w.word).join(' '),
          duration: originalDuration,
        });
        const peakTime = peak.peakTime > 0 ? peak.peakTime : originalDuration * 0.4;
        const winLen = Math.min(PEAK_WIN_MAX, Math.max(PEAK_WIN_MIN, originalDuration * 0.7));
        // Peak sits at 1/3 of the window (front-loaded hook)
        let winStart = Math.max(0, peakTime - winLen / 3);
        if (winStart + winLen > originalDuration) winStart = Math.max(0, originalDuration - winLen);
        const winEnd = Math.min(originalDuration, winStart + winLen);
        const actualLen = winEnd - winStart;

        trc(`AUTO-CUT FALLBACK: peak=${peakTime.toFixed(1)}s, window=${winStart.toFixed(1)}s-${winEnd.toFixed(1)}s (${actualLen.toFixed(1)}s)`);

        const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
        const fallbackPath = path.join(tempDir, 'autocut_peak.mp4');
        await execFileAsync(ffmpegPath, [
          '-y',
          '-ss', String(clipStartTime + winStart),
          '-i', inputPath,
          '-t', String(actualLen),
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
          '-c:a', 'aac', '-b:a', '128k',
          '-threads', '1',
          '-movflags', '+faststart',
          fallbackPath,
        ], { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });

        const stat = await fs.stat(fallbackPath);
        if (stat.size < 1000) throw new Error(`Peak trim output too small: ${stat.size} bytes`);

        // Remap word timestamps to the trimmed window
        const remappedWords = wordTimestamps
          .filter(w => w.start >= winStart && w.end <= winEnd)
          .map(w => ({
            ...w,
            start: Math.round((w.start - winStart) * 100) / 100,
            end: Math.round((w.end - winStart) * 100) / 100,
          }));

        trc(`AUTO-CUT FALLBACK: trimmed to peak window ${winStart.toFixed(1)}s-${winEnd.toFixed(1)}s (${remappedWords.length} words kept)`);

        return {
          outputPath: fallbackPath,
          cutDuration: Math.round(actualLen * 100) / 100,
          segments: [{ start: winStart, end: winEnd }],
          wordTimestamps: remappedWords,
        };
      } catch (peakErr) {
        trc(`AUTO-CUT FALLBACK FAILED: ${peakErr.message} — keeping original`);
      }
    }

    return null;
  }

  trc(`AUTO-CUT: ${segments.length} speech segments, ${originalDuration}s → ${cutDuration}s (cutting ${(originalDuration - cutDuration).toFixed(1)}s of silence)`);

  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  const outputPath = path.join(tempDir, 'autocut.mp4');
  const segFiles = [];

  // Extract each speech segment to a temp .ts file
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segStart = clipStartTime + seg.start;
    const segDuration = seg.end - seg.start;
    const segFile = path.join(tempDir, `cut_${i}.ts`);
    segFiles.push(segFile);

    trc(`AUTO-CUT: segment ${i}: ${segStart.toFixed(2)}s → ${(segStart + segDuration).toFixed(2)}s (${segDuration.toFixed(2)}s)`);

    await execFileAsync(ffmpegPath, [
      '-y',
      '-ss', String(segStart),
      '-i', inputPath,
      '-t', String(segDuration),
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
      '-c:a', 'aac', '-b:a', '128k',
      '-threads', '1',
      '-f', 'mpegts',
      segFile,
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
  }

  // Concat all segments
  const concatInput = `concat:${segFiles.join('|')}`;
  await execFileAsync(ffmpegPath, [
    '-y',
    '-i', concatInput,
    '-c', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });

  // Verify
  const stat = await fs.stat(outputPath);
  if (stat.size < 1000) {
    throw new Error(`Auto-cut output too small: ${stat.size} bytes`);
  }

  trc(`AUTO-CUT: done — ${outputPath} (${stat.size} bytes)`);

  // Remap word timestamps to new timeline (remove gaps).
  // Words and segments are in the SAME coordinate system (both derived from
  // the wordTimestamps array). Do NOT subtract clipStartTime — that offset
  // is only for FFmpeg seek positions, not for word-to-segment matching.
  const remappedWords = [];
  let newOffset = 0;
  for (const seg of segments) {
    for (const w of wordTimestamps) {
      if (w.start >= seg.start && w.start < seg.end) {
        remappedWords.push({
          ...w,
          start: Math.round((newOffset + (w.start - seg.start)) * 100) / 100,
          end: Math.round((newOffset + (w.end - seg.start)) * 100) / 100,
        });
      }
    }
    newOffset += (seg.end - seg.start);
  }

  trc(`AUTOCUT REMAP: ${wordTimestamps.length} words in → ${remappedWords.length} words out`);

  // Cleanup
  for (const f of segFiles) {
    fs.unlink(f).catch(() => {});
  }

  return {
    outputPath,
    cutDuration,
    segments,
    wordTimestamps: remappedWords,
  };
}
