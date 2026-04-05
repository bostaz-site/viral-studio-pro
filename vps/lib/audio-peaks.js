import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Audio peak detection for Smart Zoom "Dynamic" mode.
 *
 * Runs ffmpeg with astats on fixed-size sample chunks (~46ms each) to get
 * per-chunk RMS dB levels, then detects peaks using a rolling-window mean
 * + threshold algorithm, with cooldown to avoid clustered zooms.
 */

const CHUNK_SAMPLES = 2048;      // ~46ms at 44.1kHz
const SAMPLE_RATE = 44100;
const CHUNK_DURATION = CHUNK_SAMPLES / SAMPLE_RATE; // ~0.0464s

/**
 * Analyze a video's audio track for peaks.
 *
 * @param {string} inputPath   - Path to source video
 * @param {number} startTime   - Start offset (seconds)
 * @param {number} duration    - Clip duration (seconds)
 * @param {object} opts        - Detection parameters
 * @param {number} opts.cooldownSec     - Min seconds between peaks (default 2.5)
 * @param {number} opts.thresholdDb     - dB above rolling mean to count as peak (default 6)
 * @param {number} opts.floorDb         - Minimum absolute RMS to consider (default -32)
 * @param {number} opts.windowSec       - Rolling mean window size (default 2.0)
 * @param {number} opts.maxPeaks        - Cap on returned peaks (default 20)
 * @returns {Promise<number[]>} Array of peak timestamps (relative to clip start)
 */
export async function analyzeAudioPeaks(inputPath, startTime, duration, opts = {}) {
  const {
    cooldownSec = 2.5,
    thresholdDb = 6,
    floorDb = -32,
    windowSec = 2.0,
    maxPeaks = 20,
  } = opts;

  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

  // Build ffmpeg command that outputs RMS metadata on stderr
  const args = [
    '-nostats',
    '-ss', String(startTime),
    '-i', inputPath,
    '-t', String(duration),
    '-map', '0:a:0?',
    '-af',
    `aresample=${SAMPLE_RATE},asetnsamples=n=${CHUNK_SAMPLES}:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:direct=1`,
    '-f', 'null',
    '-'
  ];

  let stderr = '';
  try {
    const result = await execFileAsync(ffmpegPath, args, {
      maxBuffer: 50 * 1024 * 1024, // 50MB — astats output can be large for long clips
      timeout: 60000,
    });
    stderr = result.stderr || '';
  } catch (err) {
    // ffmpeg returns non-zero if no audio stream; treat as no-peaks silently
    if (err.code !== 0 && !err.stderr) {
      console.warn('[AudioPeaks] ffmpeg failed:', err.message);
      return [];
    }
    stderr = err.stderr || '';
  }

  // Parse ametadata print output. Format:
  //   frame:N pts:X pts_time:T.TTT
  //   lavfi.astats.Overall.RMS_level=-XX.YYYYYY
  const samples = parseAstatsOutput(stderr);
  if (samples.length === 0) {
    console.log('[AudioPeaks] No audio samples extracted');
    return [];
  }

  const peaks = detectPeaks(samples, {
    cooldownSec,
    thresholdDb,
    floorDb,
    windowSec,
    maxPeaks,
  });

  console.log(`[AudioPeaks] ${samples.length} chunks analyzed, ${peaks.length} peaks detected`);
  return peaks;
}

/**
 * Parse ffmpeg ametadata stderr into array of {time, rms}
 */
function parseAstatsOutput(stderr) {
  const samples = [];
  const lines = stderr.split('\n');
  let currentTime = null;

  for (const line of lines) {
    // Match pts_time line
    const timeMatch = line.match(/pts_time:([\d.]+)/);
    if (timeMatch) {
      currentTime = parseFloat(timeMatch[1]);
      continue;
    }
    // Match RMS level line
    const rmsMatch = line.match(/lavfi\.astats\.Overall\.RMS_level=(-?[\d.]+|-inf|nan)/);
    if (rmsMatch && currentTime !== null) {
      let rms = parseFloat(rmsMatch[1]);
      if (isNaN(rms) || !isFinite(rms)) rms = -100; // treat silence as very low
      samples.push({ time: currentTime, rms });
      currentTime = null;
    }
  }
  return samples;
}

/**
 * Detect peaks using rolling mean + threshold + cooldown.
 */
function detectPeaks(samples, opts) {
  const { cooldownSec, thresholdDb, floorDb, windowSec, maxPeaks } = opts;
  if (samples.length < 3) return [];

  // Compute rolling mean using a simple sliding window
  const windowChunks = Math.max(1, Math.round(windowSec / CHUNK_DURATION));
  const rollingMean = new Float64Array(samples.length);
  let sum = 0;
  let count = 0;
  const queue = [];
  for (let i = 0; i < samples.length; i++) {
    queue.push(samples[i].rms);
    sum += samples[i].rms;
    count++;
    while (queue.length > windowChunks) {
      sum -= queue.shift();
      count--;
    }
    rollingMean[i] = sum / count;
  }

  // Find local maxima above threshold, respect cooldown
  const peaks = [];
  let lastPeakTime = -Infinity;

  for (let i = 1; i < samples.length - 1; i++) {
    const s = samples[i];
    // Must clear absolute floor
    if (s.rms < floorDb) continue;
    // Must be above rolling mean + threshold
    if (s.rms - rollingMean[i] < thresholdDb) continue;
    // Must be a local max (beats both neighbors)
    if (s.rms < samples[i - 1].rms || s.rms < samples[i + 1].rms) continue;
    // Cooldown
    if (s.time - lastPeakTime < cooldownSec) continue;

    peaks.push(s.time);
    lastPeakTime = s.time;
    if (peaks.length >= maxPeaks) break;
  }

  return peaks;
}
