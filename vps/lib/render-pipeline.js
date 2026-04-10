import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { generateASS, generateStaticASS, validateWordTimestamps } from './subtitle-generator.js';
import { detectFaces } from './face-tracker.js';
import { detectPeakMoment, calculateReorderTimestamps } from './hook-generator.js';
import { transcribeWithWhisper } from './whisper-client.js';
import { getTranscription } from './supabase-client.js';

const execFileAsync = promisify(execFile);

/**
 * Prepare captions (ASS file) and return word timestamps
 *
 * Handles word timestamp retrieval (from DB or Whisper), validates them,
 * and generates an ASS subtitle file with the requested animation/style.
 *
 * @param {Object} settings - Render settings object { captions: {...}, ... }
 * @param {string} inputPath - Path to input video file
 * @param {string} tempDir - Temporary directory for generated files
 * @param {Object} options - Configuration options
 * @param {number} options.clipStartTime - Clip start time in source video (seconds)
 * @param {number} options.clipEndTime - Clip end time in source video (seconds)
 * @param {number} options.duration - Final clip duration (seconds)
 * @param {string} options.clipTitle - Clip title (for fallback captions)
 * @param {string} options.videoId - Video ID (for DB lookup)
 * @param {string} options.source - Source type ('trending' | 'user')
 * @param {Array} options.providedWordTimestamps - Pre-computed word timestamps (optional)
 * @param {number} options.canvasW - Canvas width (pixels)
 * @param {number} options.canvasH - Canvas height (pixels)
 * @param {boolean} options.isSplitScreen - Whether split-screen is enabled
 * @param {Function} options.trc - Trace/logging function
 *
 * @returns {Promise<{assFilePath: string|null, captionWordTimestamps: Array}>}
 *   - assFilePath: path to generated .ass file, or null if no captions
 *   - captionWordTimestamps: array of {word, start, end} for later remapping
 */
export async function prepareCaptions(settings, inputPath, tempDir, options) {
  const {
    clipStartTime,
    clipEndTime,
    duration,
    clipTitle,
    videoId,
    source,
    providedWordTimestamps = [],
    canvasW,
    canvasH,
    isSplitScreen,
    trc,
  } = options;

  let assFilePath = null;
  let captionWordTimestamps = [];

  const captionStyleRequested = settings.captions?.style || 'hormozi';
  const captionsRequested = settings.captions?.enabled && captionStyleRequested !== 'none';

  if (!captionsRequested) {
    trc(`CAPTIONS disabled (enabled=${settings.captions?.enabled}, style=${captionStyleRequested})`);
    return { assFilePath, captionWordTimestamps };
  }

  try {
    let wordTimestamps = providedWordTimestamps || [];

    // For user clips, fetch transcription from DB
    if (source !== 'trending' && videoId && wordTimestamps.length === 0) {
      const transcription = await getTranscription(videoId);
      if (transcription?.word_timestamps) {
        wordTimestamps = (transcription.word_timestamps || []).filter(
          w => w.start >= clipStartTime && w.start < clipEndTime
        );
      }
    }

    // For trending clips, try Whisper transcription to get real word timestamps
    if (source === 'trending' && wordTimestamps.length === 0) {
      const hasWhisperKey = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
      const keySource = process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY' : (process.env.OPENAI_KEY ? 'OPENAI_KEY' : 'NONE');
      trc(`WHISPER key present=${hasWhisperKey} source=${keySource}`);

      if (hasWhisperKey) {
        try {
          trc(`WHISPER calling transcribeWithWhisper...`);
          wordTimestamps = await transcribeWithWhisper(inputPath, {
            tempDir,
            language: 'en',
            contextPrompt: clipTitle || '',
            clipDuration: duration,
          });
          trc(`WHISPER returned ${wordTimestamps.length} word timestamps`);

          if (wordTimestamps.length > 0) {
            const first = wordTimestamps[0];
            const last = wordTimestamps[wordTimestamps.length - 1];
            trc(`WHISPER first="${first.word}" start=${first.start} end=${first.end}`);
            trc(`WHISPER last="${last.word}" start=${last.start} end=${last.end}`);
            trc(`WHISPER clipDuration=${duration} clipStartTime=${clipStartTime}`);
          }
        } catch (err) {
          trc(`WHISPER ERROR: ${err.message}`);
        }
      } else {
        trc(`WHISPER SKIPPED - no key`);
      }
    }

    const captionStyle = settings.captions.style || 'hormozi';
    const captionPosition = settings.captions.position || 'bottom';
    let assContent = null;

    // Common subtitle options — canvas-aware positioning
    const subtitleOpts = {
      style: captionStyle,
      position: captionPosition,
      canvasWidth: canvasW,
      canvasHeight: canvasH,
      splitScreen: isSplitScreen ? { layout: settings.splitScreen?.layout || 'top-bottom', ratio: settings.splitScreen?.ratio || 50 } : null,
    };

    if (wordTimestamps.length > 0) {
      validateWordTimestamps(wordTimestamps);
      captionWordTimestamps = wordTimestamps;
      const captionAnim = settings.captions.animation || 'highlight';

      trc(`CAPTIONS generating ASS file for animation="${captionAnim}" style="${captionStyle}"`);
      assContent = generateASS(wordTimestamps, {
        ...subtitleOpts,
        animation: captionAnim,
        clipStartTime,
        wordsPerLine: settings.captions.wordsPerLine || 4,
        customColors: settings.captions.customColors,
        customImportantWords: settings.captions.customImportantWords || [],
        emphasisEffect: settings.captions.emphasisEffect || 'none',
        emphasisColor: settings.captions.emphasisColor || 'red',
      });
      trc(`CAPTIONS ASS generated: ${assContent ? assContent.length : 0} bytes`);
    } else {
      // No word timestamps — use static ASS from title (with animation support)
      const captionAnim = settings.captions.animation || 'highlight';
      if (clipTitle && duration > 0) {
        trc(`CAPTIONS FALLBACK: static ASS from title "${clipTitle.substring(0, 40)}" animation="${captionAnim}"`);
        assContent = generateStaticASS(clipTitle, duration, {
          ...subtitleOpts,
          animation: captionAnim,
          wordsPerLine: settings.captions.wordsPerLine || 4,
        });
      } else {
        trc(`CAPTIONS SKIPPED - no word timestamps and no title for fallback`);
      }
    }

    if (assContent) {
      assFilePath = path.join(tempDir, 'captions.ass');
      await fs.writeFile(assFilePath, assContent, 'utf-8');
      trc(`CAPTIONS wrote ASS ${canvasW}x${canvasH} pos=${captionPosition} split=${isSplitScreen} size=${assContent.length} bytes`);
      const assLines = assContent.split('\n');
      trc(`CAPTIONS ASS header lines (first 5): ${assLines.slice(0, 5).join(' | ')}`);
      const dialogueLines = assLines.filter(l => l.startsWith('Dialogue:'));
      trc(`CAPTIONS ASS dialogue events: ${dialogueLines.length} events (first: ${dialogueLines[0]?.substring(0, 100) || 'none'})`);
    }
  } catch (err) {
    trc(`CAPTIONS ERROR: ${err.message}`);
  }

  return { assFilePath, captionWordTimestamps };
}

/**
 * Detect faces in video for smart zoom follow mode
 *
 * Runs face detection to generate keyframes for smooth face-following zoom.
 * Returns null if detection fails or no faces are found.
 *
 * @param {Object} settings - Render settings object { smartZoom: {...}, ... }
 * @param {string} inputPath - Path to input video file
 * @param {string} tempDir - Temporary directory for processing files
 * @param {Object} options - Configuration options
 * @param {number} options.duration - Video duration (seconds)
 * @param {Function} options.trc - Trace/logging function
 *
 * @returns {Promise<Array|null>}
 *   - Array of keyframes: [{time, x, y, width, height}, ...] if detection succeeds
 *   - null if detection disabled, fails, or no faces found
 */
export async function prepareFaceKeyframes(settings, inputPath, tempDir, options) {
  const { duration, trc } = options;

  if (!settings.smartZoom?.enabled || settings.smartZoom?.mode !== 'follow') {
    return null;
  }

  let faceKeyframes = null;
  try {
    trc('FACE DETECTION starting...');
    const faceResult = await detectFaces(inputPath, {
      canvasW: 720,
      canvasH: 1280,
      everyN: 8,
      timeoutMs: 25000,
    });

    if (faceResult.smoothed && faceResult.smoothed.length >= 2 && faceResult.detected_count > 0) {
      faceKeyframes = faceResult.smoothed;
      trc(`FACE DETECTION done: ${faceResult.detected_count} detections → ${faceKeyframes.length} smoothed keyframes`);
    } else {
      trc(`FACE DETECTION: no faces found or too few keyframes (${faceResult.detected_count || 0} detections), falling back to micro zoom`);
    }
  } catch (faceErr) {
    trc(`FACE DETECTION error: ${faceErr.message}, falling back to micro zoom`);
  }

  return faceKeyframes;
}

/**
 * Prepare hook reorder: trim, reorder segments, and remap subtitles
 *
 * If reorder is enabled, extracts video segments in order (hook → context → payoff),
 * concatenates them, and remaps subtitle timestamps to match the new timeline.
 *
 * @param {Object} settings - Render settings object { hook: {...}, captions: {...}, ... }
 * @param {string} inputPath - Path to input video file
 * @param {string} tempDir - Temporary directory for temp segment files
 * @param {Object} options - Configuration options
 * @param {number} options.clipStartTime - Clip start time in source video (seconds)
 * @param {number} options.duration - Original clip duration (seconds)
 * @param {Array} options.captionWordTimestamps - Word timestamps from captions (for remapping)
 * @param {string} options.assFilePath - Path to ASS caption file (will be rewritten if reorder happens)
 * @param {number} options.canvasW - Canvas width (pixels)
 * @param {number} options.canvasH - Canvas height (pixels)
 * @param {boolean} options.isSplitScreen - Whether split-screen is enabled
 * @param {Function} options.trc - Trace/logging function
 *
 * @returns {Promise<{reorderedInputPath: string, reorderedStartTime: number, reorderedDuration: number}>}
 *   - reorderedInputPath: path to reordered MP4 (or original inputPath if no reorder)
 *   - reorderedStartTime: start time offset for reordered video (always 0 if reordered)
 *   - reorderedDuration: total duration of reordered video
 */
export async function prepareHookReorder(settings, inputPath, tempDir, options) {
  const {
    clipStartTime,
    duration,
    captionWordTimestamps = [],
    assFilePath,
    canvasW,
    canvasH,
    isSplitScreen,
    trc,
  } = options;

  let reorderedInputPath = inputPath;
  let reorderedStartTime = clipStartTime;
  let reorderedDuration = duration;

  // If reorder is requested but no segments provided, calculate them on the fly
  if (settings.hook?.reorderEnabled && (!settings.hook?.reorder || !settings.hook?.reorder?.segments?.length)) {
    trc(`HOOK REORDER: no segments provided, calculating from duration=${duration}s`);
    const fallbackPeak = detectPeakMoment({ transcript: '', duration, wordTimestamps: [], audioPeaks: [] });
    const peakT = fallbackPeak.peakTime > 0 ? fallbackPeak.peakTime : Math.min(duration * 0.6, duration - 2);
    const hookLen = settings.hook?.length || 1.5;
    settings.hook.reorder = calculateReorderTimestamps(peakT, duration, hookLen, 8);
    trc(`HOOK REORDER fallback: peak=${peakT}s, ${settings.hook.reorder.segments.length} segments`);
  }

  trc(`HOOK REORDER check: enabled=${settings.hook?.enabled} reorderEnabled=${settings.hook?.reorderEnabled} hasReorder=${!!settings.hook?.reorder} segments=${settings.hook?.reorder?.segments?.length || 0}`);

  if (settings.hook?.reorderEnabled && settings.hook?.reorder?.segments?.length >= 2) {
    try {
      const segments = settings.hook.reorder.segments;
      trc(`HOOK REORDER: ${segments.length} segments — ${segments.map(s => `${s.label}(${s.start}-${s.end}s)`).join(' → ')}`);

      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      const reorderOutputPath = path.join(tempDir, 'reordered.mp4');

      // Extract each segment to a temp file, then concat
      const segmentFiles = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segStart = clipStartTime + seg.start;
        const segDuration = seg.end - seg.start;
        const segFile = path.join(tempDir, `seg_${i}.ts`);
        segmentFiles.push(segFile);

        trc(`HOOK REORDER: extracting segment ${i} (${seg.label}): ${segStart}s → ${segStart + segDuration}s (${segDuration}s)`);

        const segArgs = [
          '-y',
          '-ss', String(segStart),
          '-i', inputPath,
          '-t', String(segDuration),
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
          '-c:a', 'aac', '-b:a', '128k',
          '-threads', '1',
          '-f', 'mpegts',
          segFile,
        ];

        await execFileAsync(ffmpegPath, segArgs, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
        trc(`HOOK REORDER: segment ${i} extracted OK`);
      }

      // Concat all segments using concat protocol
      const concatInput = `concat:${segmentFiles.join('|')}`;
      const concatArgs = [
        '-y',
        '-i', concatInput,
        '-c', 'copy',
        '-movflags', '+faststart',
        reorderOutputPath,
      ];

      await execFileAsync(ffmpegPath, concatArgs, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });

      // Verify output exists and has size
      const reorderStat = await fs.stat(reorderOutputPath);
      trc(`HOOK REORDER: output file size = ${reorderStat.size} bytes`);

      if (reorderStat.size < 1000) {
        throw new Error(`Reordered file too small: ${reorderStat.size} bytes`);
      }

      reorderedInputPath = reorderOutputPath;
      reorderedStartTime = 0;
      reorderedDuration = settings.hook.reorder.totalDuration;
      trc(`HOOK REORDER done: ${reorderedDuration}s reordered clip at ${reorderOutputPath}`);

      // ── Remap subtitles to match new segment order ──
      if (assFilePath && captionWordTimestamps.length > 0) {
        try {
          // Build offset map: each segment's new start in the reordered video
          let newOffset = 0;
          const segmentMap = segments.map(seg => {
            const entry = { origStart: seg.start, origEnd: seg.end, newStart: newOffset };
            newOffset += (seg.end - seg.start);
            return entry;
          });
          trc(`REORDER SUBS: remapping ${captionWordTimestamps.length} words across ${segmentMap.length} segments`);

          // Remap each word timestamp
          const remappedWords = [];
          for (const w of captionWordTimestamps) {
            // Word time relative to clip start
            const wStart = w.start - clipStartTime;
            const wEnd = w.end - clipStartTime;

            // Find which segment this word belongs to
            let mapped = false;
            for (const seg of segmentMap) {
              if (wStart >= seg.origStart && wStart < seg.origEnd) {
                const offset = wStart - seg.origStart;
                const endOffset = Math.min(wEnd - seg.origStart, seg.origEnd - seg.origStart);
                remappedWords.push({
                  ...w,
                  start: Math.round((seg.newStart + offset) * 100) / 100,
                  end: Math.round((seg.newStart + endOffset) * 100) / 100,
                });
                mapped = true;
                break;
              }
            }
            if (!mapped) {
              trc(`REORDER SUBS: word "${w.word}" at ${wStart}s doesn't fit any segment, skipping`);
            }
          }

          // Sort by new start time
          remappedWords.sort((a, b) => a.start - b.start);
          trc(`REORDER SUBS: ${remappedWords.length}/${captionWordTimestamps.length} words remapped`);

          // Regenerate ASS with remapped timestamps
          const captionStyle = settings.captions?.style || 'hormozi';
          const captionPosition = settings.captions?.position || 'bottom';
          const captionAnim = settings.captions?.animation || 'highlight';
          const remappedASS = generateASS(remappedWords, {
            style: captionStyle,
            position: captionPosition,
            canvasWidth: canvasW,
            canvasHeight: canvasH,
            splitScreen: isSplitScreen ? { layout: settings.splitScreen?.layout || 'top-bottom', ratio: settings.splitScreen?.ratio || 50 } : null,
            animation: captionAnim,
            clipStartTime: 0,
            wordsPerLine: settings.captions?.wordsPerLine || 4,
            customColors: settings.captions?.customColors,
            customImportantWords: settings.captions?.customImportantWords || [],
            emphasisEffect: settings.captions?.emphasisEffect || 'none',
            emphasisColor: settings.captions?.emphasisColor || 'red',
          });

          if (remappedASS) {
            await fs.writeFile(assFilePath, remappedASS, 'utf-8');
            trc(`REORDER SUBS: rewrote ASS file with remapped timestamps (${remappedASS.length} bytes)`);
          }
        } catch (subErr) {
          trc(`REORDER SUBS error: ${subErr.message} — using original subtitle timing`);
        }
      }

      // Cleanup segment temp files
      for (const f of segmentFiles) {
        fs.unlink(f).catch(() => {});
      }
    } catch (reorderErr) {
      trc(`HOOK REORDER FAILED: ${reorderErr.message}`);
      trc(`HOOK REORDER stderr: ${reorderErr.stderr || 'none'}`);
      // Fallback: use original input, no reorder
    }
  }

  return { reorderedInputPath, reorderedStartTime, reorderedDuration };
}
