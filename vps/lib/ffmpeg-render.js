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
 * Handles video cutting, reframing, captioning, watermarking, and split-screen rendering
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

const RENDER_TIERS = {
  HIGH_60: {
    preset: 'faster', crf: 19, maxrate: '12M', bufsize: '24M',
    fps: 60, profile: 'high', level: '4.2',
    audioBitrate: '192k', unsharp: true, hd: true,
  },
  HIGH_30: {
    preset: 'faster', crf: 20, maxrate: '8M', bufsize: '16M',
    fps: 30, profile: 'high', level: '4.2',
    audioBitrate: '192k', unsharp: true, hd: true,
  },
  SAFE: {
    preset: 'veryfast', crf: 23, maxrate: '5M', bufsize: '10M',
    fps: 30, profile: 'high', level: '4.1',
    audioBitrate: '160k', unsharp: false, hd: false,
  },
  LAST_RESORT: {
    preset: 'ultrafast', crf: 26, maxrate: '4M', bufsize: '8M',
    fps: 30, profile: 'high', level: '4.1',
    audioBitrate: '160k', unsharp: false, hd: false,
  },
};

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

function buildCommonEncodingArgs(tier, fps) {
  const gop = fps === 60 ? 120 : 60;
  return [
    '-c:v', 'libx264',
    '-preset', tier.preset,
    '-crf', String(tier.crf),
    '-maxrate', tier.maxrate,
    '-bufsize', tier.bufsize,
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
async function prepareHookOverlay(hookText, hookLength, canvasW, canvasH, textPosition = 15, jobDir, hook = {}) {
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
    //   - Zoom amount: 8% (just enough to feel the hit, not distracting)
    //   - Zoom-in: 200ms ease-out (fast start, smooth stop)
    //   - Hold: 100ms at peak
    //   - Zoom-out: 400ms slow ease-out (smooth return, no snap)
    //   - Total cycle: ~700ms
    //   - Max 3 punches per clip (less = more pro)
    //   - No baseline breathing (stays still between punches)
    const D = clipDuration.toFixed(3);
    const ZOOM_AMOUNT = 0.08;       // 8% punch zoom (subtle)
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

    console.log(`[FFmpeg] Smart Zoom dynamic: ${limited.length} peaks, 8% punch, smooth ease`);

    return `${inLabel}scale=w='${scaledW}':h='${scaledH}':eval=frame:flags=lanczos,crop=${canvasW}:${canvasH},setsar=1${outLabel}`;
  }

  if (mode === 'micro') {
    // ── SLOW CINEMATIC PUSH ──
    // Single slow push-in 1.0 → 1.05 over the entire clip.
    // No oscillation/breathing — just a clean, barely noticeable drift.
    // This is what Netflix/documentary editors use on talking heads.
    const D = clipDuration.toFixed(3);
    const zExpr = `(1+0.05*min(t/${D}\\,1))`;
    const scaledW = `trunc(${canvasW}*${zExpr}/2)*2`;
    const scaledH = `trunc(${canvasH}*${zExpr}/2)*2`;

    console.log(`[FFmpeg] Smart Zoom micro: slow push 0→5%, duration=${D}s`);

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
function buildFollowFaceFilter(inLabel, outLabel, canvasW, canvasH, keyframes, clipDuration) {
  if (!keyframes || keyframes.length < 2) {
    console.log('[FFmpeg] Follow face: not enough keyframes, falling back to micro');
    return null;
  }

  // ── Zoom factor: scale video up 20% so we have pan room ──
  const ZOOM = 1.20;
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
    splitScreen = null,
    tag = null,
    cropAnchor = 'center',
    maxDuration = 300,
    timeout = 300000,
    smartZoom = null,
    videoZoom = 'contain',
    hook = null,
    audioEnhance = false,
    bassBoost = 'off',
    speedRamp = 'off',
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

      console.log('[FFmpeg] End-card appended (1.2s)');
    } catch (err) {
      console.warn('[FFmpeg] End-card failed (non-fatal):', err.message);
    }
    return result;
  }

  // ── Split-screen render path ────────────────────────────────────────────
  if (splitScreen && splitScreen.enabled && splitScreen.brollPath) {
    const result = await renderSplitScreen(inputPath, outputPath, {
      startTime, clipDuration, aspectRatio, captions, watermark, watermarkPosition,
      plan, splitScreen, tag, cropAnchor, timeout, smartZoom, audioPeaks,
      hook, audioEnhance, bassBoost, speedRamp, sourceFps, exposureFilter,
    });
    return maybeAppendEndCard(result);
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
      const zoomFactor = videoZoom === 'immersive' ? 1.35 : videoZoom === 'fill' ? 1.15 : 1.0;

      let filterComplex;
      let mapVideo;

      // ── Step 1: Scale/Crop compositing ─────────────────────────────────
      if (isWordPopAnimation) {
        if (zoomFactor > 1.0) {
          const bigW = Math.round(canvasW * zoomFactor);
          const bigH = Math.round(canvasH * zoomFactor);
          filterComplex = [
            `[0:v]fps=${fps},crop=in_w-60:in_h-60:30:30,split=2[wpfg][wpbg]`,
            `[wpbg]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=12,eq=brightness=-0.35:saturation=1.25:contrast=1.1,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[wpbgout]`,
            `[wpfg]scale=${bigW}:${bigH}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[wpfgscaled]`,
            `[wpbgout][wpfgscaled]overlay=(W-w)/2:(H-h)/2[composed]`,
          ].join(';');
        } else {
          filterComplex = [
            `[0:v]fps=${fps},crop=in_w-60:in_h-60:30:30,split=2[wpfg2][wpbg2]`,
            `[wpbg2]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=12,eq=brightness=-0.35:saturation=1.25:contrast=1.1,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[wpbgout2]`,
            `[wpfg2]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[wpfgout2]`,
            `[wpbgout2][wpfgout2]overlay=(W-w)/2:(H-h)/2[composed]`,
          ].join(';');
        }
        mapVideo = '[composed]';
      } else if (smartZoomActive) {
        filterComplex = `[0:v]fps=${fps},crop=in_w-60:in_h-60:30:30,scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:(ih-${canvasH})/2,setsar=1[composed]`;
        mapVideo = '[composed]';
      } else {
        const fgW = Math.round(canvasW * zoomFactor);
        const fgH = Math.round(canvasH * zoomFactor);
        filterComplex = [
          `[0:v]fps=${fps},crop=in_w-60:in_h-60:30:30,split=2[srcfg][srcbg]`,
          `[srcbg]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=12,eq=brightness=-0.35:saturation=1.25:contrast=1.1,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[bg]`,
          `[srcfg]scale=${fgW}:${fgH}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[fg]`,
          `[bg][fg]overlay=(W-w)/2:(H-h)/2[composed]`,
        ].join(';');
        mapVideo = '[composed]';
      }

      // ── Step 2: Smart Zoom (scale/crop — before eq so text stays crisp) ──
      if (smartZoom && smartZoom.enabled) {
        let zoomChain = null;
        if (smartZoom.mode === 'follow' && Array.isArray(smartZoom.faceKeyframes) && smartZoom.faceKeyframes.length >= 2) {
          zoomChain = buildFollowFaceFilter(mapVideo, '[zoomed]', canvasW, canvasH, smartZoom.faceKeyframes, clipDuration);
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
          const posPct = hook.textPosition || 15;
          const safeText = escapeDrawtext(hook.text);
          const enableExpr = hookDisplayLength < clipDuration
            ? `:enable='between(t\\,0\\,${(hookDisplayLength + 0.3).toFixed(2)})'`
            : '';
          filterComplex += `;${mapVideo}drawtext=text='${safeText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=48:fontcolor=0x${hookFontColor}@0xff:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*${posPct}/100-text_h/2${enableExpr}[hooktext]`;
          mapVideo = '[hooktext]';
        }
      }

      // ── Step 8: Watermark ──
      if (watermark && (plan === 'free' || (plan !== 'free' && watermark.logoPath))) {
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
        filterComplex += `;[${hookInputIndex}:v]format=rgba,${fadeFilters}[hookalpha]`;
        const isCapsule = hookOverlayEntry.isCapsuleOnly;
        const posPct = hookOverlayEntry.textPosition || 15;
        const overlayX = isCapsule ? '(W-w)/2' : '0';
        const overlayY = isCapsule ? `H*${posPct}/100-h/2` : '0';
        filterComplex += `;${mapVideo}[hookalpha]overlay=${overlayX}:${overlayY}:format=auto[hooked]`;
        mapVideo = '[hooked]';
      }

      // ── Terminal format=yuv420p ──
      filterComplex += `;${mapVideo}format=yuv420p[vout]`;
      mapVideo = '[vout]';

      args.push('-t', String(clipDuration));
      args.push('-filter_complex', filterComplex);
      args.push('-map', mapVideo);
      args.push('-map', '0:a?');

      // ── Encoding: tier-based quality params ──
      args.push(...buildCommonEncodingArgs(tier, fps));

      // ── Audio filter chain ──
      const audioFilters = [];
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
      if (audioFilters.length > 0) {
        args.push('-af', audioFilters.join(','));
        args.push('-c:a', 'aac', '-b:a', tier.audioBitrate, '-ar', '48000', '-ac', '2');
      } else {
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

      const result = await execRender(args, outputPath, timeout, tierName);
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
// Split-Screen Compositing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a split-screen clip with the main video + B-roll.
 * Supports 3 layouts:
 *   - top-bottom:  main on top, B-roll on bottom (default)
 *   - side-by-side: main on left, B-roll on right
 *   - pip:          main fullscreen, B-roll in picture-in-picture corner
 *
 * @param {string} inputPath  - Path to main video
 * @param {string} outputPath - Output path
 * @param {object} opts       - Render options
 */
async function renderSplitScreen(inputPath, outputPath, opts) {
  const {
    startTime,
    clipDuration,
    aspectRatio,
    captions,
    watermark,
    watermarkPosition,
    plan,
    splitScreen,
    tag,
    cropAnchor,
    timeout,
    smartZoom,
    audioPeaks = [],
    hook = null,
    audioEnhance = false,
    bassBoost = 'off',
    speedRamp = 'off',
    sourceFps = 30,
    exposureFilter = null,
  } = opts;

  const layout = splitScreen.layout || 'top-bottom';
  const ratio = Math.max(30, Math.min(70, splitScreen.ratio || 50)) / 100;
  const brollPath = splitScreen.brollPath;

  // ── Retry ladder for split-screen ──
  const quality = process.env.RENDER_QUALITY || 'high';
  const tierSequence = getTierSequence(quality);
  let lastError;

  for (let ti = 0; ti < tierSequence.length; ti++) {
    const tierName = tierSequence[ti];
    const tier = RENDER_TIERS[tierName];
    const fps = getTierFps(tier, sourceFps);
    const { w: canvasW, h: canvasH } = getCanvasDimensions(tier, aspectRatio);

    console.log(`[FFmpeg-Split] Render tier ${ti + 1}/${tierSequence.length}: ${tierName} (${canvasW}x${canvasH} @ ${fps}fps)`);

    try {
      let filterComplex = '';
      let mapVideo = '';

      // ── Split-screen compositing with lanczos foreground ──
      if (layout === 'top-bottom') {
        const topH = Math.round(canvasH * ratio);
        const botH = canvasH - topH;
        // Background blur: downscale broll to 540x960 (bicubic) → gblur → upscale (bicubic)
        const blurW = tier.hd ? 540 : 360;
        const blurH = tier.hd ? 960 : 640;
        filterComplex = [
          `[0:v]fps=${fps},crop=in_w-60:in_h-60:30:30,scale=${canvasW}:${topH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${topH}:(iw-${canvasW})/2:(ih-${topH})/2,setsar=1,setpts=PTS-STARTPTS[main]`,
          `[1:v]loop=loop=-1:size=900:start=0,fps=${fps},scale=${canvasW}:${botH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${botH}:(iw-${canvasW})/2:(ih-${botH})/2,setsar=1,setpts=PTS-STARTPTS[broll]`,
          `[main][broll]vstack=inputs=2[composed]`,
        ].join(';');
        mapVideo = '[composed]';
      } else if (layout === 'side-by-side') {
        const leftW = Math.round(canvasW * ratio);
        const rightW = canvasW - leftW;
        filterComplex = [
          `[0:v]fps=${fps},crop=in_w-60:in_h-60:30:30,scale=${leftW}:${canvasH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${leftW}:${canvasH}:(iw-${leftW})/2:(ih-${canvasH})/2,setsar=1,setpts=PTS-STARTPTS[main]`,
          `[1:v]loop=loop=-1:size=900:start=0,fps=${fps},scale=${rightW}:${canvasH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${rightW}:${canvasH}:(iw-${rightW})/2:(ih-${canvasH})/2,setsar=1,setpts=PTS-STARTPTS[broll]`,
          `[main][broll]hstack=inputs=2[composed]`,
        ].join(';');
        mapVideo = '[composed]';
      } else if (layout === 'pip') {
        const pipW = Math.round(canvasW * 0.35);
        const pipH = Math.round(canvasH * 0.35);
        const pipX = canvasW - pipW - 20;
        const pipY = canvasH - pipH - 20;
        filterComplex = [
          `[0:v]fps=${fps},crop=in_w-60:in_h-60:30:30,scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:(ih-${canvasH})/2,setsar=1,setpts=PTS-STARTPTS[main]`,
          `[1:v]loop=loop=-1:size=900:start=0,fps=${fps},scale=${pipW}:${pipH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${pipW}:${pipH}:(iw-${pipW})/2:(ih-${pipH})/2,setsar=1,setpts=PTS-STARTPTS[broll]`,
          `[main][broll]overlay=${pipX}:${pipY}[composed]`,
        ].join(';');
        mapVideo = '[composed]';
      } else {
        return renderSplitScreen(inputPath, outputPath, {
          ...opts,
          splitScreen: { ...splitScreen, layout: 'top-bottom' },
        });
      }

      // ── Smart Zoom ──
      if (smartZoom && smartZoom.enabled) {
        let zoomChain = null;
        if (smartZoom.mode === 'follow' && Array.isArray(smartZoom.faceKeyframes) && smartZoom.faceKeyframes.length >= 2) {
          zoomChain = buildFollowFaceFilter(mapVideo, '[zoomed]', canvasW, canvasH, smartZoom.faceKeyframes, clipDuration);
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

      // ── Exposure (eq) ──
      if (exposureFilter) {
        filterComplex += `;${mapVideo}${exposureFilter}[exposed]`;
        mapVideo = '[exposed]';
      }

      // ── Unsharp (HIGH tiers only) ──
      if (tier.unsharp) {
        filterComplex += `;${mapVideo}unsharp=5:5:0.25:3:3:0.0[sharpened]`;
        mapVideo = '[sharpened]';
      }

      // ── ASS captions ──
      const extraInputs = [];
      if (captions && captions.assFilePath) {
        filterComplex += `;${mapVideo}ass='${escapePath(captions.assFilePath)}':fontsdir='/usr/share/fonts'[captioned]`;
        mapVideo = '[captioned]';
      }

      // ── Tag overlay ──
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
        const splitContentH = Math.round(canvasH * ratio);
        const tagFilter = buildTagFilter(tag, canvasW, canvasH, mapVideo, splitContentH);
        if (tagFilter) {
          if (typeof tagFilter === 'string') {
            filterComplex += `;${mapVideo}${tagFilter}[tagged]`;
          } else if (tagFilter.complex) {
            filterComplex += `;${tagFilter.chain}[tagged]`;
          }
          mapVideo = '[tagged]';
        }
      }

      // ── Hook overlay ──
      const hookDisplayLenSplit = (hook && hook.length > 0) ? hook.length : clipDuration;
      if (hook && hook.enabled && hook.textEnabled !== false && hook.text) {
        const jobDir = path.dirname(outputPath);
        const hookData = await prepareHookOverlay(hook.text, hookDisplayLenSplit, canvasW, canvasH, hook.textPosition || 15, jobDir, hook);
        if (hookData) {
          extraInputs.push({
            pngPath: hookData.pngPath, startTime: 0, endTime: Math.min(hookDisplayLenSplit + 1, clipDuration),
            isHookOverlay: true, hookLength: hookDisplayLenSplit,
            isCapsuleOnly: hookData.isCapsuleOnly, textPosition: hookData.textPosition,
          });
        }
      }

      // ── Watermark ──
      if (watermark && (plan === 'free' || (plan !== 'free' && watermark.logoPath))) {
        const wmFilter = buildWatermarkFilter(watermark, watermarkPosition, plan, clipDuration);
        if (wmFilter) {
          filterComplex += `;${mapVideo}${wmFilter}[watermarked]`;
          mapVideo = '[watermarked]';
        }
      }

      // ── Wire PNG overlays ──
      const hookOverlayEntrySplit = extraInputs.find(e => e.isHookOverlay);
      const tagOverlayEntrySplit = extraInputs.find(e => e.isTagOverlay);
      let hookInputIndexSplit = -1;
      let tagInputIndexSplit = -1;

      const args = ['-y'];
      args.push('-ss', String(startTime));
      args.push('-i', inputPath);
      args.push('-i', brollPath);
      let splitInputIdx = 2;
      for (const overlay of extraInputs) {
        const ts = Math.max(0, overlay.startTime);
        const td = Math.max(0.01, overlay.endTime - overlay.startTime);
        if (overlay.isHookOverlay) hookInputIndexSplit = splitInputIdx;
        if (overlay.isTagOverlay) tagInputIndexSplit = splitInputIdx;
        args.push('-loop', '1', '-t', td.toFixed(3), '-itsoffset', ts.toFixed(3), '-i', overlay.pngPath);
        splitInputIdx++;
      }

      if (tagOverlayEntrySplit && tagInputIndexSplit >= 0) {
        filterComplex += `;[${tagInputIndexSplit}:v]format=rgba[tagalpha]`;
        filterComplex += `;${mapVideo}[tagalpha]overlay=${tagOverlayEntrySplit.anchorX || 0}:${tagOverlayEntrySplit.anchorY || 0}:format=auto[tagged]`;
        mapVideo = '[tagged]';
      }

      if (hookOverlayEntrySplit && hookInputIndexSplit >= 0) {
        const hLenSplit = hookOverlayEntrySplit.hookLength || clipDuration;
        let fadeFiltersSplit = `fade=t=in:st=0:d=0.3:alpha=1`;
        if (hLenSplit < clipDuration) {
          fadeFiltersSplit += `,fade=t=out:st=${hLenSplit.toFixed(2)}:d=0.3:alpha=1`;
        }
        filterComplex += `;[${hookInputIndexSplit}:v]format=rgba,${fadeFiltersSplit}[hookalpha]`;
        const isCapsule = hookOverlayEntrySplit.isCapsuleOnly;
        const posPct = hookOverlayEntrySplit.textPosition || 15;
        filterComplex += `;${mapVideo}[hookalpha]overlay=${isCapsule ? '(W-w)/2' : '0'}:${isCapsule ? `H*${posPct}/100-h/2` : '0'}:format=auto[hooked]`;
        mapVideo = '[hooked]';
      }

      // ── Terminal format ──
      filterComplex += `;${mapVideo}format=yuv420p[vout]`;
      mapVideo = '[vout]';

      args.push('-t', String(clipDuration));
      args.push('-filter_complex', filterComplex);
      args.push('-map', mapVideo);
      args.push('-map', '0:a?');

      // ── Encoding: same tier system as standard (no more CRF 28 floor) ──
      args.push(...buildCommonEncodingArgs(tier, fps));

      // ── Audio ──
      const audioFiltersSplit = [];
      if (audioEnhance) {
        audioFiltersSplit.push('highpass=f=80', 'afftdn=nf=-25', 'loudnorm=I=-14:LRA=11:TP=-1.5:linear=false:dual_mono=true');
      }
      const bassFiltersSplit = buildBassBoostFilters({ bassBoost });
      if (bassFiltersSplit.length > 0) audioFiltersSplit.push(...bassFiltersSplit);
      const speedFiltersSplit = buildSpeedRampFilters({ speedRamp });
      if (speedFiltersSplit.audio.length > 0) audioFiltersSplit.push(...speedFiltersSplit.audio);
      if (audioFiltersSplit.length > 0) {
        args.push('-af', audioFiltersSplit.join(','));
      }
      args.push('-c:a', 'aac', '-b:a', tier.audioBitrate, '-ar', '48000', '-ac', '2');
      args.push('-max_muxing_queue_size', '512');
      args.push('-shortest');
      args.push(outputPath);

      console.log(`[FFmpeg] Split-screen render: layout=${layout}, ratio=${ratio}, tier=${tierName}`);
      return await execRender(args, outputPath, timeout, tierName);
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
 * Supports 3 styles:
 *   - badge-top:       Rounded badge in top-right corner
 *   - watermark-center: Semi-transparent text in center
 *   - banner-bottom:   Dark banner bar at bottom with credit text
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
  // boxborderw only supports a single uniform value in FFmpeg
  // We use boxPad as uniform padding, and position text further right to leave logo room
  const logoSpace = logoH + logoGap;
  // If split-screen, position badge above the broll area; else at bottom of canvas
  const bottomEdge = contentAreaH || canvasH;
  const badgeY = bottomEdge - marginY - logoH - boxPad * 2;
  const textX = marginX + boxPad + logoSpace;
  const textY = badgeY + boxPad + Math.round((logoH - fontSize) / 2);
  const logoX = marginX + boxPad;
  const logoY = badgeY + boxPad;

  // Badge dimensions: drawbox for background, then drawtext on top, then logo overlay
  // This avoids boxborderw multi-value issues (FFmpeg only supports single value)
  const badgeX = marginX;
  // Badge width: logo + gap + text approx + padding. We use a generous fixed width.
  // Text width is unknown, so we make the box wide enough and let it extend right.
  // drawbox is drawn first, then text and logo on top.
  const badgeH = logoH + boxPad * 2;

  switch (tagConfig.style) {
    case 'viral-glow': {
      // Capsule noire 75% + bordure violet néon #9146FF + glow
      const chain = [
        `movie=${twitchLogoFile},scale=-1:${logoH},format=yuva420p[twvg]`,
        `${inputLabel}drawtext=text='${displayText}':fontfile=${fontFile}:fontcolor=white:fontsize=${fontSize}:x=${textX}:y=${textY}:box=1:boxcolor=0x000000@0.75:boxborderw=${boxPad}:borderw=1:bordercolor=0x9146FF@0.9:shadowcolor=0x9146FF@0.5:shadowx=0:shadowy=0,drawbox=x=${badgeX}:y=${badgeY}:w=${logoSpace + boxPad}:h=${badgeH}:color=0x000000@0.75:t=fill[vgtxt]`,
        `[vgtxt][twvg]overlay=${logoX}:${logoY}:format=auto`,
      ].join(';');
      return { chain, complex: true };
    }

    case 'twitch-minimal': {
      // Clean black bg, subtle purple border, no glow
      const chain = [
        `movie=${twitchLogoFile},scale=-1:${logoH},format=yuva420p,colorlevels=rimin=0.3:gimin=0.3:bimin=0.3[twtm]`,
        `${inputLabel}drawtext=text='${displayText}':fontfile=${fontFile}:fontcolor=white@0.85:fontsize=${fontSize}:x=${textX}:y=${textY}:box=1:boxcolor=0x000000@0.70:boxborderw=${boxPad}:borderw=1:bordercolor=0x9146FF@0.40,drawbox=x=${badgeX}:y=${badgeY}:w=${logoSpace + boxPad}:h=${badgeH}:color=0x000000@0.70:t=fill[tmtxt]`,
        `[tmtxt][twtm]overlay=${logoX}:${logoY}:format=auto`,
      ].join(';');
      return { chain, complex: true };
    }

    case 'kick-minimal': {
      // Clean black bg, subtle green border, no glow
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
  if (plan !== 'free' && !watermark.logoPath) {
    return null;
  }

  if (plan === 'free') {
    // Position-alternating watermark: top-center first half, bottom-center second half (anti-crop)
    const halfDuration = (clipDuration || 30) / 2;
    const topY = 'H*0.06';  // below TikTok safe zone
    const botY = 'H-th-H*0.06';
    const centerX = '(W-tw)/2';

    // @viralanimal text with subtle outline for readability on light and dark
    return `drawtext=text='\\@viralanimal':fontsize=28:fontcolor=white@0.6:borderw=1:bordercolor=black@0.4:x=${centerX}:y=${topY}:enable='lt(t\\,${halfDuration})',drawtext=text='\\@viralanimal':fontsize=28:fontcolor=white@0.6:borderw=1:bordercolor=black@0.4:x=${centerX}:y=${botY}:enable='gte(t\\,${halfDuration})'`;
  }

  return null;
}

/**
 * Build FFmpeg end-card filter for free plan.
 * 1.2s card after the clip: "clipped with VIRAL ANIMAL" on dark bg.
 * Returns null for non-free plans.
 */
function buildEndCardArgs(outputPath, plan, canvasW, canvasH) {
  if (plan !== 'free') return null;

  // Generate end-card as a 1.2s video with drawtext on solid bg
  const endCardPath = outputPath.replace(/\.mp4$/, '_endcard.mp4');
  const fontSize = Math.round(canvasW * 0.055);
  const subFontSize = Math.round(canvasW * 0.032);

  return {
    endCardPath,
    args: [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=0x1a1a2e:s=${canvasW}x${canvasH}:d=1.2:r=30`,
      '-vf', [
        `drawtext=text='clipped with':fontsize=${subFontSize}:fontcolor=0xd4d4d8@0.7:x=(w-tw)/2:y=(h/2)-${fontSize}-10`,
        `drawtext=text='VIRAL ANIMAL':fontsize=${fontSize}:fontcolor=0xf59e0b:x=(w-tw)/2:y=(h/2)-${Math.round(fontSize * 0.3)}`,
        `drawtext=text='viralanimal.com':fontsize=${subFontSize}:fontcolor=0xa1a1aa@0.6:x=(w-tw)/2:y=(h/2)+${fontSize}+5`,
      ].join(','),
      '-t', '1.2',
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
