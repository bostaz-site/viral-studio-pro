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
 * @returns {number} Silence threshold in seconds
 */
export function getAdaptiveThreshold({ mood, intensity } = {}) {
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

  return Math.round(threshold * 100) / 100;
}

/**
 * Compute speech segments from word timestamps by merging consecutive words
 * and detecting silence gaps.
 *
 * @param {Array<{word: string, start: number, end: number}>} wordTimestamps
 * @param {number} duration - Total clip duration in seconds
 * @param {object} options
 * @param {number} options.silenceThreshold - Minimum gap (seconds) to cut (default 0.7)
 * @param {number} options.padding - Extra padding before/after each segment (default 0.08)
 * @returns {{ segments: Array<{start: number, end: number}>, cutDuration: number, originalDuration: number }}
 */
export function computeSpeechSegments(wordTimestamps, duration, options = {}) {
  const {
    silenceThreshold = 0.7,
    padding = 0.08,
  } = options;

  if (!wordTimestamps || wordTimestamps.length < 2) {
    return { segments: [], cutDuration: duration, originalDuration: duration };
  }

  const segments = [];
  let segStart = Math.max(0, wordTimestamps[0].start - padding);

  for (let i = 0; i < wordTimestamps.length - 1; i++) {
    const currentEnd = wordTimestamps[i].end;
    const nextStart = wordTimestamps[i + 1].start;
    const gap = nextStart - currentEnd;

    if (gap >= silenceThreshold) {
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
 * @param {function} options.trc - Trace logging function
 * @returns {Promise<{outputPath: string, cutDuration: number, segments: Array, wordTimestamps: Array}>}
 */
export async function applyAutoCut(inputPath, tempDir, wordTimestamps, duration, options = {}) {
  const {
    silenceThreshold = 0.7,
    clipStartTime = 0,
    trc = console.log,
  } = options;

  const { segments, cutDuration, originalDuration } = computeSpeechSegments(
    wordTimestamps, duration, { silenceThreshold }
  );

  // If no meaningful cuts (< 0.5s saved or < 2 segments), skip
  if (segments.length < 2 || (originalDuration - cutDuration) < 0.5) {
    trc(`AUTO-CUT: skipped — only ${segments.length} segments, saves ${(originalDuration - cutDuration).toFixed(1)}s`);
    return null;
  }

  // SAFETY: if the result is too short (< 3s or < 25% of original), auto-cut is
  // being too aggressive — likely a clip with sparse dialogue (action, music, etc.).
  // Skip entirely to avoid producing a 0.5s clip from a 24s original.
  const MIN_CUT_DURATION = 3;
  const MIN_CUT_RATIO = 0.25;
  if (cutDuration < MIN_CUT_DURATION || (cutDuration / originalDuration) < MIN_CUT_RATIO) {
    trc(`AUTO-CUT: ABORTED — result too short (${cutDuration.toFixed(1)}s = ${((cutDuration / originalDuration) * 100).toFixed(0)}% of ${originalDuration.toFixed(1)}s). Clip likely has sparse dialogue.`);
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

  // Remap word timestamps to new timeline (remove gaps)
  const remappedWords = [];
  let newOffset = 0;
  for (const seg of segments) {
    for (const w of wordTimestamps) {
      // Word relative to clip (not file)
      const wStart = w.start - clipStartTime;
      if (wStart >= seg.start && wStart < seg.end) {
        remappedWords.push({
          ...w,
          start: Math.round((newOffset + (wStart - seg.start)) * 100) / 100,
          end: Math.round((newOffset + (w.end - clipStartTime - seg.start)) * 100) / 100,
        });
      }
    }
    newOffset += (seg.end - seg.start);
  }

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
