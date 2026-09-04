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
    case '60fps': return ['HIGH_60', 'HIGH_30', 'SAFE', 'LAST_RESORT'];
    default:     return ['HIGH_30', 'SAFE', 'LAST_RESORT'];
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

/**
 * Should this FFmpeg failure trigger a fallback to a lighter tier?
 * Covers classic OOM (SIGKILL / 137 / null exit) AND native crashes that are
 * almost always memory-pressure related on a small container: SIGABRT / SIGSEGV /
 * SIGBUS and glibc heap-corruption aborts ("malloc_consolidate(): invalid chunk
 * size", "double free", "corrupted"). A retry at 720p / lighter preset succeeds in
 * practice — failing the whole job on a transient native crash is the worse outcome.
 */
function isOOMError(err) {
  if (!err) return false;
  const msg = err.message || '';
  const nativeCrashSignal = ['SIGKILL', 'SIGABRT', 'SIGSEGV', 'SIGBUS'];
  if (err.killed === true || err.exitCode === null || err.exitCode === 137 || err.exitCode === 134 || err.exitCode === 139) return true;
  if (nativeCrashSignal.includes(err.signal)) return true;
  if (nativeCrashSignal.some(s => msg.includes(`signal=${s}`))) return true;
  if (msg.includes('killed=true') || msg.includes('code=null') || msg.includes('code=137') || msg.includes('code=134') || msg.includes('code=139')) return true;
  const heapCorruption = /malloc_consolidate|malloc\(\): |free\(\): |double free|corrupted (size|double-linked)|invalid chunk size|Out of memory|Cannot allocate memory/i;
  return heapCorruption.test(msg);
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

function buildCommonEncodingArgs(tier, fps, clipDuration, diversify = null) {
  const gop = fps === 60 ? 120 : 60;
  const maxrate = clampMaxrate(tier.maxrate, clipDuration);
  // bufsize = 2× maxrate to keep VBV responsive
  const bufsizeM = parseInt(maxrate) * 2;

  // Diversify: CRF and FPS variation (if available)
  const crf = diversify?.crfVariant ?? tier.crf;
  const fpsOut = diversify?.fpsVariant ?? fps;

  return [
    '-c:v', 'libx264',
    '-preset', tier.preset,
    '-crf', String(crf),
    '-maxrate', maxrate,
    '-bufsize', `${bufsizeM}M`,
    '-profile:v', tier.profile,
    '-level:v', tier.level,
    '-pix_fmt', 'yuv420p',
    '-fps_mode', 'cfr',
    '-r', String(fpsOut),
    '-g', String(gop),
    '-keyint_min', String(gop),
    '-sc_threshold', '0',
    '-movflags', '+faststart',
    '-tag:v', 'avc1',
    '-colorspace', 'bt709',
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    // Metadata scrub: strip ALL source metadata (handler_name, encoder, creation_time, etc.)
    '-map_metadata', '-1',
    '-map_metadata:s:v', '-1',
    '-map_metadata:s:a', '-1',
    '-map_chapters', '-1',
    '-metadata', `creation_time=${new Date().toISOString()}`,
    '-metadata', 'encoder=Viral Animal',
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
// SFX Mix Chain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build filter_complex chain that mixes SFX WAV inputs into the audio.
 * Each SFX is delayed to its trigger time, volume-adjusted, faded (30ms),
 * then amixed with the base audio stream.
 *
 * @param {Array<{path: string, time: number, volume: number}>} sfxPaths
 * @param {number} firstInputIdx - FFmpeg input index of first SFX
 * @param {string} baseLabel - Input audio label (e.g. '[abase]' or '[aout]')
 * @param {string} outLabel - Output label (e.g. '[asfx]')
 * @param {number} clipDuration - Clip duration (for apad)
 * @returns {string} filter_complex fragment (starts with ';')
 */
function buildSfxMixChain(sfxPaths, firstInputIdx, baseLabel, outLabel, clipDuration) {
  if (!sfxPaths || sfxPaths.length === 0) return '';

  const FADE_MS = 30;
  const parts = [];
  const labels = [];

  for (let i = 0; i < sfxPaths.length; i++) {
    const sfx = sfxPaths[i];
    const idx = firstInputIdx + i;
    const delayMs = Math.round(sfx.time * 1000);
    const vol = Math.pow(10, (sfx.volume || -12) / 20).toFixed(4);
    const label = `sfx${i}`;
    // Delay + volume + fade in/out + pad to clip duration
    parts.push(
      `[${idx}:a]adelay=${delayMs}|${delayMs},volume=${vol},` +
      `afade=t=in:st=0:d=${FADE_MS / 1000},afade=t=out:st=99:d=${FADE_MS / 1000},` +
      `apad=whole_dur=${clipDuration}[${label}]`
    );
    labels.push(`[${label}]`);
  }

  // amix all SFX together, then amix with base audio
  let chain = ';' + parts.join(';');
  if (labels.length === 1) {
    chain += `;${baseLabel}${labels[0]}amix=inputs=2:duration=first:dropout_transition=0:normalize=0${outLabel}`;
  } else {
    chain += `;${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0[sfxmix]`;
    chain += `;${baseLabel}[sfxmix]amix=inputs=2:duration=first:dropout_transition=0:normalize=0${outLabel}`;
  }

  return chain;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio Pitch Shift (anti-fingerprint)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build FFmpeg audio filters for imperceptible pitch/tempo shift.
 * Changes the audio fingerprint without audible difference.
 * Uses asetrate to shift pitch, then atempo to correct duration.
 *
 * @param {number} sampleRate - Source sample rate (default 48000)
 * @returns {{ filters: string[], outputRate: number }}
 */
function buildAudioShiftFilters(sampleRate = 48000, shiftPct = 1) {
  // Imperceptible pitch/tempo shift — anti-fingerprint.
  // shiftPct is diversified per render (0.5-1.5%, default 1%).
  const shiftFactor = 1 + shiftPct / 100;
  const shiftedRate = Math.round(sampleRate * shiftFactor);
  return {
    filters: [
      `asetrate=${shiftedRate}`,
      `atempo=${(1 / shiftFactor).toFixed(6)}`,
      `aresample=${sampleRate}`,
    ],
    outputRate: sampleRate,
    shiftPct,
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
function buildSmartZoomFilter(inLabel, outLabel, canvasW, canvasH, clipDuration, mode = 'micro', peaks = [], cropAnchor = 'center', diversify = null) {
  if (!clipDuration || clipDuration <= 0) return null;

  // All modes use scale(eval=frame)+crop — the only reliable way to do
  // time-varying zoom on VIDEO (zoompan is for stills only).
  // Memory safety: 720p canvas + simple expressions + max 3 peaks.

  if (mode === 'dynamic' && Array.isArray(peaks) && peaks.length > 0) {
    // ── PATTERN-INTERRUPT PUNCH ZOOM ──
    // Designed as a retention tool: each audio spike triggers a visible
    // punch-in that recaptures attention. Calibrated for TikTok 2026:
    //   - Amplitude: 10-12% (strong = 12%, medium = 8%) × diversify mult
    //   - Rise:  0.25s smoothstep (fast snap)
    //   - Hold:  1.3s  (viewer registers the change)
    //   - Fall:  0.55s smoothstep (smooth return, no snap-back)
    //   - Total: ~2.1s per punch cycle
    //   - Max 6 punches, cooldown 6-8s, never in first 1s or last 1s
    const ampMult = diversify?.zoomAmpMult ?? 1.0;
    const RISE = 0.25;
    const HOLD = 1.30;
    const FALL = 0.55;
    const TOTAL = RISE + HOLD + FALL;
    const AMP_STRONG = 0.12 * ampMult; // strong peak → 12%
    const AMP_MEDIUM = 0.08 * ampMult; // medium peak → 8%

    // Filter: skip first 1s (hook) and last 1s, max 6
    const eligible = peaks
      .filter(p => {
        const t = typeof p === 'number' ? p : p.time;
        return t >= 1.0 && t + TOTAL < clipDuration - 1.0;
      })
      .slice(0, 6);

    if (eligible.length === 0) {
      // No valid peaks → fall back to micro
      return buildSmartZoomFilter(inLabel, outLabel, canvasW, canvasH, clipDuration, 'micro', [], cropAnchor, diversify);
    }

    const terms = eligible.map(p => {
      const t0 = typeof p === 'number' ? p : p.time;
      const intensity = typeof p === 'object' && p.intensity != null ? p.intensity : 0.5;
      const amp = (intensity >= 0.7 ? AMP_STRONG : AMP_MEDIUM).toFixed(4);
      const tRise = t0.toFixed(3);
      const tHoldStart = (t0 + RISE).toFixed(3);
      const tHoldEnd = (t0 + RISE + HOLD).toFixed(3);
      const tEnd = (t0 + TOTAL).toFixed(3);
      // smoothstep: 3t²−2t³ for both rise and fall
      const rise = `if(between(t\\,${tRise}\\,${tHoldStart})\\,${amp}*(3*pow((t-${tRise})/${RISE}\\,2)-2*pow((t-${tRise})/${RISE}\\,3))\\,0)`;
      const hold = `if(between(t\\,${tHoldStart}\\,${tHoldEnd})\\,${amp}\\,0)`;
      const fallProgress = `(t-${tHoldEnd})/${FALL}`;
      const fall = `if(between(t\\,${tHoldEnd}\\,${tEnd})\\,${amp}*(1-(3*pow(${fallProgress}\\,2)-2*pow(${fallProgress}\\,3)))\\,0)`;
      return `${rise}+${hold}+${fall}`;
    });

    const zExpr = `(1+${terms.join('+')})`;
    const scaledW = `trunc(${canvasW}*${zExpr}/2)*2`;
    const scaledH = `trunc(${canvasH}*${zExpr}/2)*2`;

    const dynCropY = cropAnchor === 'bottom' ? `ih-${canvasH}` : cropAnchor === 'top' ? '0' : `(ih-${canvasH})/2`;
    console.log(`[FFmpeg] Smart Zoom dynamic: ${eligible.length} punches (strong=${AMP_STRONG.toFixed(3)} med=${AMP_MEDIUM.toFixed(3)}), rise=${RISE}s hold=${HOLD}s fall=${FALL}s, anchor=${cropAnchor}`);

    return `${inLabel}scale=w='${scaledW}':h='${scaledH}':eval=frame:flags=lanczos,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:${dynCropY},setsar=1${outLabel}`;
  }

  if (mode === 'micro') {
    // ── SLOW CINEMATIC PUSH ──
    // Single slow push-in 1.0 → 1.06 over the entire clip.
    // Subtle, barely noticeable drift — Netflix/documentary talking-head style.
    // Max amplitude capped at 1.08 to prevent noticeable crop.
    const D = clipDuration.toFixed(3);
    const ampMicro = diversify?.zoomAmpMult ?? 1.0;
    const phase = diversify?.zoomPhase ?? 0;
    const baseAmp = (0.06 * ampMicro).toFixed(4);
    // Phase offset: shift the zoom curve start (0 = normal, 0.15 = start 15% into the ramp)
    const tExpr = phase > 0.001 ? `min((t/${D}+${phase.toFixed(4)})\\,1)` : `min(t/${D}\\,1)`;
    const zExpr = `(1+${baseAmp}*${tExpr})`;
    const scaledW = `trunc(${canvasW}*${zExpr}/2)*2`;
    const scaledH = `trunc(${canvasH}*${zExpr}/2)*2`;

    console.log(`[FFmpeg] Smart Zoom micro: slow push 0→${(parseFloat(baseAmp)*100).toFixed(1)}%, phase=${(phase*100).toFixed(0)}%, duration=${D}s, anchor=${cropAnchor}`);

    const microCropY = cropAnchor === 'bottom' ? `ih-${canvasH}` : cropAnchor === 'top' ? '0' : `(ih-${canvasH})/2`;
    return `${inLabel}scale=w='${scaledW}':h='${scaledH}':eval=frame:flags=lanczos,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:${microCropY},setsar=1${outLabel}`;
  }

  // Dynamic requested but no peaks → fall back to micro.
  if (mode === 'dynamic') {
    return buildSmartZoomFilter(inLabel, outLabel, canvasW, canvasH, clipDuration, 'micro', [], cropAnchor, diversify);
  }

  // Follow mode without face data → fall back to micro.
  if (mode === 'follow') {
    return buildSmartZoomFilter(inLabel, outLabel, canvasW, canvasH, clipDuration, 'micro', [], cropAnchor, diversify);
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
 *   1. Temporal smoothing: ~1s moving average to kill micro-oscillations
 *   2. Dead zone: face within central 20% of frame → camera frozen
 *   3. Speed cap: max 2% of canvas per keyframe interval (gentle catchup)
 *   4. Scale up by zoom factor so we have room to pan
 *   5. Nested if(lt()) expression for continuous per-frame linear interpolation
 *      (NOT additive between() — that caused boundary doubling = strobing)
 *
 * @param {string} inLabel       - Input stream label
 * @param {string} outLabel      - Output stream label
 * @param {number} canvasW       - Target width
 * @param {number} canvasH       - Target height
 * @param {Array}  keyframes     - [{t, cx, cy, zoom}] smoothed face positions
 * @param {number} clipDuration  - Clip duration in seconds
 * @param {number} zoomOverride  - Zoom factor (1.0 = pan only)
 * @returns {string|null} FFmpeg filter string
 */
function buildFollowFaceFilter(inLabel, outLabel, canvasW, canvasH, keyframes, clipDuration, zoomOverride, cropAnchor = 'center') {
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

  // ── Step 1: Temporal smoothing — moving average (~1s window) ──
  // Kills micro-oscillations from detection jitter before they reach FFmpeg.
  const SMOOTH_WINDOW = 0.5; // ±0.5s = 1s total window
  const smoothed = keyframes.map((kf, idx) => {
    let sumCx = 0, sumCy = 0, count = 0;
    for (let j = 0; j < keyframes.length; j++) {
      if (Math.abs(keyframes[j].t - kf.t) <= SMOOTH_WINDOW) {
        sumCx += keyframes[j].cx;
        sumCy += keyframes[j].cy;
        count++;
      }
    }
    return { t: kf.t, cx: sumCx / count, cy: sumCy / count };
  });

  // ── Step 2: Dead zone (20%) + speed cap (2% canvas per interval) ──
  // If face center stays within central 20% of frame, position is frozen.
  // Max movement capped for gentle catchup — no sudden jumps.
  const DEAD_ZONE = 0.20; // 20% of canvas (±10% from center)
  const MAX_SPEED = 0.02; // 2% of canvas per keyframe interval
  const maxMovePx = MAX_SPEED * Math.sqrt(canvasW * canvasW + canvasH * canvasH);

  const stabilized = [];
  let camCx = smoothed[0].cx;
  let camCy = smoothed[0].cy;

  for (let i = 0; i < smoothed.length; i++) {
    const pt = smoothed[i];
    const dxNorm = (pt.cx - camCx) / canvasW;
    const dyNorm = (pt.cy - camCy) / canvasH;
    const distNorm = Math.sqrt(dxNorm * dxNorm + dyNorm * dyNorm);

    if (distNorm < DEAD_ZONE) {
      // Face within dead zone — camera holds
      stabilized.push({ t: pt.t, cx: camCx, cy: camCy });
    } else {
      // Move toward face, capped by max speed
      let targetCx = pt.cx;
      let targetCy = pt.cy;
      const moveDx = targetCx - camCx;
      const moveDy = targetCy - camCy;
      const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);

      if (moveDist > maxMovePx && moveDist > 0) {
        const scale = maxMovePx / moveDist;
        targetCx = camCx + moveDx * scale;
        targetCy = camCy + moveDy * scale;
      }

      camCx = targetCx;
      camCy = targetCy;
      stabilized.push({ t: pt.t, cx: camCx, cy: camCy });
    }
  }

  // ── Step 3: Downsample to max ~20 keyframes for expression sanity ──
  const MAX_KF = 20;
  let kf = stabilized;
  if (kf.length > MAX_KF) {
    const step = Math.floor(kf.length / MAX_KF);
    kf = stabilized.filter((_, i) => i % step === 0);
    // Always include the last keyframe
    if (kf[kf.length - 1].t !== stabilized[stabilized.length - 1].t) {
      kf.push(stabilized[stabilized.length - 1]);
    }
  }

  // ── Step 4: Build nested if(lt()) expression for continuous interpolation ──
  // Uses nested if(lt(t, t_next), lerp, else_branch) — only one branch fires
  // per frame. Eliminates the between() boundary doubling that caused strobing.

  function buildLerpExpr(pts, axis) {
    const maxPan = axis === 'cx' ? maxPanX : maxPanY;

    // Convert face center to crop offset, clamped to [0, maxPan]
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

    // Build a lerp string for segment i → i+1
    const lerpStr = (i) => {
      const v0 = getOffset(pts[i]);
      const v1 = getOffset(pts[i + 1]);
      if (v0 === v1) return String(v0);
      const t0 = pts[i].t.toFixed(4);
      const dt = pts[i + 1].t - pts[i].t;
      if (dt <= 0) return String(v0);
      return `${v0}+${(v1 - v0).toFixed(2)}*(t-${t0})/${dt.toFixed(4)}`;
    };

    // Build right-to-left: innermost = hold last value
    let expr = String(getOffset(pts[pts.length - 1]));
    for (let i = pts.length - 2; i >= 0; i--) {
      const tBound = pts[i + 1].t.toFixed(4);
      const segment = lerpStr(i);
      expr = `if(lt(t\\,${tBound})\\,${segment}\\,${expr})`;
    }

    return expr;
  }

  const xExpr = buildLerpExpr(kf, 'cx');
  // When burned captions anchor the crop, fix Y to preserve that edge
  let yExpr;
  if (cropAnchor === 'bottom') {
    yExpr = String(maxPanY); // anchor to bottom — no vertical pan
  } else if (cropAnchor === 'top') {
    yExpr = '0'; // anchor to top — no vertical pan
  } else {
    yExpr = buildLerpExpr(kf, 'cy');
  }

  console.log(`[FFmpeg] Follow face: ${kf.length} keyframes, ${ZOOM}x zoom, nested-lerp continuous pan, anchor=${cropAnchor}`);

  // Scale up → crop with moving window → set SAR
  return `${inLabel}scale=${scaledW}:${scaledH}:flags=lanczos,crop=${canvasW}:${canvasH}:x='${xExpr}':y='${yExpr}':exact=1,setsar=1${outLabel}`;
}


// Re-export for use in render pipeline
export { buildFollowFaceFilter };

// buildReframeFilters — REMOVED (dead code, replaced by per-mode crop in renderClip)

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
    sfxPaths = null,      // [{path, time, volume}] from sfx.js
    splitScreen = null,   // {gameplayPath, gameplayDuration, seekOffset} from route
    reactionLayout = null, // {faceRegion: {x,y,w,h}, contentRegion: {x,y,w,h}}
    duoLayout = null,     // {faceA: {cx,cy,w,h}, faceB: {cx,cy,w,h}}
    diversify = null,     // {audioShiftPct, zoomAmpMult, zoomPhase, grainStrength, hookDelayS, hookPosPct, hookSizePct}
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
  // Audio peak analysis — runs for dynamic mode (now the default).
  // Returns peaks with intensity for amplitude modulation.
  if (smartZoom && smartZoom.enabled) {
    const wantDynamic = smartZoom.mode === 'dynamic' || smartZoom.mode === 'micro' || !smartZoom.mode;
    if (wantDynamic) {
      try {
        const { analyzeAudioPeaksWithIntensity } = await import('./audio-peaks.js');
        // Cooldown seeded by diversify: 6-8s (was fixed 6)
        const zoomCooldown = diversify?.zoomAmpMult
          ? 6 + (diversify.zoomAmpMult - 0.85) * (2 / 0.30) // maps 0.85-1.15 → 6-8
          : 6;
        audioPeaks = await analyzeAudioPeaksWithIntensity(inputPath, startTime, clipDuration, {
          cooldownSec: Math.round(zoomCooldown * 10) / 10, maxPeaks: 8, thresholdDb: 5,
        });
        if (audioPeaks.length > 0) {
          console.log(`[FFmpeg] Audio peaks: ${audioPeaks.length} with intensity (range ${audioPeaks.map(p => p.intensity?.toFixed(2)).join(',')})`);
        }
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
    // End-card OFF by default — enable via settings.endCard if desired
    if (plan !== 'free' || !result.success || !options.endCard) return result;
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
      const isSplitScreen = splitScreen && splitScreen.gameplayPath;
      const isReaction = !isSplitScreen && videoZoom === 'reaction' && reactionLayout;
      const isDuo = !isSplitScreen && videoZoom === 'duo' && duoLayout;
      const isFullFrame = !isSplitScreen && videoZoom === 'fullframe';
      const isFit = !isSplitScreen && (videoZoom === 'fit' || videoZoom === 'auto');
      const zoomFactor = (isFullFrame || isReaction || isDuo || isFit) ? 1.0 : videoZoom === 'immersive' ? 1.35 : videoZoom === 'fill' ? 1.15 : 1.0;

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

      // Border crop: diversified base (40-60px), reduced when crop zoom is high
      const MAX_TOTAL_ZOOM = 3.2;
      const baseBorderCrop = diversify?.borderCropPx ?? 50;
      let borderCrop;
      if (isFullFrame || isReaction || isDuo) {
        const borderBudget = MAX_TOTAL_ZOOM / Math.max(cropZoom, 1);
        borderCrop = borderBudget < 1.15 ? Math.min(baseBorderCrop, 40) : Math.max(baseBorderCrop, 60);
      } else {
        borderCrop = baseBorderCrop;
      }

      // Burned captions anchor: shift vertical border crop to preserve the edge
      // where source captions live. 'bottom' → all vertical crop from top.
      let borderCropY = borderCrop; // default: symmetric (center)
      if (cropAnchor === 'bottom') borderCropY = borderCrop * 2;
      else if (cropAnchor === 'top') borderCropY = 0;

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

        // Content crop Y: anchor to bottom when burned captions detected so
        // the bottom of the source (where captions live) is preserved.
        const contentCropY = cropAnchor === 'bottom' ? `ih-${contentH}` : cropAnchor === 'top' ? '0' : `(ih-${contentH})/2`;
        if (cropAnchor === 'bottom') console.log('[FFmpeg] CROP: anchored to bottom (burned captions) — reaction content');

        filterComplex = [
          // Crop face region from source, scale to fill canvas width, crop to exact faceH
          `[0:v]fps=${fps},crop=${face.w}:${face.h}:${face.x}:${face.y},scale=${canvasW}:${faceH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${faceH}:(iw-${canvasW})/2:(ih-${faceH})/2,setsar=1[facecam]`,
          // Crop content: full source minus border, scale to fill canvas width, crop to contentH
          // borderCropY shifts vertical trim to preserve bottom when burned captions detected;
          // contentCropY anchors the final aspect crop after scale.
          `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCropY},scale=${canvasW}:${contentH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${contentH}:(iw-${canvasW})/2:${contentCropY},setsar=1[content]`,
          // Stack: facecam on top, content on bottom
          `[facecam][content]vstack=inputs=2[composed]`,
        ].join(';');
        mapVideo = '[composed]';
        console.log(`[FFmpeg] Reaction layout: face(${face.x},${face.y},${face.w}x${face.h}) → ${canvasW}x${faceH} top, content → ${canvasW}x${contentH} bottom, anchor=${cropAnchor}`);
      } else if (isDuo) {
        // DUO MODE: two speakers stacked — face A top 50%, face B bottom 50%.
        // Each half crops a 9:8 region around its face from the source, then
        // scales to fill canvas width. 2px dark divider line at the junction.
        const fA = duoLayout.faceA;
        const fB = duoLayout.faceB;
        const halfH = Math.round(canvasH / 2);
        const divH = 2; // divider line height
        const slotH = halfH - Math.round(divH / 2); // each face slot (minus half divider)

        // Compute crop region for each face: 9:8 aspect centered on face.
        // We want to grab a horizontal slice of the source centered on each face.
        // Target aspect per slot is canvasW:slotH (e.g. 1080:958 ≈ 9:8).
        const slotAspect = canvasW / slotH;

        // Face A crop region (in source pixels)
        const cropAH = Math.min(sourceH, Math.round(sourceW / slotAspect));
        const cropAW = Math.round(cropAH * slotAspect);
        const cropAX = Math.max(0, Math.min(sourceW - cropAW, Math.round(fA.cx - cropAW / 2)));
        const cropAY = Math.max(0, Math.min(sourceH - cropAH, Math.round(fA.cy - cropAH / 2)));

        // Face B crop region
        const cropBH = cropAH; // same dimensions for uniform look
        const cropBW = cropAW;
        const cropBX = Math.max(0, Math.min(sourceW - cropBW, Math.round(fB.cx - cropBW / 2)));
        const cropBY = Math.max(0, Math.min(sourceH - cropBH, Math.round(fB.cy - cropBH / 2)));

        filterComplex = [
          // Face A: crop around face, scale to fill slot
          `[0:v]fps=${fps},crop=${cropAW}:${cropAH}:${cropAX}:${cropAY},scale=${canvasW}:${slotH}:flags=lanczos,setsar=1[duoA]`,
          // Face B: crop around face, scale to fill slot
          `[0:v]fps=${fps},crop=${cropBW}:${cropBH}:${cropBX}:${cropBY},scale=${canvasW}:${slotH}:flags=lanczos,setsar=1[duoB]`,
          // Dark divider line (2px)
          `color=c=0x1a1a1a:s=${canvasW}x${divH}:r=${fps},format=yuv420p[duoDiv]`,
          // Stack: A on top, divider, B on bottom
          `[duoA][duoDiv][duoB]vstack=inputs=3[composed]`,
        ].join(';');
        mapVideo = '[composed]';
        console.log(`[FFmpeg] Duo layout: faceA(${cropAX},${cropAY},${cropAW}x${cropAH}) top, faceB(${cropBX},${cropBY},${cropBW}x${cropBH}) bottom, div=${divH}px`);
      } else if (isSplitScreen) {
        // SPLIT-SCREEN MODE: content top 55% (1056px), gameplay bottom 45% (864px).
        // Gameplay is a looping muted video from Supabase Storage, desaturated slightly.
        const contentH = Math.round(canvasH * 0.55); // 1056 at 1080x1920
        const gameplayH = canvasH - contentH;          // 864

        // Content: crop source to fill width, anchor-aware crop height
        const contentCropY = cropAnchor === 'bottom' ? `ih-${contentH}` : cropAnchor === 'top' ? '0' : `(ih-${contentH})/2`;
        const contentFilter = `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCropY},scale=${canvasW}:${contentH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${contentH}:(iw-${canvasW})/2:${contentCropY},setsar=1[sscontent]`;

        // Gameplay: input will be added with -stream_loop -1 -ss offset -an
        // The gameplay input index is tracked as gpInputIdx (set outside this block)
        const gpFilter = `[${splitScreen._inputIdx}:v]fps=${fps},scale=${canvasW}:${gameplayH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${gameplayH}:(iw-${canvasW})/2:(ih-${gameplayH})/2,eq=saturation=0.9,setsar=1[ssgameplay]`;

        filterComplex = [contentFilter, gpFilter, `[sscontent][ssgameplay]vstack=inputs=2[composed]`].join(';');
        mapVideo = '[composed]';
        console.log(`[FFmpeg] Split-screen: content ${canvasW}x${contentH} top (55%), gameplay ${canvasW}x${gameplayH} bottom (45%), anchor=${cropAnchor}`);
      } else if (useFullFrame) {
        // FULL-FRAME MODE: center crop directly to 9:16 (no blurred padding).
        const ffCropY = cropAnchor === 'bottom' ? `ih-${canvasH}` : cropAnchor === 'top' ? '0' : `(ih-${canvasH})/2`;
        if (cropAnchor === 'bottom') console.log('[FFmpeg] CROP: anchored to bottom (burned captions) — fullframe');
        filterComplex = `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCropY},scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:${ffCropY},setsar=1[composed]`;
        mapVideo = '[composed]';
        console.log(`[FFmpeg] Full-frame crop: ${canvasW}x${canvasH}, border trim ${borderCrop}px, anchor=${cropAnchor}`);
      } else if (useFit) {
        // FIT MODE: preserve full image, scale to fill width, cinematic blurred padding.
        // Deep blur (sigma=24), dark (-0.45), heavily desaturated (s=0.5) → neutral texture.
        // Used for gameplay, IRL wide shots — content stays fully visible.
        filterComplex = [
          `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCropY},split=2[fitfg][fitbg]`,
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
            `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCropY},split=2[wpfg][wpbg]`,
            `[wpbg]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=6,eq=brightness=-0.45,hue=s=0.85,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[wpbgout]`,
            `[wpfg]scale=${bigW}:${bigH}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[wpfgscaled]`,
            `[wpbgout][wpfgscaled]overlay=(W-w)/2:(H-h)/2[composed]`,
          ].join(';');
        } else {
          filterComplex = [
            `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCropY},split=2[wpfg2][wpbg2]`,
            `[wpbg2]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=6,eq=brightness=-0.45,hue=s=0.85,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[wpbgout2]`,
            `[wpfg2]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[wpfgout2]`,
            `[wpbgout2][wpfgout2]overlay=(W-w)/2:(H-h)/2[composed]`,
          ].join(';');
        }
        mapVideo = '[composed]';
      } else if (smartZoomActive) {
        const szCropY = cropAnchor === 'bottom' ? `ih-${canvasH}` : cropAnchor === 'top' ? '0' : `(ih-${canvasH})/2`;
        filterComplex = `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCropY},scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:${szCropY},setsar=1[composed]`;
        mapVideo = '[composed]';
      } else {
        const fgW = Math.round(canvasW * zoomFactor);
        const fgH = Math.round(canvasH * zoomFactor);
        // Background: blurred letterbox when backgroundBlur=true, solid black when false
        const bgChain = backgroundBlur
          ? `[srcbg]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=6,eq=brightness=-0.45,hue=s=0.85,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[bg]`
          : `[srcbg]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:(ih-${canvasH})/2,drawbox=x=0:y=0:w=${canvasW}:h=${canvasH}:color=black:t=fill,setsar=1[bg]`;
        filterComplex = [
          `[0:v]fps=${fps},crop=in_w-${borderCrop*2}:in_h-${borderCrop*2}:${borderCrop}:${borderCropY},split=2[srcfg][srcbg]`,
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
          zoomChain = buildFollowFaceFilter(mapVideo, '[zoomed]', canvasW, canvasH, smartZoom.faceKeyframes, clipDuration, followZoomBudget, cropAnchor);
          console.log(`[FFmpeg] Face follow: zoom=${followZoomBudget.toFixed(2)}x (${followZoomBudget <= 1.01 ? 'PAN ONLY' : 'pan+zoom'})`);
        }
        if (!zoomChain) {
          const fallbackMode = (smartZoom.mode === 'follow') ? 'micro' : (smartZoom.mode || 'micro');
          zoomChain = buildSmartZoomFilter(mapVideo, '[zoomed]', canvasW, canvasH, clipDuration, fallbackMode, audioPeaks, cropAnchor, diversify);
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
      // Hook auto-hides after 4s with 0.3s fade-out — never stays the whole video
      const HOOK_MAX_DISPLAY = 4;
      const hookDisplayLength = Math.min(HOOK_MAX_DISPLAY, (hook && hook.length > 0) ? hook.length : clipDuration);
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
          const hookFontSize = Math.round(canvasW * 0.044);
          filterComplex += `;${mapVideo}drawtext=text='${safeText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=${hookFontSize}:fontcolor=0x${hookFontColor}@0xff:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*${posPct}/100-text_h/2${enableExpr}[hooktext]`;
          mapVideo = '[hooktext]';
        }
      }

      // ── Step 8: Watermark ──
      // Free plan: Viral Animal logo (vps/assets/watermark.png), semi-transparent.
      // Pro/Studio: no watermark. Studio with custom brand logo: same position.
      if (watermark && watermark.logoPath) {
        const wmFilter = buildWatermarkFilter(watermark, mapVideo, plan, clipDuration);
        if (wmFilter) {
          filterComplex += `;${wmFilter}[watermarked]`;
          mapVideo = '[watermarked]';
          console.log(`[FFmpeg] Watermark applied: ${watermark.type || 'viral-animal'}`);
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
        const hookDelay = diversify?.hookDelayS ?? 0;
        const fadeIn = 0.3;
        const fadeOut = 0.3;
        const hLen = hookOverlayEntry.hookLength || clipDuration;
        let fadeFilters = `fade=t=in:st=${hookDelay.toFixed(2)}:d=${fadeIn}:alpha=1`;
        if (hLen < clipDuration) {
          fadeFilters += `,fade=t=out:st=${(hLen + hookDelay).toFixed(2)}:d=${fadeOut}:alpha=1`;
        }
        // Browser overlays are always captured at 1080x1920 — rescale to the
        // active tier canvas so the capsule stays proportional on 720p fallbacks.
        const CAPTURE_W = 1080;
        const hookScale = canvasW / CAPTURE_W;
        // Diversify: hook size ±5%
        const hookSizeMult = 1 + (diversify?.hookSizePct ?? 0) / 100;
        const effectiveHookScale = hookScale * hookSizeMult;
        const hookScaleFilter = `scale=trunc(iw*${effectiveHookScale.toFixed(4)}/2)*2:-2:flags=lanczos,`;
        filterComplex += `;[${hookInputIndex}:v]format=rgba,${hookScaleFilter}${fadeFilters}[hookalpha]`;
        const isCapsule = hookOverlayEntry.isCapsuleOnly;
        // Diversify: hook position ±4%
        const hookPosOffset = diversify?.hookPosPct ?? 0;
        const posPct = (hookOverlayEntry.textPosition || 18) + hookPosOffset;
        const overlayX = isCapsule ? '(W-w)/2' : '0';
        // Render parity: the live preview anchors the capsule TOP edge at posPct%
        // (CSS `top: pct%`, no translateY — see live-preview.tsx). The browser PNG
        // has ~extraPad transparent padding above the capsule (sticker: round(4*1080/280)=15px,
        // outline: ~31px). Offset so the visible capsule top lands at posPct%.
        const hookGlowPad = Math.round(20 * hookScale);
        const overlayY = isCapsule ? `H*${posPct.toFixed(2)}/100-${hookGlowPad}` : '0';
        filterComplex += `;${mapVideo}[hookalpha]overlay=${overlayX}:${overlayY}:format=auto[hooked]`;
        mapVideo = '[hooked]';
      }

      // ── Invisible grain (diversify: imperceptible noise, unique pixel hash) ──
      const grain = diversify?.grainStrength ?? 2;
      if (grain > 0) {
        filterComplex += `;${mapVideo}noise=alls=${grain}:allf=t[grained]`;
        mapVideo = '[grained]';
      }

      // ── Color micro-shift (diversify: hue/saturation/brightness, breaks perceptual hash) ──
      // Defensive defaults: a missing field must never reach FFmpeg as `undefined`.
      const dHue = Number.isFinite(diversify?.hueDeg) ? diversify.hueDeg : 0;
      const dSat = Number.isFinite(diversify?.saturation) ? diversify.saturation : 1;
      const dBri = Number.isFinite(diversify?.brightness) ? diversify.brightness : 0;
      if (diversify && (dHue > 0 || dSat !== 1 || dBri !== 0)) {
        const huePart = (dHue > 0 || dSat !== 1) ? `hue=h=${dHue}:s=${dSat}` : null;
        const eqPart = dBri !== 0 ? `eq=brightness=${dBri}` : null;
        if (huePart) {
          filterComplex += `;${mapVideo}${huePart}[hued]`;
          mapVideo = '[hued]';
        }
        if (eqPart) {
          filterComplex += `;${mapVideo}${eqPart}[eqd]`;
          mapVideo = '[eqd]';
        }
      }

      // ── Terminal format=yuv420p ──
      filterComplex += `;${mapVideo}format=yuv420p[vout]`;
      mapVideo = '[vout]';

      // ── Audio chain: base filters ──
      // Order matters: enhance first (clean source), then shift last (anti-fingerprint).
      // Previous chain (afftdn=nf=-25 + loudnorm linear=false) caused metallic
      // echo artifacts and audible pumping on stream audio. New chain uses a gentle
      // compressor + limiter instead — musical loudness without breathing/artifacts.
      const audioFilters = [];

      if (audioEnhance) {
        audioFilters.push(
          'highpass=f=80',
          'acompressor=threshold=-24dB:ratio=3:attack=10:release=200:knee=6',
          'alimiter=limit=0.95:level=false',
          'volume=1.5',
        );
        console.log('[FFmpeg] Audio enhancement: highpass + gentle compressor + limiter (no denoiser — stream audio is clean)');
      }

      // Audio shift — after enhance, before loudnorm.
      const audioShiftPct = diversify?.audioShiftPct ?? 1;
      const audioShift = buildAudioShiftFilters(48000, audioShiftPct);
      audioFilters.push(...audioShift.filters);
      console.log(`[FFmpeg] Audio fingerprint shift: +${audioShiftPct}% asetrate/atempo (anti-duplicate)`);

      // Loudnorm: EBU R128 normalization. Single-pass, no linear=true, no alimiter.
      // TP=-2.0 (not -1.5) accounts for AAC encoder overshoot.
      // Previous linear=true + alimiter combo caused metallic artifacts — removed.
      audioFilters.push('loudnorm=I=-14:TP=-2.0:LRA=11');
      console.log('[FFmpeg] Loudnorm: I=-14 TP=-2.0 LRA=11 (single-pass, no linear, no alimiter)');

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

      // ── SFX: add WAV inputs ──
      const hasSfx = Array.isArray(sfxPaths) && sfxPaths.length > 0;
      let sfxInputIdxStart = inputIdx;
      if (hasSfx) {
        for (const sfx of sfxPaths) {
          args.push('-i', sfx.path);
          inputIdx++;
        }
        console.log(`[FFmpeg] SFX: added ${sfxPaths.length} WAV inputs at indices ${sfxInputIdxStart}-${inputIdx - 1}`);
      }

      // ── Gameplay (split-screen): add looping video input (audio ignored via -map) ──
      if (isSplitScreen) {
        const seekOffset = splitScreen.seekOffset ?? 0;
        args.push('-stream_loop', '-1', '-ss', String(seekOffset), '-i', splitScreen.gameplayPath);
        splitScreen._inputIdx = inputIdx;
        inputIdx++;
        console.log(`[FFmpeg] Gameplay input: idx=${splitScreen._inputIdx}, seek=${seekOffset}s, path=${splitScreen.gameplayPath}`);
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

        // ── SFX mix into voiceover path ──
        let audioOutLabel = '[aout]';
        if (hasSfx) {
          audioFC += buildSfxMixChain(sfxPaths, sfxInputIdxStart, '[aout]', '[asfx]', clipDuration);
          audioOutLabel = '[asfx]';
        }

        // Combine video + audio filter graphs into one -filter_complex
        filterComplex += ';' + audioFC;
        args.push('-filter_complex', filterComplex);
        args.push('-map', mapVideo);
        args.push('-map', audioOutLabel);
        args.push(...buildCommonEncodingArgs(tier, fps, clipDuration, diversify));
        args.push('-c:a', 'aac', '-b:a', tier.audioBitrate, '-ar', '48000', '-ac', '2');

        console.log(`[FFmpeg] Voiceover mix: ${voiceoverPaths.length} lines with sidechaincompress ducking${hasSfx ? ` + ${sfxPaths.length} SFX` : ''}`);
      } else if (hasSfx) {
        // No voiceover but HAS SFX — need filter_complex for audio too
        const baseAudio = audioFilters.length > 0
          ? `[0:a]${audioFilters.join(',')}[abase]`
          : `[0:a]acopy[abase]`;
        const sfxChain = buildSfxMixChain(sfxPaths, sfxInputIdxStart, '[abase]', '[asfx]', clipDuration);
        filterComplex += ';' + baseAudio + sfxChain;
        args.push('-filter_complex', filterComplex);
        args.push('-map', mapVideo);
        args.push('-map', '[asfx]');
        args.push(...buildCommonEncodingArgs(tier, fps, clipDuration, diversify));
        args.push('-c:a', 'aac', '-b:a', tier.audioBitrate, '-ar', '48000', '-ac', '2');
        console.log(`[FFmpeg] SFX mix: ${sfxPaths.length} effects (no voiceover)`);
      } else {
        // No voiceover, no SFX — video filter_complex + simple -af audio chain
        args.push('-filter_complex', filterComplex);
        args.push('-map', mapVideo);
        args.push('-map', '0:a?');
        args.push(...buildCommonEncodingArgs(tier, fps, clipDuration, diversify));
        if (audioFilters.length > 0) {
          args.push('-af', audioFilters.join(','));
        }
        args.push('-c:a', 'aac', '-b:a', tier.audioBitrate, '-ar', '48000', '-ac', '2');
      }

      // speedRamp video filters removed — setpts via -vf conflicts with -filter_complex.
      // speedRamp is not currently exposed via the route. If re-enabled, integrate setpts
      // into the filter_complex chain before [vout].
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
// buildPngCaptionChain — REMOVED (dead code, all captions use ASS subtitles now)

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
  if (!watermark) return null;

  // 'viral-animal' = free plan default logo, 'custom' = studio user-uploaded logo
  const logoPath = watermark.logoPath;
  if (!logoPath) return null;

  // Scale to 18% of canvas width, semi-transparent, above TikTok UI dead zone
  return `movie=${logoPath},scale=iw*0.18:-1,format=yuva420p,colorchannelmixer=aa=0.55[wm];${position}[wm]overlay=W-w-40:H-h-360:format=auto`;
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
