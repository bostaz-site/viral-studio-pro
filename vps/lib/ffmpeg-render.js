import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeAudioPeaks } from './audio-peaks.js';

// Hook overlay: uses browser-captured PNGs with drawtext fallback if PNG is absent

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * FFmpeg render engine for Viral Animal
 * Handles video cutting, reframing, captioning, watermarking, and blurred-background compositing
 */

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escapes special characters in paths for FFmpeg filters
 */
export function escapePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

/**
 * Escapes special characters in text for drawtext filter
 */
export function escapeDrawtext(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/@/g, '\\@')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/%/g, '%%')
    .replace(/\n/g, ' ');
}

/**
 * Builds a simple FFmpeg command string from args array (for logging)
 */
function buildCommand(args) {
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  return [ffmpegPath, ...args].map(arg => {
    if (arg.includes(' ') && !arg.startsWith('"') && !arg.includes(',')) {
      return `"${arg}"`;
    }
    return arg;
  }).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Render Quality Tiers (4-level retry ladder)
// ─────────────────────────────────────────────────────────────────────────────

// Bitrate targets: TikTok re-encodes everything to ~6-8 Mbps. Anything above
// ~10 Mbps is wasted bytes (no visible quality gain, bloated file size).
// A 60s clip at 8 Mbps + 192k audio = ~62 MB. With CRF the actual size is
// usually lower, but maxrate caps the peaks.
const RENDER_TIERS = {
  HIGH_60: {
    preset: 'fast', crf: 20, maxrate: '8M', bufsize: '16M',
    fps: 60, profile: 'high', level: '4.2',
    audioBitrate: '192k', unsharp: true, hd: true,
  },
  HIGH_30: {
    preset: 'fast', crf: 20, maxrate: '8M', bufsize: '16M',
    fps: 30, profile: 'high', level: '4.2',
    audioBitrate: '192k', unsharp: true, hd: true,
  },
  SAFE: {
    preset: 'faster', crf: 23, maxrate: '5M', bufsize: '10M',
    fps: 30, profile: 'high', level: '4.1',
    audioBitrate: '160k', unsharp: false, hd: false,
  },
  LAST_RESORT: {
    preset: 'ultrafast', crf: 26, maxrate: '3M', bufsize: '6M',
    fps: 30, profile: 'high', level: '4.1',
    audioBitrate: '128k', unsharp: false, hd: false,
  },
};

// Hard file size limit (bytes). Supabase free tier = 50 MB/file.
// We target 45 MB to leave headroom for the end-card concat.
const MAX_OUTPUT_BYTES = 45 * 1024 * 1024;

function getTierSequence(quality) {
  switch (quality) {
    case 'safe': return ['SAFE', 'LAST_RESORT'];
    case 'last': return ['LAST_RESORT'];
    default:     return ['HIGH_60', 'HIGH_30', 'SAFE', 'LAST_RESORT'];
  }
}

function getCanvasDimensions(tier, aspectRatio) {
  if (tier.hd) {
    const ratios = { '9:16': { w: 1080, h: 1920 }, '1:1': { w: 1080, h: 1080 }, '16:9': { w: 1920, h: 1080 } };
    return ratios[aspectRatio] || ratios['9:16'];
  }
  const ratios = { '9:16': { w: 720, h: 1280 }, '1:1': { w: 720, h: 720 }, '16:9': { w: 1280, h: 720 } };
  return ratios[aspectRatio] || ratios['9:16'];
}

function getTierFps(tier, sourceFps) {
  if (tier.fps === 60 && sourceFps >= 50) return 60;
  return 30;
}

function isOOMError(err) {
  if (!err) return false;
  const msg = err.message || '';
  return err.killed === true || err.signal === 'SIGKILL' || err.exitCode === null || err.exitCode === 137
    || msg.includes('signal=SIGKILL') || msg.includes('killed=true') || msg.includes('code=null') || msg.includes('code=137');
}

async function probeSourceFps(inputPath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=r_frame_rate',
      '-of', 'csv=p=0',
      inputPath,
    ], { timeout: 10000 });
    const parts = stdout.trim().split('/');
    if (parts.length === 2 && parseInt(parts[1]) > 0) {
      return Math.round(parseInt(parts[0]) / parseInt(parts[1]));
    }
    return parseInt(stdout.trim()) || 30;
  } catch {
    return 30;
  }
}

/**
 * Compute a duration-aware maxrate so the first encode stays under 45 MB.
 * Formula: min(tierMaxrate, 45MB × 8 / duration).
 * Short clips keep the full tier maxrate; long clips get a cap.
 */
function clampMaxrate(tierMaxrate, clipDuration) {
  if (!clipDuration || clipDuration <= 0) return tierMaxrate;
  const tierBps = parseInt(tierMaxrate) * 1_000_000; // e.g. '8M' → 8_000_000
  const targetBps = Math.floor((MAX_OUTPUT_BYTES * 8) / clipDuration);
  if (targetBps >= tierBps) return tierMaxrate; // short clip — tier cap is fine
  const cappedM = Math.max(2, Math.floor(targetBps / 1_000_000)); // floor to whole Mbps, min 2M
  return `${cappedM}M`;
}

function buildCommonEncodingArgs(tier, fps, clipDuration) {
  const gop = fps === 60 ? 120 : 60;
  const maxrate = clampMaxrate(tier.maxrate, clipDuration);
  // bufsize = 2× maxrate to keep VBV responsive
  const bufsizeM = parseInt(maxrate) * 2;
  return [
    '-c:v', 'libx264',
    '-preset', tier.preset,
    '-crf', String(tier.crf),
    '-maxrate', maxrate,
    '-bufsize', `${bufsizeM}M`,
    '-profile:v', tier.profile,
    '-level:v', tier.level,
    '-pix_fmt', 'yuv420p',
    '-fps_mode', 'cfr',
    '-r', String(fps),
    '-g', String(gop),
    '-keyint_min', String(gop),
    '-sc_threshold', '0',
    '-movflags', '+faststart',
    '-tag:v', 'avc1',
    '-colorspace', 'bt709',
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    '-threads', '2',
    '-filter_threads', '1',
    '-filter_complex_threads', '1',
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Exposure Correction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Probe average luma (brightness) of a video by sampling a few frames.
 * Returns average Y value on 0-255 scale, or null on failure.
 */
async function probeAverageLuma(inputPath, startTime = 0) {
  try {
    const result = await execFileAsync('ffmpeg', [
      '-ss', String(startTime),
      '-i', inputPath,
      '-vframes', '5',
      '-vf', 'signalstats',
      '-f', 'null', '-',
    ], { timeout: 15000, maxBuffer: 1024 * 1024 });

    const output = result.stderr || '';
    const matches = [...output.matchAll(/YAVG=([\d.]+)/g)];
    if (matches.length === 0) return null;

    const avg = matches.reduce((s, m) => s + parseFloat(m[1]), 0) / matches.length;
    return avg;
  } catch {
    return null;
  }
}

/**
 * Calculate adaptive exposure correction parameters based on average luma.
 * 4 buckets — gentler than before to avoid clipping after TikTok re-encode.
 * Returns FFmpeg eq filter parameters { brightness, contrast, saturation, gamma }.
 */
function getExposureParams(avgLuma) {
  if (avgLuma === null || avgLuma === undefined) {
    // Default: very mild boost (unknown source)
    return { brightness: 0.015, contrast: 1.05, saturation: 1.05, gamma: 1.01 };
  }

  if (avgLuma < 65) {
    // Dark
    return { brightness: 0.035, contrast: 1.08, saturation: 1.08, gamma: 1.03 };
  } else if (avgLuma < 95) {
    // Dim
    return { brightness: 0.015, contrast: 1.05, saturation: 1.05, gamma: 1.01 };
  } else if (avgLuma < 140) {
    // Normal
    return { brightness: 0, contrast: 1.02, saturation: 1.04 };
  } else {
    // Well-lit: no correction
    return { brightness: 0, contrast: 1.0, saturation: 1.0 };
  }
}

/**
 * Build an eq filter string from exposure params. Returns null if no correction needed.
 */
function buildExposureFilter(params) {
  if (params.brightness === 0 && params.contrast === 1.0 && params.saturation === 1.0) {
    return null;
  }
  let filter = `eq=brightness=${params.brightness}:contrast=${params.contrast}:saturation=${params.saturation}`;
  if (params.gamma && params.gamma !== 1.0) {
    filter += `:gamma=${params.gamma}`;
  }
  return filter;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bright First Frame (TikTok profile thumbnail fix)
// ─────────────────────────────────────────────────────────────────────────────

const OPENING_LUMA_THRESHOLD = 16; // Y value 0-255; below = dark opening
const OPENING_LIFT_DURATION = 0.5; // seconds of progressive brightness lift

/**
 * Probe average luma of the first ~10 frames (the "opening").
 * Uses signalstats on vframes=10 from the clip start.
 * Returns average Y value on 0-255 scale, or null on failure.
 */
async function probeOpeningLuma(inputPath, startTime = 0) {
  try {
    const result = await execFileAsync('ffmpeg', [
      '-ss', String(startTime),
      '-i', inputPath,
      '-vframes', '10',
      '-vf', 'signalstats',
      '-f', 'null', '-',
    ], { timeout: 15000, maxBuffer: 1024 * 1024 });

    const output = result.stderr || '';
    const matches = [...output.matchAll(/YAVG=([\d.]+)/g)];
    if (matches.length === 0) return null;

    const avg = matches.reduce((s, m) => s + parseFloat(m[1]), 0) / matches.length;
    return avg;
  } catch {
    return null;
  }
}

/**
 * Build an FFmpeg filter that applies a progressive exposure lift on the first
 * OPENING_LIFT_DURATION seconds ONLY. The lift fades from +brightness down to 0
 * so frame 1 is brightened but the rest of the clip is untouched.
 *
 * Uses the `curves` filter with `enable` for the time window, combined with a
 * fade expression: brightness = base * (1 - t/duration).
 *
 * Since `eq` brightness doesn't support per-frame expressions, we use the
 * `curves` filter with `enable` for the time gate, then cross-fade with the
 * original using `overlay` with timeline. Simpler approach: use `eq` with
 * `eval=frame` and a brightness expression that decays over time.
 *
 * @param {string} inputLabel  - Current filter chain output label e.g. '[exposed]'
 * @param {string} outputLabel - Output label e.g. '[bff]'
 * @returns {string} FFmpeg filter chain segment
 */
function buildBrightFirstFrameFilter(inputLabel, outputLabel) {
  // eq filter with eval=frame allows per-frame brightness expression.
  // brightness ramps from 0.25 at t=0 down to 0 at t=OPENING_LIFT_DURATION.
  // After that time, the enable flag disables the filter entirely → zero cost.
  const dur = OPENING_LIFT_DURATION;
  const maxLift = 0.25;
  // Expression: brightness = maxLift * (1 - t/dur), clamped to [0, maxLift]
  const brExpr = `${maxLift}*(1-min(t/${dur}\\,1))`;
  return `${inputLabel}eq=brightness='${brExpr}':eval=frame:enable='lte(t\\,${dur})'${outputLabel}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Text Overlay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a drawtext filter for the hook text overlay.
 * Shows the hook text with a bold style during the first `hookLength` seconds,
 * with a fade-in and fade-out animation.
 *
 * @param {string} hookText   - The hook text to display
 * @param {number} hookLength - Duration in seconds to show the text
 * @param {string} style      - Hook style: 'shock', 'curiosity', 'suspense'
 * @param {number} canvasW    - Canvas width
 * @param {number} canvasH    - Canvas height
 * @returns {string|null} - drawtext filter string or null
 */
/**
 * Prepare a hook overlay PNG for FFmpeg overlay.
 *
 * Priority:
 *   1. If overlayPng (base64 from browser) is provided → use it directly (pixel-perfect)
 *   2. Otherwise → fall back to SVG generation via resvg
 *
 * Builds a drawtext filter string for the hook text overlay.
 *
 * Style: black capsule (rgba) + purple border + white bold uppercase text
 * with fade in/out on alpha channel.
 *
 * Prepares hook overlay PNG for FFmpeg.
 * Uses browser-captured PNG (pixel-perfect match to CSS preview).
 * @returns {Promise<{pngPath: string, hookLength: number, isCapsuleOnly: boolean, capsuleW: number, capsuleH: number, textPosition: number} | null>}
 */
async function prepareHookOverlay(hookText, hookLength, canvasW, canvasH, textPosition = 18, jobDir, hook = {}) {
  if (!hookText || hookLength <= 0) return null;

  const pngPath = path.join(jobDir, 'hook-overlay.png');
  const overlayPng = hook.overlayPng;

  if (overlayPng && typeof overlayPng === 'string' && overlayPng.startsWith('data:image/png')) {
    const base64Data = overlayPng.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(pngPath, Buffer.from(base64Data, 'base64'));
    const capsuleW = hook.overlayCapsuleW || 0;
    const capsuleH = hook.overlayCapsuleH || 0;
    const isCapsuleOnly = capsuleW > 0 && capsuleH > 0 && capsuleW < canvasW;
    console.log(`[hook-overlay] Browser PNG saved: ${pngPath} (${capsuleW}x${capsuleH}, capsule=${isCapsuleOnly})`);
    return { pngPath, hookLength, isCapsuleOnly, capsuleW, capsuleH, textPosition };
  }

  console.warn('[hook-overlay] No browser PNG provided — skipping hook overlay');
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio Pitch Shift (anti-fingerprint)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build FFmpeg audio filters for imperceptible pitch/tempo shift.
 * Changes the audio fingerprint without audible difference (±2-4%).
 * Uses asetrate to shift pitch, then atempo to correct duration.
 *
 * @param {number} sampleRate - Source sample rate (default 48000)
 * @returns {{ filters: string[], outputRate: number }}
 */
function buildAudioShiftFilters(sampleRate = 48000) {
  // Deterministic but per-render variation: shift by +3% (imperceptible)
  // asetrate changes playback rate (pitch+speed), atempo corrects speed back
  const shiftFactor = 1.03;
  const shiftedRate = Math.round(sampleRate * shiftFactor);
  return {
    filters: [
      `asetrate=${shiftedRate}`,
      `atempo=${(1 / shiftFactor).toFixed(6)}`,
      `aresample=${sampleRate}`,
    ],
    outputRate: sampleRate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio Enhancement (bass boost + compression)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build FFmpeg audio filters for bass boost on peaks.
 *
 * V1: global bass boost (not per-peak). Per-peak would require
 * complex filter_complex chains with segment-based processing.
 *
 * @param {Object} settings
 * @param {string} settings.bassBoost - 'off' | 'mild' | 'heavy'
 * @returns {string[]} FFmpeg filter chain segments
 */
function buildBassBoostFilters(settings) {
  if (!settings.bassBoost || settings.bassBoost === 'off') return [];

  const filters = [];

  if (settings.bassBoost === 'mild') {
    filters.push('bass=g=4:f=80:w=100');
    filters.push('acompressor=threshold=-20dB:ratio=3:attack=5:release=50');
  } else if (settings.bassBoost === 'heavy') {
    filters.push('bass=g=8:f=60:w=120');
    filters.push('acompressor=threshold=-16dB:ratio=5:attack=3:release=30');
  }

  // Always add limiter to prevent clipping
  filters.push('alimiter=limit=0.95:attack=5:release=50');
  return filters;
}

// ─────────────────────────────────────────────────────────────────────────────
// Speed Ramp
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build FFmpeg speed ramp filters.
 *
 * V1: constant subtle speed-up. True per-segment speed ramps require
 * complex setpts+atempo chains with timestamp recalculation.
 *
 * @param {Object} settings
 * @param {string} settings.speedRamp - 'off' | 'subtle' | 'dynamic'
 * @returns {{ video: string[], audio: string[], factor: number }}
 */
function buildSpeedRampFilters(settings) {
  if (!settings.speedRamp || settings.speedRamp === 'off') {
    return { video: [], audio: [], factor: 1.0 };
  }

  if (settings.speedRamp === 'subtle') {
    return {
      video: ['setpts=PTS/1.03'],
      audio: ['atempo=1.03'],
      factor: 1.03,
    };
  }

  if (settings.speedRamp === 'dynamic') {
    return {
      video: ['setpts=PTS/1.05'],
      audio: ['atempo=1.05'],
      factor: 1.05,
    };
  }

  return { video: [], audio: [], factor: 1.0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Render Pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a smart-zoom filter segment to apply to a canvas-sized video stream.
 *
 * Modes:
 *   - micro:   slow cinematic push 1.0 → 1.08 over clip duration
 *   - dynamic: (Phase 2) punch zooms on audio peaks with cooldown
 *   - follow:  (Phase 2) face-tracking with lerp smoothing
 *
 * Returns a filter string of the form: `[in]crop=...,scale=WxH,setsar=1[out]`
 * or null if smart zoom is disabled/unsupported.
 *
 * @param {string} inLabel      - FFmpeg stream label to apply zoom to (e.g. '[composed]')
 * @param {string} outLabel     - Output stream label (e.g. '[zoomed]')
 * @param {number} canvasW      - Target canvas width
 * @param {number} canvasH      - Target canvas height
 * @param {number} clipDuration - Duration in seconds (for time-based expressions)
 * @param {string} mode         - 'micro' | 'dynamic' | 'follow'
 */
function buildSmartZoomFilter(inLabel, outLabel, canvasW, canvasH, clipDuration, mode = 'micro', peaks = []) {
  if (!clipDuration || clipDuration <= 0) return null;

  // All modes use scale(eval=frame)+crop — the only reliable way to do
  // time-varying zoom on VIDEO (zoompan is for stills only).
  // Memory safety: 720p canvas + simple expressions + max 3 peaks.

  if (mode === 'dynamic' && Array.isArray(peaks) && peaks.length > 0) {
    // ── SUBTLE PUNCH ZOOM ──
    // Inspired by CapCut/pro editors but toned down for natural feel:
    //   - Zoom amount: 5% (subtle, capped at 1.08 total amplitude)
    //   - Zoom-in: 200ms ease-out (fast start, smooth stop)
    //   - Hold: 100ms at peak
    //   - Zoom-out: 400ms slow ease-out (smooth return, no snap)
    //   - Total cycle: ~700ms
    //   - Max 3 punches per clip (less = more pro)
    //   - No baseline breathing (stays still between punches)
    const D = clipDuration.toFixed(3);
    const ZOOM_AMOUNT = 0.05;       // 5% punch zoom (safe — capped at 1.08 total)
    const RAMP_IN = 0.20;           // 200ms zoom-in
    const HOLD = 0.10;              // 100ms hold at peak
    const RAMP_OUT = 0.40;          // 400ms smooth zoom-out
    const TOTAL = RAMP_IN + HOLD + RAMP_OUT; // 700ms total cycle

    const limited = peaks.slice(0, 3); // max 3 punches

    const terms = limited.map(tp => {
      const t0 = tp.toFixed(3);
      const tHoldStart = (tp + RAMP_IN).toFixed(3);
      const tHoldEnd = (tp + RAMP_IN + HOLD).toFixed(3);
      const tEnd = (tp + TOTAL).toFixed(3);
      const zoomIn = `if(between(t\\,${t0}\\,${tHoldStart})\\,${ZOOM_AMOUNT}*sqrt((t-${t0})/${RAMP_IN})\\,0)`;
      const hold = `if(between(t\\,${tHoldStart}\\,${tHoldEnd})\\,${ZOOM_AMOUNT}\\,0)`;
      // Smooth ease-out return (sqrt instead of squared = no snap)
      const zoomOut = `if(between(t\\,${tHoldEnd}\\,${tEnd})\\,${ZOOM_AMOUNT}*(1-sqrt((t-${tHoldEnd})/${RAMP_OUT}))\\,0)`;
      return `${zoomIn}+${hold}+${zoomOut}`;
    });

    // No baseline breathing — completely still between punches for pro look
    const zExpr = `(1+${terms.join('+')})`;
    const scaledW = `trunc(${canvasW}*${zExpr}/2)*2`;
    const scaledH = `trunc(${canvasH}*${zExpr}/2)*2`;

    console.log(`[FFmpeg] Smart Zoom dynamic: ${limited.length} peaks, ${Math.round(ZOOM_AMOUNT*100)}% punch, smooth ease`);

    return `${inLabel}scale=w='${scaledW}':h='${scaledH}':eval=frame:flags=lanczos,crop=${canvasW}:${canvasH},setsar=1${outLabel}`;
  }

  if (mode === 'micro') {
    // ── SLOW CINEMATIC PUSH ──
    // Single slow push-in 1.0 → 1.06 over the entire clip.
    // Subtle, barely noticeable drift — Netflix/documentary talking-head style.
    // Max amplitude capped at 1.08 to prevent noticeable crop.
    const D = clipDuration.toFixed(3);
    const zExpr = `(1+0.06*min(t/${D}\\,1))`;
    const scaledW = `trunc(${canvasW}*${zExpr}/2)*2`;
    const scaledH = `trunc(${canvasH}*${zExpr}/2)*2`;

    console.log(`[FFmpeg] Smart Zoom micro: slow push 0→6%, duration=${D}s`);

    return `${inLabel}scale=w='${scaledW}':h='${scaledH}':eval=frame:flags=lanczos,crop=${canvasW}:${canvasH},setsar=1${outLabel}`;
  }

  // Dynamic requested but no peaks → fall back to micro.
  if (mode === 'dynamic') {
    return buildSmartZoomFilter(inLabel, outLabel, canvasW, canvasH, clipDuration, 'micro');
  }

  // Follow mode without face data → fall back to micro.
  if (mode === 'follow') {
    return buildSmartZoomFilter(inLabel, outLabel, canvasW, canvasH, clipDuration, 'micro');
  }

  return null;
}


/**
 * Build a follow-face smart zoom filter from pre-detected face keyframes.
 *
 * Takes smoothed keyframes [{t, cx, cy, zoom}] from face-detect.py
 * and generates an FFmpeg crop filter that pans to follow the face.
 *
 * Strategy:
 *   1. Scale up the video by ~20% (zoom in) so we have room to pan
 *   2. Crop at canvas size, moving the crop window to follow the face
 *   3. Interpolate linearly between keyframes for smooth camera motion
 *
 * @param {string} inLabel       - Input stream label
 * @param {string} outLabel      - Output stream label
 * @param {number} canvasW       - Target width
 * @param {number} canvasH       - Target height
 * @param {Array}  keyframes     - [{t, cx, cy, zoom}] smoothed face positions
 * @param {number} clipDuration  - Clip duration in seconds
 * @returns {string|null} FFmpeg filter string
 */
function buildFollowFaceFilter(inLabel, outLabel, canvasW, canvasH, keyframes, clipDuration, zoomOverride) {
  if (!keyframes || keyframes.length < 2) {
    console.log('[FFmpeg] Follow face: not enough keyframes, falling back to micro');
    return null;
  }

  // Zoom factor: how much to scale up for pan room.
  // Default 1.20 (±10% pan range). Caller can override to 1.0 (pan-only,
  // no additional zoom) when the crop budget is already tight (e.g. fullframe).
  const ZOOM = zoomOverride || 1.20;
  const scaledW = Math.round(canvasW * ZOOM);
  const scaledH = Math.round(canvasH * ZOOM);
  // Max pan range (how far the crop window can move)
  const maxPanX = scaledW - canvasW;
  const maxPanY = scaledH - canvasH;
  const halfW = canvasW / 2;
  const halfH = canvasH / 2;

  // ── Downsample keyframes to max ~20 for FFmpeg expression sanity ──
  // Too many nested if() expressions can make FFmpeg choke
  const MAX_KF = 20;
  let kf = keyframes;
  if (kf.length > MAX_KF) {
    const step = Math.floor(kf.length / MAX_KF);
    kf = keyframes.filter((_, i) => i % step === 0);
    // Always include the last keyframe
    if (kf[kf.length - 1].t !== keyframes[keyframes.length - 1].t) {
      kf.push(keyframes[keyframes.length - 1]);
    }
  }

  // ── Build piecewise linear interpolation for X and Y ──
  // For each pair of consecutive keyframes, generate:
  //   if(between(t, t0, t1), lerp(cx0, cx1, (t-t0)/(t1-t0)), ...)
  // The crop x/y is: face_center - canvas_half, clamped to [0, maxPan]

  function buildLerpExpr(pts, axis) {
    // axis: 'cx' or 'cy'
    const maxPan = axis === 'cx' ? maxPanX : maxPanY;

    // Convert face center to crop offset
    const getOffset = (pt) => {
      const center = pt[axis];
      const canvasSize = axis === 'cx' ? canvasW : canvasH;
      const norm = center / canvasSize;
      const offset = Math.round((norm - 0.5) * maxPan + maxPan / 2);
      return Math.max(0, Math.min(maxPan, offset));
    };

    if (pts.length === 1) {
      return String(getOffset(pts[0]));
    }

    // Build nested if/between for piecewise lerp
    const segments = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const t0 = pts[i].t.toFixed(4);
      const t1 = pts[i + 1].t.toFixed(4);
      const v0 = getOffset(pts[i]);
      const v1 = getOffset(pts[i + 1]);

      if (v0 === v1) {
        segments.push(`if(between(t\\,${t0}\\,${t1})\\,${v0}\\,0)`);
      } else {
        const dt = (pts[i + 1].t - pts[i].t).toFixed(4);
        if (parseFloat(dt) <= 0) continue;
        segments.push(
          `if(between(t\\,${t0}\\,${t1})\\,${v0}+(${v1 - v0})*(t-${t0})/${dt}\\,0)`
        );
      }
    }

    // Hold last value after last keyframe
    const lastVal = getOffset(pts[pts.length - 1]);
    const lastT = pts[pts.length - 1].t.toFixed(4);
    segments.push(`if(gte(t\\,${lastT})\\,${lastVal}\\,0)`);

    return segments.join('+');
  }

  const xExpr = buildLerpExpr(kf, 'cx');
  const yExpr = buildLerpExpr(kf, 'cy');

  console.log(`[FFmpeg] Follow face: ${kf.length} keyframes, ${ZOOM}x zoom, piecewise lerp pan`);

  // Scale up → crop with moving window → set SAR
  return `${inLabel}scale=${scaledW}:${scaledH}:flags=lanczos,crop=${canvasW}:${canvasH}:x='${xExpr}':y='${yExpr}':exact=1,setsar=1${outLabel}`;
}


// Re-export for use in render pipeline
export { buildFollowFaceFilter };

/**
 * Build FFmpeg filter chain for reframing to target aspect ratio
 */
function buildReframeFilters(aspectRatio, options = {}) {
  const { cropAnchor = 'center' } = options;

  const ratios = {
    '9:16': { w: 1080, h: 1920 },
    '1:1': { w: 1080, h: 1080 },
    '16:9': { w: 1920, h: 1080 },
  };

  const { w: targetW, h: targetH } = ratios[aspectRatio] || ratios['9:16'];
  const targetAspect = targetW / targetH; // e.g. 9/16 = 0.5625

  // Memory-efficient strategy: crop to target aspect ratio FIRST (at original resolution),
  // then scale to exact target size. This avoids creating huge intermediate frames
  // (e.g. 3414x1920 from a 1280x720 input) which caused OOM on Railway.

  // Crop to target aspect ratio — pick the dimension that "fits"
  // If input is wider than target → crop width, keep height
  // If input is taller than target → crop height, keep width
  // Use min(iw, ih*targetAspect) for width, min(ih, iw/targetAspect) for height
  const cropW = `min(iw\\, trunc(ih*${targetAspect}/2)*2)`;
  const cropH = `min(ih\\, trunc(iw/${targetAspect}/2)*2)`;

  let cropY = `(ih-${cropH})/2`;
  if (cropAnchor === 'top') cropY = '0';
  if (cropAnchor === 'bottom') cropY = `ih-${cropH}`;

  const cropFilter = `crop=${cropW}:${cropH}:(iw-${cropW})/2:${cropY}`;

  // Then scale the cropped frame to exact target dimensions
  const scaleFilter = `scale=${targetW}:${targetH}:flags=lanczos`;

  return `${cropFilter},${scaleFilter},setsar=1`;
}

/**
 * Main render function with 4-tier retry ladder.
 * Tier 1 HIGH_60 → Tier 2 HIGH_30 → Tier 3 SAFE → Tier 4 LAST_RESORT
 * Falls back automatically on OOM (exit code null/137).
 */
export async function renderClip(inputPath, outputPath, options = {}) {
  const {
    startTime = 0,
    endTime,
    duration,
    aspectRatio = '9:16',
    captions = null,
    watermark = null,
    watermarkPosition = 'bottom-right',
    plan = 'free',
    // splitScreen is permanently removed — ignore silently if old clients send it
    tag = null,
    cropAnchor = 'center',
    backgroundBlur = true,
    maxDuration = 300,
    timeout = 300000,
    smartZoom = null,
    videoZoom = 'contain',
    hook = null,
    audioEnhance = false,
    bassBoost = 'off',
    speedRamp = 'off',
    voiceoverPaths = null, // [{path, startTime, estimatedDuration}]
    reactionLayout = null, // {faceRegion: {x,y,w,h}, contentRegion: {x,y,w,h}}
  } = options;

  if (!inputPath || !outputPath) {
    throw new Error('inputPath and outputPath are required');
  }

  const clipDuration = duration || (endTime - startTime);
  if (clipDuration > maxDuration) {
    throw new Error(`Clip duration ${clipDuration}s exceeds max ${maxDuration}s`);
  }

  // ── Pre-compute tier-independent data (run once) ───────────────────────
  let sourceFps = 30;
  try { sourceFps = await probeSourceFps(inputPath); } catch {}

  let audioPeaks = [];
  if (smartZoom && smartZoom.enabled && smartZoom.mode === 'dynamic') {
    // Prefer hook analysis combined peaks if available (better signal than raw audio)
    if (hook?.analysisResult?.scores?.length > 0) {
      try {
        const { getTopPeakWindows } = await import('./hook-generator.js');
        audioPeaks = getTopPeakWindows(hook.analysisResult, 3, 2.5);
        console.log(`[FFmpeg] Smart Zoom: using ${audioPeaks.length} peaks from hook analysis`);
      } catch { /* fallback below */ }
    }
    // Fallback: raw audio peak detection
    if (audioPeaks.length === 0) {
      try {
        audioPeaks = await analyzeAudioPeaks(inputPath, startTime, clipDuration);
      } catch (err) {
        console.warn('[FFmpeg] Audio peak analysis failed:', err.message);
      }
    }
  }

  let exposureFilter = null;
  try {
    const avgLuma = await probeAverageLuma(inputPath, startTime);
    const exposureParams = getExposureParams(avgLuma);
    exposureFilter = buildExposureFilter(exposureParams);
    console.log(`[FFmpeg] Exposure probe: avgLuma=${avgLuma !== null ? avgLuma.toFixed(1) : 'N/A'}, filter=${exposureFilter || 'none'}`);
  } catch (err) {
    console.warn('[FFmpeg] Exposure probe failed:', err.message);
    const fallback = getExposureParams(null);
    exposureFilter = buildExposureFilter(fallback);
  }

  // ── Bright first frame detection (TikTok thumbnail fix) ──
  let openingDark = false;
  let openingLuma = null;
  try {
    openingLuma = await probeOpeningLuma(inputPath, startTime);
    openingDark = openingLuma !== null && openingLuma < OPENING_LUMA_THRESHOLD;
    console.log(`[FFmpeg] Opening luma probe: avgY=${openingLuma !== null ? openingLuma.toFixed(1) : 'N/A'}, dark=${openingDark} (threshold=${OPENING_LUMA_THRESHOLD})`);
  } catch (err) {
    console.warn('[FFmpeg] Opening luma probe failed:', err.message);
  }

  // ── Helper: append end-card for free plan ──
  async function maybeAppendEndCard(result) {
    if (plan !== 'free' || !result.success) return result;
    try {
      const canvasDims = getCanvasDimensions(RENDER_TIERS[getTierSequence(process.env.RENDER_QUALITY || 'high')[0]], aspectRatio);
      const endCard = buildEndCardArgs(outputPath, plan, canvasDims.w, canvasDims.h);
      if (!endCard) return result;

      // Generate end-card video
      await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', endCard.args, { timeout: 30000 });

      // Concat main + end-card
      const concatPath = outputPath.replace(/\.mp4$/, '_concat.mp4');
      const listPath = outputPath.replace(/\.mp4$/, '_list.txt');
      await fs.promises.writeFile(listPath, `file '${outputPath.replace(/'/g, "'\\''")}'\\nfile '${endCard.endCardPath.replace(/'/g, "'\\''")}'`);

      await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
        '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
        '-c', 'copy', '-movflags', '+faststart', concatPath,
      ], { timeout: 30000 });

      // Replace original with concatenated version
      await fs.promises.rename(concatPath, outputPath);
      // Cleanup
      await fs.promises.unlink(endCard.endCardPath).catch(() => {});
      await fs.promises.unlink(listPath).catch(() => {});

      console.log('[FFmpeg] End-card appended (1.5s, free plan)');
    } catch (err) {
      console.warn('[FFmpeg] End-card failed (non-fatal):', err.message);
    }
    return result;
  }

  // ── Standard render with retry ladder ──────────────────────────────────
  const quality = process.env.RENDER_QUALITY || 'high';
  const tierSequence = getTierSequence(quality);
  let lastError;

  for (let ti = 0; ti < tierSequence.length; ti++) {
    const tierName = tierSequence[ti];
    const tier = RENDER_TIERS[tierName];
    const fps = getTierFps(tier, sourceFps);
    const { w: canvasW, h: canvasH } = getCanvasDimensions(tier, aspectRatio);

    console.log(`[FFmpeg] Render tier ${ti + 1}/${tierSequence.length}: ${tierName} (${canvasW}x${canvasH} @ ${fps}fps, preset=${tier.preset} crf=${tier.crf})`);

    try {
      // ── Build filter_complex for this tier ─────────────────────────────
      const isWordPopAnimation = captions && captions.animation === 'word-pop';
      const smartZoomActive = smartZoom && smartZoom.enabled;
      const isReaction = videoZoom === 'reaction' && reactionLayout;
      const isFullFrame = videoZoom === 'fullframe';
      const isFit = videoZoom === 'fit' || videoZoom === 'auto';
      const zoomFactor = (isFullFrame || isReaction || isFit) ? 1.0 : videoZoom === 'immersive' ? 1.35 : videoZoom === 'fill' ? 1.15 : 1.0;

      // ── ZOOM BUDGET ──
      // Compute the effective crop zoom from the aspect ratio conversion so we
      // can cap the total magnification. A 1920x1080 (16:9) source going to
      // 1080x1920 (9:16) canvas needs to scale height from 1080→1920 (1.78x),
      // which crops ~44% of the width. Adding border crop + face-follow zoom
      // on top makes it unreadable.
      //
      // We probe the source dimensions to know the actual crop ratio, then
      // decide how much room is left for border crop and face-follow zoom.
      let sourceW = 1920, sourceH = 1080; // defaults, overridden by probe
      try {
        const { stdout } = await execFileAsync('ffprobe', [
          '-v', 'error', '-select_streams', 'v:0',
          '-show_entries', 'stream=width,height', '-of', 'csv=p=0', inputPath,
        ], { timeout: 5000 });
        const [pw, ph] = stdout.trim().split(',').map(Number);
        if (pw > 0 && ph > 0) { sourceW = pw; sourceH = ph; }
      } catch { /* use defaults */ }

      // Effective crop zoom from aspect conversion (how much the source is
      // magnified to fill the canvas). For 16:9→9:16 this is ~1.78x.
      const sourceAspect = sourceW / sourceH;
      const canvasAspect = canvasW / canvasH;
      let cropZoom;
      if (isFullFrame || isFit) {
        // Fullframe: source is scaled so its SHORT dimension fills the canvas.
        // For landscape→portrait: scale by canvasH/sourceH, then crop width.
        if (sourceAspect > canvasAspect) {
          // Landscape source → portrait canvas: height is the binding dimension
          cropZoom = canvasH / sourceH;
        } else {
          cropZoom = canvasW / sourceW;
        }
      } else {
        cropZoom = 1.0;
      }

      // Border crop: reduce when crop zoom is already high to stay within budget
      const MAX_TOTAL_ZOOM = 3.2;
      let borderCrop;
      if (isFullFrame || isReaction) {
        // With high crop zoom, reduce border crop to avoid losing too much content
        const borderBudget = MAX_TOTAL_ZOOM / Math.max(cropZoom, 1);
        borderCrop = borderBudget < 1.15 ? 40 : 80; // 40px if tight, 80px otherwise
      } else {
        borderCrop = 50;
      }

      // Face-follow zoom: only allowed if we have budget left
      const borderZoom = sourceW > 0 ? sourceW / (sourceW - borderCrop * 2) : 1.0;
      const zoomBeforeFollow = cropZoom * borderZoom * zoomFactor;
      // How much room is left for face follow (min 1.0 = pan only, no zoom)
      const followZoomBudget = Math.max(1.0, Math.min(1.20, MAX_TOTAL_ZOOM / zoomBeforeFollow));

      const totalZoom = zoomBeforeFollow * followZoomBudget;
      const visiblePct = Math.round((1 / (totalZoom * totalZoom)) * 100 * (sourceAspect / canvasAspect > 1 ? canvasAspect / sourceAspect * 100 : 100)) || 100;

      // Sanity check: if fullframe would show less than 25% of the source
      // width, downgrade to fit (full image + blurred padding) automatically.
      // Better to show bands than an unreadable extreme close-up.
      let effectiveVideoZoom = videoZoom;
      if (isFullFrame && sourceAspect > canvasAspect) {
        // How much of the source width is visible after crop
        const afterBorderW = sourceW - borderCrop * 2;
        const scaleToFillH = canvasH / (sourceH - borderCrop * 2);
        const scaledW = afterBorderW * scaleToFillH;
        const visibleWidthPct = Math.round((canvasW / scaledW) * 100);
        if (visibleWidthPct < 25) {
          console.log(`[FFmpeg] SANITY CHECK: fullframe would show only ${visibleWidthPct}% of source width — downgrading to fit`);
          // Mutate the mode flags for this render pass
          effectiveVideoZoom = 'fit';
        }
      }

      console.log(`[FFmpeg] ZOOM BUDGET: source=${sourceW}x${sourceH} crop=${cropZoom.toFixed(2)}x border=${borderZoom.toFixed(2)}x (${borderCrop}px) follow=${followZoomBudget.toFixed(2)}x total=${totalZoom.toFixed(2)}x mode=${effectiveVideoZoom}`);

      let filterComplex;
      let mapVideo;

      // ── Step 1: Scale/Crop compositing ─────────────────────────────────
      // Use effectiveVideoZoom (may have been downgraded by sanity check)
      const useFullFrame = effectiveVideoZoom === 'fullframe';
      const useFit = effectiveVideoZoom === 'fit' || effectiveVideoZoom === 'auto';

      if (isReaction) {
        // REACTION MODE: facecam top (~32%), content bottom (~68%), full width.
        // Crops the webcam region and the content region separately from the
        // source, scales each to fill canvas width, stacks vertically.
        const face = reactionLayout.faceRegion;
        const facePct = 0.32; // facecam gets 32% of canvas height
        const contentPct = 1 - facePct;
        const faceH = Math.round(canvasH * facePct);
        const contentH = canvasH - faceH;

        // Divider line: 2px dark line at the junction
        const divH = 2;

        filterComplex = [
          // Crop face region from source, scale to fill canvas width, crop to exact faceH
          `[0:v]fps=${fps},crop=${face.w}:${face.h}:${face.x}:${face.y},scale=${canvasW}:${faceH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${faceH}:(iw-${canvasW})/2:(ih-${faceH})/2,setsar=1[facecam]`,
          // Crop content: full source minus border, scale to fill canvas width, crop to contentH
          `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCrop},scale=${canvasW}:${contentH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${contentH}:(iw-${canvasW})/2:(ih-${contentH})/2,setsar=1[content]`,
          // Stack: facecam on top, content on bottom
          `[facecam][content]vstack=inputs=2[composed]`,
        ].join(';');
        mapVideo = '[composed]';
        console.log(`[FFmpeg] Reaction layout: face(${face.x},${face.y},${face.w}x${face.h}) → ${canvasW}x${faceH} top, content → ${canvasW}x${contentH} bottom`);
      } else if (useFullFrame) {
        // FULL-FRAME MODE: center crop directly to 9:16 (no blurred padding).
        filterComplex = `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCrop},scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:(ih-${canvasH})/2,setsar=1[composed]`;
        mapVideo = '[composed]';
        console.log(`[FFmpeg] Full-frame crop: ${canvasW}x${canvasH}, border trim ${borderCrop}px`);
      } else if (useFit) {
        // FIT MODE: preserve full image, scale to fill width, cinematic blurred padding.
        // Deep blur (sigma=24), dark (-0.45), heavily desaturated (s=0.5) → neutral texture.
        // Used for gameplay, IRL wide shots — content stays fully visible.
        filterComplex = [
          `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCrop},split=2[fitfg][fitbg]`,
          `[fitbg]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=24,eq=brightness=-0.45,hue=s=0.5,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[fitbgout]`,
          `[fitfg]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[fitfgout]`,
          `[fitbgout][fitfgout]overlay=(W-w)/2:(H-h)/2[composed]`,
        ].join(';');
        mapVideo = '[composed]';
        console.log(`[FFmpeg] Fit mode: full content + cinematic blurred padding (sigma=24)`);
      } else if (isWordPopAnimation) {
        if (zoomFactor > 1.0) {
          const bigW = Math.round(canvasW * zoomFactor);
          const bigH = Math.round(canvasH * zoomFactor);
          filterComplex = [
            `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCrop},split=2[wpfg][wpbg]`,
            `[wpbg]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=6,eq=brightness=-0.45,hue=s=0.85,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[wpbgout]`,
            `[wpfg]scale=${bigW}:${bigH}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[wpfgscaled]`,
            `[wpbgout][wpfgscaled]overlay=(W-w)/2:(H-h)/2[composed]`,
          ].join(';');
        } else {
          filterComplex = [
            `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCrop},split=2[wpfg2][wpbg2]`,
            `[wpbg2]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=6,eq=brightness=-0.45,hue=s=0.85,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[wpbgout2]`,
            `[wpfg2]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[wpfgout2]`,
            `[wpbgout2][wpfgout2]overlay=(W-w)/2:(H-h)/2[composed]`,
          ].join(';');
        }
        mapVideo = '[composed]';
      } else if (smartZoomActive) {
        filterComplex = `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCrop},scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:(ih-${canvasH})/2,setsar=1[composed]`;
        mapVideo = '[composed]';
      } else {
        const fgW = Math.round(canvasW * zoomFactor);
        const fgH = Math.round(canvasH * zoomFactor);
        // Background: blurred letterbox when backgroundBlur=true, solid black when false
        const bgChain = backgroundBlur
          ? `[srcbg]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=6,eq=brightness=-0.45,hue=s=0.85,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[bg]`
          : `[srcbg]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:(ih-${canvasH})/2,drawbox=x=0:y=0:w=${canvasW}:h=${canvasH}:color=black:t=fill,setsar=1[bg]`;
        filterComplex = [
          `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCrop},split=2[srcfg][srcbg]`,
          bgChain,
          `[srcfg]scale=${fgW}:${fgH}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[fg]`,
          `[bg][fg]overlay=(W-w)/2:(H-h)/2[composed]`,
        ].join(';');
        mapVideo = '[composed]';
      }

      // ── Step 2: Smart Zoom (scale/crop — before eq so text stays crisp) ──
      if (smartZoom && smartZoom.enabled) {
        let zoomChain = null;
        if (smartZoom.mode === 'follow' && Array.isArray(smartZoom.faceKeyframes) && smartZoom.faceKeyframes.length >= 2) {
          // Pass the zoom budget so follow doesn't add zoom when crop is already tight
          zoomChain = buildFollowFaceFilter(mapVideo, '[zoomed]', canvasW, canvasH, smartZoom.faceKeyframes, clipDuration, followZoomBudget);
          console.log(`[FFmpeg] Face follow: zoom=${followZoomBudget.toFixed(2)}x (${followZoomBudget <= 1.01 ? 'PAN ONLY' : 'pan+zoom'})`);
        }
        if (!zoomChain) {
          const fallbackMode = (smartZoom.mode === 'follow') ? 'micro' : (smartZoom.mode || 'micro');
          zoomChain = buildSmartZoomFilter(mapVideo, '[zoomed]', canvasW, canvasH, clipDuration, fallbackMode, audioPeaks);
        }
        if (zoomChain) {
          filterComplex += `;${zoomChain}`;
          mapVideo = '[zoomed]';
        }
      }

      // ── Step 3: Exposure correction (eq — after scale/crop, before subtitles) ──
      if (exposureFilter) {
        filterComplex += `;${mapVideo}${exposureFilter}[exposed]`;
        mapVideo = '[exposed]';
      }

      // ── Step 3b: Bright first frame (dark opening → progressive lift on first 0.5s) ──
      if (openingDark) {
        filterComplex += `;${buildBrightFirstFrameFilter(mapVideo, '[bff]')}`;
        mapVideo = '[bff]';
      }

      // ── Step 4: Unsharp (HIGH tiers only, after eq, before subtitles) ──
      if (tier.unsharp) {
        filterComplex += `;${mapVideo}unsharp=5:5:0.25:3:3:0.0[sharpened]`;
        mapVideo = '[sharpened]';
      }

      // ── Step 5: ASS subtitles (burned AFTER scale, so text is crisp) ──
      const extraInputs = [];
      if (captions && captions.assFilePath) {
        filterComplex += `;${mapVideo}ass='${escapePath(captions.assFilePath)}':fontsdir='/usr/share/fonts'[captioned]`;
        mapVideo = '[captioned]';
      }

      // ── Step 6: Tag overlay ──
      if (tag && tag.overlayPng && typeof tag.overlayPng === 'string' && tag.overlayPng.startsWith('data:image/png')) {
        const jobDir = path.dirname(outputPath);
        const tagPngPath = path.join(jobDir, 'tag-overlay.png');
        const base64Data = tag.overlayPng.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(tagPngPath, Buffer.from(base64Data, 'base64'));
        extraInputs.push({
          pngPath: tagPngPath, startTime: 0, endTime: clipDuration, isTagOverlay: true,
          anchorX: tag.overlayAnchorX || 0, anchorY: tag.overlayAnchorY || 0,
        });
      } else if (tag) {
        const tagFilter = buildTagFilter(tag, canvasW, canvasH, mapVideo);
        if (tagFilter) {
          if (typeof tagFilter === 'string') {
            filterComplex += `;${mapVideo}${tagFilter}[tagged]`;
          } else if (tagFilter.complex) {
            filterComplex += `;${tagFilter.chain}[tagged]`;
          }
          mapVideo = '[tagged]';
        }
      }

      // ── Step 7: Hook overlay ──
      let hookOverlayData = null;
      const hookDisplayLength = (hook && hook.length > 0) ? hook.length : clipDuration;
      if (hook && hook.enabled && hook.textEnabled !== false && hook.text) {
        const jobDir = path.dirname(outputPath);
        hookOverlayData = await prepareHookOverlay(hook.text, hookDisplayLength, canvasW, canvasH, hook.textPosition || 15, jobDir, hook);
        if (hookOverlayData) {
          const hookEndTime = Math.min(hookDisplayLength + 1, clipDuration);
          extraInputs.push({
            pngPath: hookOverlayData.pngPath, startTime: 0, endTime: hookEndTime,
            isHookOverlay: true, hookLength: hookDisplayLength,
            isCapsuleOnly: hookOverlayData.isCapsuleOnly, textPosition: hookOverlayData.textPosition,
          });
        } else {
          const hookStyle = hook.style || 'shock';
          const hookFontColor = hookStyle === 'shock' ? '0xFF4444' : hookStyle === 'curiosity' ? '0xFACC15' : '0xFFFFFF';
          const posPct = hook.textPosition || 18;
          const safeText = escapeDrawtext(hook.text);
          const enableExpr = hookDisplayLength < clipDuration
            ? `:enable='between(t\\,0\\,${(hookDisplayLength + 0.3).toFixed(2)})'`
            : '';
          filterComplex += `;${mapVideo}drawtext=text='${safeText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=48:fontcolor=0x${hookFontColor}@0xff:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*${posPct}/100-text_h/2${enableExpr}[hooktext]`;
          mapVideo = '[hooktext]';
        }
      }

      // ── Step 8: Watermark ──
      // Free plan: NO persistent watermark (TikTok flags logos as "unoriginal").
      // Attribution moved to end-card only (appended after render).
      // Custom logos (Pro/Studio) still applied if provided.
      if (watermark && plan !== 'free' && watermark.logoPath) {
        const watermarkFilter = buildWatermarkFilter(watermark, watermarkPosition, plan, clipDuration);
        if (watermarkFilter) {
          filterComplex += `;${mapVideo}${watermarkFilter}[watermarked]`;
          mapVideo = '[watermarked]';
        }
      }

      // ── Wire PNG overlays ──
      const hookOverlayEntry = extraInputs.find(e => e.isHookOverlay);
      const tagOverlayEntry = extraInputs.find(e => e.isTagOverlay);
      let hookInputIndex = -1;
      let tagInputIndex = -1;

      const args = ['-y'];
      args.push('-ss', String(startTime));
      args.push('-i', inputPath);
      let inputIdx = 1;
      for (const overlay of extraInputs) {
        const ts = Math.max(0, overlay.startTime);
        const td = Math.max(0.01, overlay.endTime - overlay.startTime);
        if (overlay.isHookOverlay) hookInputIndex = inputIdx;
        if (overlay.isTagOverlay) tagInputIndex = inputIdx;
        args.push('-loop', '1', '-t', td.toFixed(3), '-itsoffset', ts.toFixed(3), '-i', overlay.pngPath);
        inputIdx++;
      }

      if (tagOverlayEntry && tagInputIndex >= 0) {
        const anchorX = tagOverlayEntry.anchorX || 0;
        const anchorY = tagOverlayEntry.anchorY || 0;
        filterComplex += `;[${tagInputIndex}:v]format=rgba[tagalpha]`;
        filterComplex += `;${mapVideo}[tagalpha]overlay=${anchorX}:${anchorY}:format=auto[tagged]`;
        mapVideo = '[tagged]';
      }

      if (hookOverlayEntry && hookInputIndex >= 0) {
        const fadeIn = 0.3;
        const fadeOut = 0.3;
        const hLen = hookOverlayEntry.hookLength || clipDuration;
        let fadeFilters = `fade=t=in:st=0:d=${fadeIn}:alpha=1`;
        if (hLen < clipDuration) {
          fadeFilters += `,fade=t=out:st=${hLen.toFixed(2)}:d=${fadeOut}:alpha=1`;
        }
        // Browser overlays are always captured at 1080x1920 — rescale to the
        // active tier canvas so the capsule stays proportional on 720p fallbacks.
        const CAPTURE_W = 1080;
        const hookScale = canvasW / CAPTURE_W;
        const hookScaleFilter = hookScale !== 1
          ? `scale=trunc(iw*${hookScale.toFixed(4)}/2)*2:-2:flags=lanczos,`
          : '';
        filterComplex += `;[${hookInputIndex}:v]format=rgba,${hookScaleFilter}${fadeFilters}[hookalpha]`;
        const isCapsule = hookOverlayEntry.isCapsuleOnly;
        const posPct = hookOverlayEntry.textPosition || 18;
        const overlayX = isCapsule ? '(W-w)/2' : '0';
        // Render parity: the live preview anchors the capsule TOP edge at posPct%
        // (CSS `top: pct%`, no translateY — see live-preview.tsx). The browser PNG
        // has ~extraPad transparent padding above the capsule (sticker: round(4*1080/280)=15px,
        // outline: ~31px). Offset so the visible capsule top lands at posPct%.
        const hookGlowPad = Math.round(20 * hookScale);
        const overlayY = isCapsule ? `H*${posPct}/100-${hookGlowPad}` : '0';
        filterComplex += `;${mapVideo}[hookalpha]overlay=${overlayX}:${overlayY}:format=auto[hooked]`;
        mapVideo = '[hooked]';
      }

      // ── Terminal format=yuv420p ──
      filterComplex += `;${mapVideo}format=yuv420p[vout]`;
      mapVideo = '[vout]';

      // ── Audio chain: base filters ──
      const audioFilters = [];

      const audioShift = buildAudioShiftFilters(48000);
      audioFilters.push(...audioShift.filters);
      console.log('[FFmpeg] Audio fingerprint shift: +3% asetrate/atempo (anti-duplicate)');

      if (audioEnhance) {
        audioFilters.push('highpass=f=80', 'afftdn=nf=-25', 'loudnorm=I=-14:LRA=11:TP=-1.5:linear=false:dual_mono=true');
        console.log('[FFmpeg] Audio enhancement enabled: highpass + denoise + loudnorm');
      }
      const bassFilters = buildBassBoostFilters({ bassBoost });
      if (bassFilters.length > 0) {
        audioFilters.push(...bassFilters);
      }
      const speedFilters = buildSpeedRampFilters({ speedRamp });
      if (speedFilters.audio.length > 0) {
        audioFilters.push(...speedFilters.audio);
      }

      // ── Voiceover: add MP3 inputs BEFORE any output options ──
      // FFmpeg requires ALL -i inputs before -filter_complex/-map/-c:v etc.
      const hasVoiceover = Array.isArray(voiceoverPaths) && voiceoverPaths.length > 0;
      let voInputIdxStart = inputIdx;

      if (hasVoiceover) {
        for (const vo of voiceoverPaths) {
          args.push('-i', vo.path);
          inputIdx++;
        }
        console.log(`[FFmpeg] Voiceover: added ${voiceoverPaths.length} MP3 inputs at indices ${voInputIdxStart}-${inputIdx - 1}`);
      }

      // ── Now add all OUTPUT options: -t, -filter_complex, -map, codecs ──
      args.push('-t', String(clipDuration));

      if (hasVoiceover) {
        // Build audio filter graph and merge it into the video filter_complex
        const origChain = audioFilters.length > 0
          ? `[0:a]${audioFilters.join(',')}[abase]`
          : `[0:a]acopy[abase]`;

        const voLabels = [];
        const voFilterParts = [];
        for (let vi = 0; vi < voiceoverPaths.length; vi++) {
          const vo = voiceoverPaths[vi];
          const delayMs = Math.round(vo.startTime * 1000);
          const idx = voInputIdxStart + vi;
          const label = `vo${vi}`;
          voFilterParts.push(`[${idx}:a]adelay=${delayMs}|${delayMs},volume=1.8,apad=whole_dur=${clipDuration}[${label}]`);
          voLabels.push(`[${label}]`);
        }

        let audioFC = origChain + ';' + voFilterParts.join(';');

        // Sidechain ducking: split VO → compress original → mix
        if (voLabels.length === 1) {
          const sl = voLabels[0].replace(/[\[\]]/g, '');
          audioFC += `;[${sl}]asplit=2[${sl}sc][${sl}copy]`;
          audioFC += `;[abase][${sl}sc]sidechaincompress=threshold=0.02:ratio=4:attack=200:release=200:level_sc=1[ducked]`;
          audioFC += `;[ducked][${sl}copy]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`;
        } else {
          audioFC += `;${voLabels.join('')}amix=inputs=${voLabels.length}:duration=longest:normalize=0[vomix]`;
          audioFC += `;[vomix]asplit=2[vomixsc][vomixcopy]`;
          audioFC += `;[abase][vomixsc]sidechaincompress=threshold=0.02:ratio=4:attack=200:release=200:level_sc=1[ducked]`;
          audioFC += `;[ducked][vomixcopy]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`;
        }

        // Combine video + audio filter graphs into one -filter_complex
        filterComplex += ';' + audioFC;
        args.push('-filter_complex', filterComplex);
        args.push('-map', mapVideo);
        args.push('-map', '[aout]');
        args.push(...buildCommonEncodingArgs(tier, fps, clipDuration));
        args.push('-c:a', 'aac', '-b:a', tier.audioBitrate, '-ar', '48000', '-ac', '2');

        console.log(`[FFmpeg] Voiceover mix: ${voiceoverPaths.length} lines with sidechaincompress ducking`);
      } else {
        // No voiceover — video filter_complex + simple -af audio chain
        args.push('-filter_complex', filterComplex);
        args.push('-map', mapVideo);
        args.push('-map', '0:a?');
        args.push(...buildCommonEncodingArgs(tier, fps, clipDuration));
        if (audioFilters.length > 0) {
          args.push('-af', audioFilters.join(','));
        }
        args.push('-c:a', 'aac', '-b:a', tier.audioBitrate, '-ar', '48000', '-ac', '2');
      }

      if (speedFilters.video.length > 0) {
        const vfIdx = args.lastIndexOf('-vf');
        if (vfIdx !== -1 && args[vfIdx + 1]) {
          args[vfIdx + 1] = args[vfIdx + 1] + ',' + speedFilters.video.join(',');
        } else {
          args.push('-vf', speedFilters.video.join(','));
        }
      }
      args.push('-max_muxing_queue_size', '512');
      args.push(outputPath);

      let result = await execRender(args, outputPath, timeout, tierName);

      // ── Post-render size check ──
      // If the file exceeds MAX_OUTPUT_BYTES, re-encode with a calculated
      // bitrate that targets 90% of the limit. This ensures the upload to
      // Supabase Storage never fails due to file size.
      try {
        const stat = await fs.promises.stat(outputPath);
        const sizeMB = stat.size / (1024 * 1024);
        const bitrateMbps = (stat.size * 8) / (clipDuration * 1000000);
        console.log(`[FFmpeg] Output size: ${sizeMB.toFixed(1)}MB (${bitrateMbps.toFixed(1)}Mbps, ${clipDuration.toFixed(1)}s)`);
        result.outputSizeMB = Math.round(sizeMB * 10) / 10;
        result.outputBitrateMbps = Math.round(bitrateMbps * 10) / 10;

        if (stat.size > MAX_OUTPUT_BYTES) {
          console.log(`[FFmpeg] Output too large (${sizeMB.toFixed(1)}MB > ${MAX_OUTPUT_BYTES / 1024 / 1024}MB) — re-encoding with lower bitrate`);
          const targetBytes = MAX_OUTPUT_BYTES * 0.9; // 90% of limit for safety margin
          const targetBitrate = Math.round((targetBytes * 8) / clipDuration); // bits/sec
          const targetBitrateK = Math.round(targetBitrate / 1000); // kbps
          const reEncodePath = outputPath.replace(/\.mp4$/, '_resized.mp4');

          // Use 'ultrafast' preset + 1 thread to minimize memory footprint.
          // The source is already a high-quality render — re-encode is just
          // a bitrate reduction, not a quality improvement.
          await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', [
            '-y', '-i', outputPath,
            '-c:v', 'libx264', '-preset', 'ultrafast',
            '-b:v', `${targetBitrateK}k`, '-maxrate', `${targetBitrateK}k`, '-bufsize', `${targetBitrateK * 2}k`,
            '-c:a', 'copy',
            '-threads', '1',
            '-movflags', '+faststart',
            reEncodePath,
          ], { timeout: 180000, maxBuffer: 10 * 1024 * 1024 });

          // Delete the oversized original BEFORE renaming (free memory/disk)
          await fs.promises.unlink(outputPath).catch(() => {});
          await fs.promises.rename(reEncodePath, outputPath);
          const newStat = await fs.promises.stat(outputPath);
          const newSizeMB = newStat.size / (1024 * 1024);
          console.log(`[FFmpeg] Re-encoded: ${sizeMB.toFixed(1)}MB → ${newSizeMB.toFixed(1)}MB (target ${targetBitrateK}kbps)`);
          result.outputSizeMB = Math.round(newSizeMB * 10) / 10;
          result.outputBitrateMbps = Math.round((newStat.size * 8) / (clipDuration * 1000000) * 10) / 10;
          result.reEncoded = true;
        }
      } catch (sizeErr) {
        console.warn(`[FFmpeg] Size check failed (non-fatal): ${sizeErr.message}`);
      }

      result.openingLuma = openingLuma;
      result.openingDark = openingDark;
      return maybeAppendEndCard(result);
    } catch (err) {
      lastError = err;
      if (isOOMError(err) && ti < tierSequence.length - 1) {
        console.log(`[FFmpeg] fallback tier ${ti + 2}: ${tierName} OOM → trying ${tierSequence[ti + 1]}`);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared FFmpeg execution
// ─────────────────────────────────────────────────────────────────────────────

async function execRender(args, outputPath, timeout = 300000, tierName = 'unknown') {
  const cmd = buildCommand(args);
  console.log(`[FFmpeg] Running: ${cmd.substring(0, 300)}...`);

  try {
    const { stderr } = await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', args, {
      timeout,
      maxBuffer: 1024 * 1024 * 100,
    });

    if (stderr && stderr.includes('frame=')) {
      const frameMatch = stderr.match(/frame=\s*(\d+)/);
      if (frameMatch) {
        console.log(`[FFmpeg] Progress: frame ${frameMatch[1]}`);
      }
    }

    console.log(`[FFmpeg] Render completed successfully: ${outputPath}`);
    return { success: true, outputPath, qualityTier: tierName };
  } catch (err) {
    // Extract diagnostic info
    const killed = err.killed || false;
    const signal = err.signal || 'none';
    const code = err.code || 'unknown';
    const stderrContent = err.stderr || '';

    // Get the last 500 chars of stderr (where actual errors appear after progress)
    // Also look for lines that DON'T start with \r (progress lines start with \r)
    const stderrLines = stderrContent.split('\n');
    const errorLines = stderrLines.filter(l => !l.startsWith('\r') && l.trim().length > 0);
    const meaningfulErrors = errorLines.slice(-10).join('\n');

    const diagnostic = `[killed=${killed} signal=${signal} code=${code}] ${meaningfulErrors || stderrContent.slice(-500)}`;
    console.error('[FFmpeg Error]', diagnostic);
    console.error('[FFmpeg Error] Command:', cmd);
    const renderError = new Error(`FFmpeg render failed: ${diagnostic}`);
    renderError.killed = killed;
    renderError.signal = signal;
    renderError.exitCode = typeof code === 'number' ? code : null;
    throw renderError;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PNG Caption Overlay Chain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a filter_complex chain that overlays a sequence of caption PNGs
 * onto the video track, each gated by its time window.
 *
 * @param {Array}  overlays - [{ pngPath, startTime, endTime, x, y }]
 * @param {string} inputLabel - current video label (e.g. '[composed]')
 * @param {number} firstInputIdx - FFmpeg input index of the first PNG
 * @returns {{chain: string, nextLabel: string, inputs: string[]}}
 */
function buildPngCaptionChain(overlays, inputLabel, firstInputIdx) {
  const inputs = [];
  const filters = [];
  let currentLabel = inputLabel;

  for (let i = 0; i < overlays.length; i++) {
    const ov = overlays[i];
    inputs.push(ov); // keep full overlay for args-building (needs timing)
    const pngInputIdx = firstInputIdx + i;
    const nextLabel = i === overlays.length - 1 ? '[cap_out]' : `[cap_${i}]`;

    // Trim the overlay to its active window. The input is already offset
    // via -itsoffset so its PTS matches the timeline; enable='between(...)'
    // guards against any drift.
    const ts = Math.max(0, ov.startTime);
    const te = Math.max(ts + 0.01, ov.endTime);
    const enable = `between(t,${ts.toFixed(3)},${te.toFixed(3)})`;

    filters.push(
      `[${pngInputIdx}:v]format=rgba[cap_src_${i}]`,
      `${currentLabel}[cap_src_${i}]overlay=${ov.x}:${ov.y}:enable='${enable}':format=auto:eof_action=pass:repeatlast=0${nextLabel}`
    );
    currentLabel = nextLabel;
  }

  return {
    chain: filters.join(';'),
    nextLabel: currentLabel,
    inputs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag / Credit Overlay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build FFmpeg drawtext filter for streamer tag/credit overlay.
 *
 * IMPORTANT: TikTok explicitly flags permanent badges/logos/watermarks as
 * "unoriginal content". The default `credit-text` style uses plain text with
 * a thin shadow — no box, no badge, no logo. This looks like a native TikTok
 * text overlay, not a third-party watermark.
 *
 * Legacy badge styles (viral-glow, twitch-minimal, kick-minimal) are kept
 * for users who explicitly select them, but are no longer the default.
 *
 * @param {Object} tagConfig - {style, authorName, authorHandle}
 * @param {number} canvasW - Canvas width
 * @param {number} canvasH - Canvas height
 * @returns {string|null} FFmpeg filter string or null
 */
function buildTagFilter(tagConfig, canvasW = 720, canvasH = 1280, inputLabel = null, contentAreaH = null) {
  if (!tagConfig || tagConfig.style === 'none' || (!tagConfig.authorName && !tagConfig.authorHandle)) {
    return null;
  }

  const handle = tagConfig.authorHandle
    ? `@${tagConfig.authorHandle.replace(/^@/, '')}`
    : tagConfig.authorName || '';
  const displayText = escapeDrawtext(handle);
  const fontFile = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const twitchLogoFile = path.join(__dirname, '..', 'assets', 'twitch-logo.png');

  // Common dimensions — scaled by tagSize (50-150%, default 100)
  const sizeScale = Math.max(0.5, Math.min(1.5, (tagConfig.size || 100) / 100));
  const fontSize = Math.round(canvasW * 0.034 * sizeScale);
  const logoH = Math.round(fontSize * 1.2);
  const marginX = Math.round(canvasW * 0.04);
  const marginY = Math.round(canvasH * 0.015);
  const boxPad = Math.round(fontSize * 0.50);
  const logoGap = Math.round(fontSize * 0.40);
  const logoSpace = logoH + logoGap;
  const bottomEdge = contentAreaH || canvasH;
  const badgeY = bottomEdge - marginY - logoH - boxPad * 2;
  const textX = marginX + boxPad + logoSpace;
  const textY = badgeY + boxPad + Math.round((logoH - fontSize) / 2);
  const logoX = marginX + boxPad;
  const logoY = badgeY + boxPad;
  const badgeX = marginX;
  const badgeH = logoH + boxPad * 2;

  switch (tagConfig.style) {
    // ── NEW DEFAULT: plain text credit, no badge/box/logo ──
    // Looks like a native TikTok text overlay. Not flagged as watermark.
    // Shows "@handle" in small semi-transparent white text, bottom-left,
    // with a thin dark shadow for readability. Fades out after 4s.
    case 'credit-text': {
      const creditFontSize = Math.round(canvasW * 0.030 * sizeScale);
      const creditMarginX = Math.round(canvasW * 0.04);
      const creditY = bottomEdge - Math.round(canvasH * 0.06);
      return `drawtext=text='${displayText}':fontfile=${fontFile}:fontcolor=white@0.70:fontsize=${creditFontSize}:x=${creditMarginX}:y=${creditY}:shadowcolor=black@0.50:shadowx=1:shadowy=1:enable='lte(t\\,4)'`;
    }

    case 'viral-glow': {
      const chain = [
        `movie=${twitchLogoFile},scale=-1:${logoH},format=yuva420p[twvg]`,
        `${inputLabel}drawtext=text='${displayText}':fontfile=${fontFile}:fontcolor=white:fontsize=${fontSize}:x=${textX}:y=${textY}:box=1:boxcolor=0x000000@0.75:boxborderw=${boxPad}:borderw=1:bordercolor=0x9146FF@0.9:shadowcolor=0x9146FF@0.5:shadowx=0:shadowy=0,drawbox=x=${badgeX}:y=${badgeY}:w=${logoSpace + boxPad}:h=${badgeH}:color=0x000000@0.75:t=fill[vgtxt]`,
        `[vgtxt][twvg]overlay=${logoX}:${logoY}:format=auto`,
      ].join(';');
      return { chain, complex: true };
    }

    case 'kick-glow': {
      const chain = [
        `movie=${twitchLogoFile},scale=-1:${logoH},format=yuva420p[twkg]`,
        `${inputLabel}drawtext=text='${displayText}':fontfile=${fontFile}:fontcolor=white:fontsize=${fontSize}:x=${textX}:y=${textY}:box=1:boxcolor=0x000000@0.75:boxborderw=${boxPad}:borderw=1:bordercolor=0x53FC18@0.9:shadowcolor=0x53FC18@0.5:shadowx=0:shadowy=0,drawbox=x=${badgeX}:y=${badgeY}:w=${logoSpace + boxPad}:h=${badgeH}:color=0x000000@0.75:t=fill[kgtxt]`,
        `[kgtxt][twkg]overlay=${logoX}:${logoY}:format=auto`,
      ].join(';');
      return { chain, complex: true };
    }

    case 'twitch-minimal': {
      const chain = [
        `movie=${twitchLogoFile},scale=-1:${logoH},format=yuva420p,colorlevels=rimin=0.3:gimin=0.3:bimin=0.3[twtm]`,
        `${inputLabel}drawtext=text='${displayText}':fontfile=${fontFile}:fontcolor=white@0.85:fontsize=${fontSize}:x=${textX}:y=${textY}:box=1:boxcolor=0x000000@0.70:boxborderw=${boxPad}:borderw=1:bordercolor=0x9146FF@0.40,drawbox=x=${badgeX}:y=${badgeY}:w=${logoSpace + boxPad}:h=${badgeH}:color=0x000000@0.70:t=fill[tmtxt]`,
        `[tmtxt][twtm]overlay=${logoX}:${logoY}:format=auto`,
      ].join(';');
      return { chain, complex: true };
    }

    case 'kick-minimal': {
      const chain = [
        `movie=${twitchLogoFile},scale=-1:${logoH},format=yuva420p,colorlevels=rimin=0.3:gimin=0.3:bimin=0.3[twkm]`,
        `${inputLabel}drawtext=text='${displayText}':fontfile=${fontFile}:fontcolor=white@0.85:fontsize=${fontSize}:x=${textX}:y=${textY}:box=1:boxcolor=0x000000@0.70:boxborderw=${boxPad}:borderw=1:bordercolor=0x53FC18@0.40,drawbox=x=${badgeX}:y=${badgeY}:w=${logoSpace + boxPad}:h=${badgeH}:color=0x000000@0.70:t=fill[kmtxt]`,
        `[kmtxt][twkm]overlay=${logoX}:${logoY}:format=auto`,
      ].join(';');
      return { chain, complex: true };
    }

    // Legacy support for old style IDs
    case 'badge-top':
    case 'banner-bottom': {
      const chain = [
        `movie=${twitchLogoFile},scale=-1:${logoH},format=yuva420p[twfb]`,
        `${inputLabel}drawtext=text='${displayText}':fontfile=${fontFile}:fontcolor=white:fontsize=${fontSize}:x=${textX}:y=${textY}:box=1:boxcolor=0x000000@0.75:boxborderw=${boxPad}:shadowcolor=0x9146FF@0.4:shadowx=0:shadowy=0,drawbox=x=${badgeX}:y=${badgeY}:w=${logoSpace + boxPad}:h=${badgeH}:color=0x000000@0.75:t=fill[fbtxt]`,
        `[fbtxt][twfb]overlay=${logoX}:${logoY}:format=auto`,
      ].join(';');
      return { chain, complex: true };
    }

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Watermark
// ─────────────────────────────────────────────────────────────────────────────

function buildWatermarkFilter(watermark, position, plan, clipDuration) {
  // Free plan: no persistent watermark (replaced by end-card).
  // Only custom logo watermarks for Pro/Studio users who upload one.
  if (!watermark.logoPath) return null;
  return null; // custom logo rendering not yet implemented
}

/**
 * Build FFmpeg end-card for free plan.
 * 1.5s card after the clip: dark bg with branding.
 * This REPLACES the persistent watermark — attribution without penalizing
 * the content during playback (TikTok flags persistent logos as unoriginal).
 * Pro/Studio: no end-card (paid advantage).
 */
function buildEndCardArgs(outputPath, plan, canvasW, canvasH) {
  if (plan !== 'free') return null;

  const endCardPath = outputPath.replace(/\.mp4$/, '_endcard.mp4');
  const titleSize = Math.round(canvasW * 0.06);
  const subSize = Math.round(canvasW * 0.032);
  const urlSize = Math.round(canvasW * 0.028);

  return {
    endCardPath,
    args: [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=0x0f172a:s=${canvasW}x${canvasH}:d=1.5:r=30`,
      '-vf', [
        // "Made with" subtitle
        `drawtext=text='Made with':fontsize=${subSize}:fontcolor=0x94a3b8@0.8:x=(w-tw)/2:y=(h/2)-${titleSize}-15`,
        // "VIRAL ANIMAL" title in amber
        `drawtext=text='VIRAL ANIMAL':fontsize=${titleSize}:fontcolor=0xf59e0b:x=(w-tw)/2:y=(h/2)-${Math.round(titleSize * 0.35)}`,
        // URL
        `drawtext=text='viralanimal.com':fontsize=${urlSize}:fontcolor=0x64748b@0.6:x=(w-tw)/2:y=(h/2)+${titleSize}+5`,
      ].join(','),
      '-t', '1.5',
      '-an',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
      endCardPath,
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Thumbnail & Metadata
// ─────────────────────────────────────────────────────────────────────────────

export async function extractThumbnail(inputPath, outputPath, atSecond = 0) {
  const args = [
    '-y',
    '-ss', String(atSecond),
    '-i', inputPath,
    '-vframes', '1',
    '-q:v', '2',
    outputPath,
  ];

  console.log(`[FFmpeg] Extracting thumbnail at ${atSecond}s`);

  try {
    await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', args, { timeout: 60000 });
    console.log(`[FFmpeg] Thumbnail extracted: ${outputPath}`);
    return { success: true, outputPath };
  } catch (err) {
    console.error('[FFmpeg Error]', err.message);
    throw new Error(`Thumbnail extraction failed: ${err.message}`);
  }
}

export async function getVideoMetadata(inputPath) {
  const args = [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=width,height,codec_type',
    '-of', 'json',
    inputPath,
  ];

  try {
    const { stdout } = await execFileAsync('ffprobe', args, { timeout: 30000 });
    const data = JSON.parse(stdout);

    return {
      duration: parseFloat(data.format?.duration || 0),
      width: data.streams?.[0]?.width,
      height: data.streams?.[0]?.height,
    };
  } catch (err) {
    console.error('[FFprobe Error]', err.message);
    throw new Error(`Failed to get video metadata: ${err.message}`);
  }
}

export async function checkFfmpegAvailability() {
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  const ffprobePath = 'ffprobe';

  try {
    const { stdout: ffmpegVersion } = await execFileAsync(ffmpegPath, ['-version'], {
      timeout: 5000,
    });
    const ffmpegOk = ffmpegVersion.includes('ffmpeg');

    let ffprobeOk = false;
    try {
      await execFileAsync(ffprobePath, ['-version'], { timeout: 5000 });
      ffprobeOk = true;
    } catch {
      ffprobeOk = false;
    }

    return { ffmpeg: ffmpegOk, ffprobe: ffprobeOk };
  } catch (err) {
    console.error('[System Check Error]', err.message);
    return { ffmpeg: false, ffprobe: false };
  }
}
