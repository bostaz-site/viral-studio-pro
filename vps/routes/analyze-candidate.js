import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { downloadVideo } from '../lib/yt-dlp-wrapper.js';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);
const router = express.Router();

const TEMP_DIR = process.env.TEMP_DIR || '/tmp/viral-studio-render';
const GLOBAL_TIMEOUT_MS = 30_000;

// Thresholds (calibrated 2026-08)
const DARK_LUMA_THRESHOLD = 20;       // luma < 20 = "dark" second
const DARK_RATIO_THRESHOLD = 0.3;     // >30% dark seconds = flag
const DARK_STRETCH_THRESHOLD = 6;     // >6s continuous dark = flag
const SILENCE_NOISE_DB = '-35dB';
const SILENCE_MIN_DURATION = '0.5';
const SPEECH_RATIO_THRESHOLD = 0.25;  // <25% speech = flag
const SILENCE_STRETCH_THRESHOLD = 8;  // >8s continuous silence = flag

/**
 * POST /api/analyze-candidate
 *
 * Quick pre-render analysis to detect bad clip candidates:
 * - Dark sections (signalstats luma analysis)
 * - Low speech (silencedetect proxy — music counts as "speech", acceptable for a warning)
 *
 * Never blocks a render — returns { flags: [], error } on failure.
 */
router.post('/', async (req, res) => {
  const { videoUrl, fallbackUrl, clipId } = req.body;

  if (!videoUrl && !fallbackUrl) {
    return res.json({ flags: [], error: 'No video URL provided', analyzedAt: new Date().toISOString() });
  }

  const sessionId = randomUUID().slice(0, 8);
  const tempDir = path.join(TEMP_DIR, `candidate-${sessionId}`);

  // Global timeout — never exceed 30s
  const deadline = Date.now() + GLOBAL_TIMEOUT_MS;
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), GLOBAL_TIMEOUT_MS);

  try {
    await fs.mkdir(tempDir, { recursive: true });

    // Download video (reuses yt-dlp cache if available)
    let inputPath = null;

    try {
      const result = await downloadVideo(videoUrl || fallbackUrl, tempDir, {
        timeout: Math.min(15_000, deadline - Date.now()),
      });
      inputPath = result.filePath;
    } catch {
      // Fallback to direct fetch if yt-dlp fails
      if (fallbackUrl && fallbackUrl !== videoUrl) {
        try {
          const directPath = path.join(tempDir, 'input.mp4');
          const resp = await fetch(fallbackUrl, { signal: abortController.signal });
          if (resp.ok && resp.body) {
            const buffer = Buffer.from(await resp.arrayBuffer());
            await fs.writeFile(directPath, buffer);
            inputPath = directPath;
          }
        } catch {
          // Both methods failed
        }
      }
    }

    if (!inputPath) {
      return res.json({ flags: [], error: 'Failed to download video', analyzedAt: new Date().toISOString() });
    }

    // Get duration via ffprobe
    let totalDuration = 0;
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'csv=p=0', inputPath,
      ], { timeout: 5000 });
      totalDuration = parseFloat(stdout.trim()) || 0;
    } catch {
      return res.json({ flags: [], error: 'Failed to probe video', analyzedAt: new Date().toISOString() });
    }

    if (totalDuration <= 0) {
      return res.json({ flags: [], error: 'Invalid duration', analyzedAt: new Date().toISOString() });
    }

    // Run dark check and speech check in parallel
    const remainingMs = Math.max(1000, deadline - Date.now());

    const [darkResult, speechResult] = await Promise.allSettled([
      analyzeDarkSections(inputPath, totalDuration, Math.min(remainingMs, 15_000)),
      analyzeSpeech(inputPath, totalDuration, Math.min(remainingMs, 15_000)),
    ]);

    const dark = darkResult.status === 'fulfilled' ? darkResult.value : null;
    const speech = speechResult.status === 'fulfilled' ? speechResult.value : null;

    const flags = [];
    if (dark && (dark.darkSecondsRatio > DARK_RATIO_THRESHOLD || dark.longestDarkStretch > DARK_STRETCH_THRESHOLD)) {
      flags.push('too_dark');
    }
    if (speech && (speech.speechRatio < SPEECH_RATIO_THRESHOLD || speech.longestSilence > SILENCE_STRETCH_THRESHOLD)) {
      flags.push('low_speech');
    }

    const result = {
      darkSecondsRatio: dark?.darkSecondsRatio ?? null,
      longestDarkStretch: dark?.longestDarkStretch ?? null,
      speechRatio: speech?.speechRatio ?? null,
      longestSilence: speech?.longestSilence ?? null,
      totalDuration,
      flags,
      analyzedAt: new Date().toISOString(),
    };

    logger.info({ clipId, flags, dark: dark?.darkSecondsRatio, speech: speech?.speechRatio }, 'candidate-check');

    return res.json(result);
  } catch (err) {
    logger.error({ err: err.message, clipId }, 'candidate-check failed');
    return res.json({ flags: [], error: err.message, analyzedAt: new Date().toISOString() });
  } finally {
    clearTimeout(timer);
    // Cleanup temp directory (non-blocking)
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

/**
 * Dark section analysis via ffmpeg signalstats.
 * Outputs per-frame luma average — we sample at 1fps to keep it fast.
 */
async function analyzeDarkSections(inputPath, totalDuration, timeoutMs) {
  const { stderr } = await execFileAsync('ffmpeg', [
    '-i', inputPath,
    '-vf', 'fps=1,signalstats',
    '-f', 'null', '-',
  ], { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });

  // Parse signalstats output: lines like "[Parsed_signalstats_1 @ ...] YAVG:42.5 ..."
  const lumaPerSecond = [];
  const regex = /YAVG:\s*([\d.]+)/g;
  let match;
  while ((match = regex.exec(stderr)) !== null) {
    lumaPerSecond.push(parseFloat(match[1]));
  }

  if (lumaPerSecond.length === 0) {
    return { darkSecondsRatio: 0, longestDarkStretch: 0 };
  }

  // Calculate dark metrics
  let darkCount = 0;
  let longestDarkStretch = 0;
  let currentStretch = 0;

  for (const luma of lumaPerSecond) {
    if (luma < DARK_LUMA_THRESHOLD) {
      darkCount++;
      currentStretch++;
      longestDarkStretch = Math.max(longestDarkStretch, currentStretch);
    } else {
      currentStretch = 0;
    }
  }

  return {
    darkSecondsRatio: Math.round((darkCount / lumaPerSecond.length) * 100) / 100,
    longestDarkStretch,
  };
}

/**
 * Speech proxy via ffmpeg silencedetect.
 * NOTE: This is a proxy — music counts as "speech" (non-silence).
 * Acceptable for a pre-render warning; Whisper gives the real answer at render time.
 */
async function analyzeSpeech(inputPath, totalDuration, timeoutMs) {
  const { stderr } = await execFileAsync('ffmpeg', [
    '-i', inputPath,
    '-af', `silencedetect=noise=${SILENCE_NOISE_DB}:d=${SILENCE_MIN_DURATION}`,
    '-f', 'null', '-',
  ], { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });

  // Parse silencedetect output:
  // [silencedetect @ ...] silence_start: 1.234
  // [silencedetect @ ...] silence_end: 5.678 | silence_duration: 4.444
  const silenceRanges = [];
  const startRegex = /silence_start:\s*([\d.]+)/g;
  const endRegex = /silence_end:\s*([\d.]+)/g;

  const starts = [];
  const ends = [];
  let m;
  while ((m = startRegex.exec(stderr)) !== null) starts.push(parseFloat(m[1]));
  while ((m = endRegex.exec(stderr)) !== null) ends.push(parseFloat(m[1]));

  // Pair starts and ends
  for (let i = 0; i < starts.length; i++) {
    const end = i < ends.length ? ends[i] : totalDuration;
    silenceRanges.push({ start: starts[i], end, duration: end - starts[i] });
  }

  const totalSilence = silenceRanges.reduce((sum, r) => sum + r.duration, 0);
  const speechRatio = totalDuration > 0 ? Math.round(((totalDuration - totalSilence) / totalDuration) * 100) / 100 : 1;
  const longestSilence = silenceRanges.length > 0
    ? Math.round(Math.max(...silenceRanges.map(r => r.duration)) * 10) / 10
    : 0;

  return { speechRatio, longestSilence };
}

export default router;
