import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { analyzeAudioPeaks } from './audio-peaks.js';

const execFileAsync = promisify(execFile);

/**
 * FFmpeg render engine for Viral Studio Pro
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
    .replace(/'/g, "\\'")
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

    return `${inLabel}scale=w='${scaledW}':h='${scaledH}':eval=frame,crop=${canvasW}:${canvasH},setsar=1${outLabel}`;
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

    return `${inLabel}scale=w='${scaledW}':h='${scaledH}':eval=frame,crop=${canvasW}:${canvasH},setsar=1${outLabel}`;
  }

  // Dynamic requested but no peaks → fall back to micro.
  // Follow mode not yet implemented → also micro.
  if (mode === 'dynamic' || mode === 'follow') {
    return buildSmartZoomFilter(inLabel, outLabel, canvasW, canvasH, clipDuration, 'micro');
  }

  return null;
}

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
  const scaleFilter = `scale=${targetW}:${targetH}`;

  return `${cropFilter},${scaleFilter},setsar=1`;
}

/**
 * Main render function: cuts, reframes, and applies filters to a video.
 * Supports split-screen compositing with a B-roll video.
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
    crf = 23,
    timeout = 300000,
    smartZoom = null,
    videoZoom = 'fill',
  } = options;

  if (!inputPath || !outputPath) {
    throw new Error('inputPath and outputPath are required');
  }

  const clipDuration = duration || (endTime - startTime);
  if (clipDuration > maxDuration) {
    throw new Error(`Clip duration ${clipDuration}s exceeds max ${maxDuration}s`);
  }

  // ── Audio peak detection for Dynamic smart zoom ─────────────────────────
  let audioPeaks = [];
  if (smartZoom && smartZoom.enabled && smartZoom.mode === 'dynamic') {
    try {
      audioPeaks = await analyzeAudioPeaks(inputPath, startTime, clipDuration);
    } catch (err) {
      console.warn('[FFmpeg] Audio peak analysis failed, falling back to micro:', err.message);
      audioPeaks = [];
    }
  }

  // ── Split-screen render path ────────────────────────────────────────────
  if (splitScreen && splitScreen.enabled && splitScreen.brollPath) {
    return renderSplitScreen(inputPath, outputPath, {
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
      crf,
      timeout,
      smartZoom,
      audioPeaks,
    });
  }

  // ── Standard (single video) render path ─────────────────────────────────
  // Use blur-background compositing: blurred fill + sharp centered video
  // This keeps the original video resolution without cropping content.

  // MEMORY OPTIMIZATION: Use 720p canvas for ALL renders on Railway.
  // 1080p causes OOM/SIGABRT with blur+ASS+smartzoom combined.
  const isWordPopAnimation = captions && captions.animation === 'word-pop';

  const ratios = { '9:16': { w: 720, h: 1280 }, '1:1': { w: 720, h: 720 }, '16:9': { w: 1280, h: 720 } };
  const { w: canvasW, h: canvasH } = ratios[aspectRatio] || ratios['9:16'];

  // Disable smart zoom for word-pop (the pop animation IS the visual interest).
  const shouldDisableSmartZoom = isWordPopAnimation && smartZoom && smartZoom.enabled;

  // DEBUG: Log captions object structure
  console.log('[FFmpeg] Captions object:', {
    hasCaption: !!captions,
    captionAnimation: captions?.animation,
    hasAssFilePath: !!captions?.assFilePath,
    isWordPopAnimation,
  });

  if (shouldDisableSmartZoom) {
    console.log('[FFmpeg] Word-pop animation detected: disabling smart zoom to prevent OOM');
  }

  // Compositing: blur-fill background + centered foreground
  // For word-pop: skip blur (split=2 doubles RAM) — use black bg + centered video instead.
  // This halves memory usage and prevents SIGABRT/OOM on Railway.
  let filterComplex;
  let mapVideo;

  const smartZoomActive = smartZoom && smartZoom.enabled && !shouldDisableSmartZoom;

  // videoZoom: 'contain' = full video visible, 'fill' = 115% contain, 'immersive' = 135% contain
  // Fill/Immersive: scale video to contain in a LARGER area than canvas, then overlay centered
  // This keeps the video landscape (horizontal) but makes it bigger — matching the CSS preview
  const zoomFactor = videoZoom === 'immersive' ? 1.35 : videoZoom === 'fill' ? 1.15 : 1.0;

  if (isWordPopAnimation) {
    // WORD-POP PATH: scale to fit + pad with black (no split, no blur)
    if (zoomFactor > 1.0) {
      // Zoomed word-pop: contain in larger area, then crop to canvas, with blur bg
      const bigW = Math.round(canvasW * zoomFactor);
      const bigH = Math.round(canvasH * zoomFactor);
      console.log(`[FFmpeg] Word-pop + zoom(${Math.round(zoomFactor*100)}%): contain ${bigW}x${bigH} then crop to ${canvasW}x${canvasH}`);
      filterComplex = [
        `[0:v]fps=30,split=2[wpfg][wpbg]`,
        `[wpbg]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=12,eq=brightness=-0.35:saturation=1.25:contrast=1.1,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[wpbgout]`,
        `[wpfg]scale=${bigW}:${bigH}:force_original_aspect_ratio=decrease,setsar=1[wpfgscaled]`,
        `[wpbgout][wpfgscaled]overlay=(W-w)/2:(H-h)/2,format=yuv420p[composed]`,
      ].join(';');
    } else {
      console.log('[FFmpeg] Word-pop: pad compositing (no blur)');
      filterComplex = `[0:v]fps=30,scale=${canvasW}:${canvasH}:force_original_aspect_ratio=decrease,pad=${canvasW}:${canvasH}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=yuv420p[composed]`;
    }
    mapVideo = '[composed]';
  } else if (smartZoomActive) {
    // SMART ZOOM PATH: scale to COVER + center crop (no pad, no blur, no split)
    console.log('[FFmpeg] Smart zoom: cover+crop compositing (no blur, no black bars)');
    filterComplex = `[0:v]fps=30,scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:(ih-${canvasH})/2,setsar=1,format=yuv420p[composed]`;
    mapVideo = '[composed]';
  } else {
    // STANDARD PATH: blur-fill compositing (matches UI preview)
    // Zoom: contain in larger area (bigW x bigH), overlay centered on blur bg
    // Video stays landscape, just bigger — blur visible in remaining space
    const fgW = Math.round(canvasW * zoomFactor);
    const fgH = Math.round(canvasH * zoomFactor);
    console.log(`[FFmpeg] Standard blur-fill + zoom(${Math.round(zoomFactor*100)}%): contain ${fgW}x${fgH}`);
    filterComplex = [
      `[0:v]fps=30,split=2[srcfg][srcbg]`,
      `[srcbg]scale=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:force_original_aspect_ratio=increase,crop=${Math.round(canvasW/4)}:${Math.round(canvasH/4)}:(iw-${Math.round(canvasW/4)})/2:(ih-${Math.round(canvasH/4)})/2,gblur=sigma=12,eq=brightness=-0.35:saturation=1.25:contrast=1.1,scale=${canvasW}:${canvasH}:flags=bilinear,setsar=1[bg]`,
      `[srcfg]scale=${fgW}:${fgH}:force_original_aspect_ratio=decrease,setsar=1[fg]`,
      `[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[composed]`,
    ].join(';');
    mapVideo = '[composed]';
  }

  // Smart Zoom (applied on composed output, BEFORE captions/tags so they stay crisp)
  // DISABLED if word-pop animation is active (memory protection)
  if (smartZoom && smartZoom.enabled && !shouldDisableSmartZoom) {
    const zoomChain = buildSmartZoomFilter(
      mapVideo, '[zoomed]', canvasW, canvasH, clipDuration, smartZoom.mode || 'micro', audioPeaks
    );
    if (zoomChain) {
      filterComplex += `;${zoomChain}`;
      mapVideo = '[zoomed]';
      console.log(`[FFmpeg] Smart Zoom applied: mode=${smartZoom.mode || 'micro'}, peaks=${audioPeaks.length}`);
    }
  }

  // Captions: ASS subtitle rendering (all animations including word-pop)
  const extraInputs = [];
  if (captions && captions.assFilePath) {
    filterComplex += `;${mapVideo}ass='${escapePath(captions.assFilePath)}':fontsdir='/usr/share/fonts'[captioned]`;
    mapVideo = '[captioned]';
    console.log(`[FFmpeg] ASS captions applied: ${captions.assFilePath}`);
  }

  // Tag / Credit overlay
  if (tag) {
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

  // Watermark
  if (watermark && (plan === 'free' || (plan !== 'free' && watermark.logoPath))) {
    const watermarkFilter = buildWatermarkFilter(watermark, watermarkPosition, plan);
    if (watermarkFilter) {
      filterComplex += `;${mapVideo}${watermarkFilter}[watermarked]`;
      mapVideo = '[watermarked]';
    }
  }

  console.log(`[FFmpeg] Standard render filter_complex (${filterComplex.length} chars):`);
  if (filterComplex.includes('drawtext=')) {
    const dtCount = (filterComplex.match(/drawtext=/g) || []).length;
    console.log(`[FFmpeg]   - drawtext filters detected: ${dtCount}`);
  } else if (filterComplex.includes('ass=')) {
    const assMatch = filterComplex.match(/ass='[^']*'/);
    console.log(`[FFmpeg]   - ASS filter detected: ${assMatch ? assMatch[0] : 'PATTERN NOT FOUND'}`);
  } else {
    console.log(`[FFmpeg]   - No caption filters in chain`);
  }
  console.log(`[FFmpeg] Map video: ${mapVideo}`);

  // Build FFmpeg command
  const args = ['-y'];
  args.push('-ss', String(startTime));
  args.push('-i', inputPath);
  // PNG caption overlay inputs (gated by -itsoffset + -t so each PNG only
  // occupies the decode pipeline during its active window — memory friendly).
  for (const overlay of extraInputs) {
    const ts = Math.max(0, overlay.startTime);
    const td = Math.max(0.01, overlay.endTime - overlay.startTime);
    args.push('-loop', '1', '-t', td.toFixed(3), '-itsoffset', ts.toFixed(3), '-i', overlay.pngPath);
  }
  args.push('-t', String(clipDuration));
  args.push('-filter_complex', filterComplex);
  args.push('-map', mapVideo);
  args.push('-map', '0:a?');

  args.push('-c:v', 'libx264');
  args.push('-preset', 'ultrafast');  // Use ultrafast to minimize memory (Railway OOM)
  args.push('-tune', 'fastdecode');   // Reduce decode complexity = less memory
  args.push('-threads', '1');          // Single thread to reduce memory footprint
  args.push('-filter_threads', '1');
  args.push('-filter_complex_threads', '1');
  args.push('-crf', String(crf));
  args.push('-maxrate', '1500k');      // Lower bitrate cap to reduce memory pressure
  args.push('-bufsize', '3M');
  args.push('-c:a', 'aac');
  args.push('-b:a', '96k');           // Lower audio bitrate to save size
  args.push('-movflags', '+faststart');
  args.push('-pix_fmt', 'yuv420p');
  args.push('-max_muxing_queue_size', '256'); // Limit muxer buffer to prevent OOM
  args.push(outputPath);

  return execRender(args, outputPath, timeout);
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
    crf,
    timeout,
    smartZoom,
    audioPeaks = [],
  } = opts;

  const layout = splitScreen.layout || 'top-bottom';
  const ratio = Math.max(30, Math.min(70, splitScreen.ratio || 50)) / 100; // 0.3–0.7
  const brollPath = splitScreen.brollPath;

  // Use 720p for split-screen to reduce memory (Railway OOM at 1080p)
  const ratios = {
    '9:16': { w: 720, h: 1280 },
    '1:1': { w: 720, h: 720 },
    '16:9': { w: 1280, h: 720 },
  };
  const { w: canvasW, h: canvasH } = ratios[aspectRatio] || ratios['9:16'];

  // Build the complex filter graph
  let filterComplex = '';
  let mapVideo = '';

  if (layout === 'top-bottom') {
    // ── Top-Bottom split ──────────────────────────────────────────────────
    const topH = Math.round(canvasH * ratio);
    const botH = canvasH - topH;

    filterComplex = [
      // Scale + crop main video to top region, normalize fps
      `[0:v]fps=30,scale=${canvasW}:${topH}:force_original_aspect_ratio=increase,crop=${canvasW}:${topH}:(iw-${canvasW})/2:(ih-${topH})/2,setsar=1[main]`,
      // Scale + crop B-roll to bottom region, loop if shorter, normalize fps
      `[1:v]loop=loop=-1:size=900:start=0,fps=30,scale=${canvasW}:${botH}:force_original_aspect_ratio=increase,crop=${canvasW}:${botH}:(iw-${canvasW})/2:(ih-${botH})/2,setsar=1[broll]`,
      // Stack vertically
      `[main][broll]vstack=inputs=2[composed]`,
    ].join(';');
    mapVideo = '[composed]';

  } else if (layout === 'side-by-side') {
    // ── Side-by-Side split ────────────────────────────────────────────────
    const leftW = Math.round(canvasW * ratio);
    const rightW = canvasW - leftW;

    filterComplex = [
      `[0:v]fps=30,scale=${leftW}:${canvasH}:force_original_aspect_ratio=increase,crop=${leftW}:${canvasH}:(iw-${leftW})/2:(ih-${canvasH})/2,setsar=1[main]`,
      `[1:v]loop=loop=-1:size=900:start=0,fps=30,scale=${rightW}:${canvasH}:force_original_aspect_ratio=increase,crop=${rightW}:${canvasH}:(iw-${rightW})/2:(ih-${canvasH})/2,setsar=1[broll]`,
      `[main][broll]hstack=inputs=2[composed]`,
    ].join(';');
    mapVideo = '[composed]';

  } else if (layout === 'pip') {
    // ── Picture-in-Picture ────────────────────────────────────────────────
    const pipW = Math.round(canvasW * 0.35);
    const pipH = Math.round(canvasH * 0.35);
    const pipX = canvasW - pipW - 20; // 20px margin right
    const pipY = canvasH - pipH - 20; // 20px margin bottom

    filterComplex = [
      `[0:v]fps=30,scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:(ih-${canvasH})/2,setsar=1[main]`,
      `[1:v]loop=loop=-1:size=900:start=0,fps=30,scale=${pipW}:${pipH}:force_original_aspect_ratio=increase,crop=${pipW}:${pipH}:(iw-${pipW})/2:(ih-${pipH})/2,setsar=1[broll]`,
      `[main][broll]overlay=${pipX}:${pipY}[composed]`,
    ].join(';');
    mapVideo = '[composed]';

  } else {
    // Fallback: treat unknown layout as top-bottom
    return renderSplitScreen(inputPath, outputPath, {
      ...opts,
      splitScreen: { ...splitScreen, layout: 'top-bottom' },
    });
  }

  // Smart Zoom (applied on composed output, BEFORE captions/tags so they stay crisp)
  if (smartZoom && smartZoom.enabled) {
    const zoomChain = buildSmartZoomFilter(
      mapVideo, '[zoomed]', canvasW, canvasH, clipDuration, smartZoom.mode || 'micro', audioPeaks
    );
    if (zoomChain) {
      filterComplex += `;${zoomChain}`;
      mapVideo = '[zoomed]';
      console.log(`[FFmpeg-Split] Smart Zoom applied: mode=${smartZoom.mode || 'micro'}, peaks=${audioPeaks.length}`);
    }
  }

  // Apply captions on the composed output — ASS subtitle rendering (all animations)
  const extraInputs = [];
  if (captions && captions.assFilePath) {
    filterComplex += `;${mapVideo}ass='${escapePath(captions.assFilePath)}':fontsdir='/usr/share/fonts'[captioned]`;
    mapVideo = '[captioned]';
    console.log(`[FFmpeg-Split] ASS captions applied: ${captions.assFilePath}`);
  }

  // Apply tag / credit overlay on composed output
  if (tag) {
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

  // Apply watermark on composed output
  if (watermark && (plan === 'free' || (plan !== 'free' && watermark.logoPath))) {
    const wmFilter = buildWatermarkFilter(watermark, watermarkPosition, plan);
    if (wmFilter) {
      filterComplex += `;${mapVideo}${wmFilter}[watermarked]`;
      mapVideo = '[watermarked]';
    }
  }

  // Build args
  const args = ['-y'];
  args.push('-ss', String(startTime));
  args.push('-i', inputPath);           // Input 0: main video
  args.push('-i', brollPath);           // Input 1: B-roll video
  // PNG caption overlay inputs (gated by -itsoffset + -t so each PNG only
  // occupies the decode pipeline during its active window — memory friendly).
  for (const overlay of extraInputs) {
    const ts = Math.max(0, overlay.startTime);
    const td = Math.max(0.01, overlay.endTime - overlay.startTime);
    args.push('-loop', '1', '-t', td.toFixed(3), '-itsoffset', ts.toFixed(3), '-i', overlay.pngPath);
  }
  args.push('-t', String(clipDuration));
  args.push('-filter_complex', filterComplex);
  args.push('-map', mapVideo);
  args.push('-map', '0:a?');             // Keep audio from main video (if exists)
  args.push('-c:v', 'libx264');
  args.push('-preset', 'ultrafast');     // Use ultrafast to minimize memory (Railway OOM)
  args.push('-threads', '1');            // Single thread to reduce memory footprint
  args.push('-filter_threads', '1');
  args.push('-filter_complex_threads', '1');
  args.push('-crf', String(Math.max(crf, 28))); // Higher CRF for split-screen to save memory + size
  args.push('-maxrate', '1.5M');         // Cap bitrate for faster streaming from Supabase
  args.push('-bufsize', '3M');
  args.push('-c:a', 'aac');
  args.push('-b:a', '96k');
  args.push('-max_muxing_queue_size', '256'); // Limit muxer buffer to prevent OOM
  args.push('-movflags', '+faststart');
  args.push('-pix_fmt', 'yuv420p');
  args.push('-shortest');                // End when shortest input ends
  args.push(outputPath);

  console.log(`[FFmpeg] Split-screen render: layout=${layout}, ratio=${ratio}, broll=${brollPath}`);
  return execRender(args, outputPath, timeout);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared FFmpeg execution
// ─────────────────────────────────────────────────────────────────────────────

async function execRender(args, outputPath, timeout = 300000) {
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
    return { success: true, outputPath };
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
    throw new Error(`FFmpeg render failed: ${diagnostic}`);
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
function buildTagFilter(tagConfig, canvasW = 720, canvasH = 1280, inputLabel = null) {
  if (!tagConfig || tagConfig.style === 'none' || (!tagConfig.authorName && !tagConfig.authorHandle)) {
    return null;
  }

  const handle = tagConfig.authorHandle
    ? `@${tagConfig.authorHandle.replace(/^@/, '')}`
    : tagConfig.authorName || '';
  const displayText = escapeDrawtext(handle);
  const fontFile = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

  switch (tagConfig.style) {
    case 'badge-top': {
      // Rounded pill: small dark semi-transparent badge in top-right
      // UI: bg-black/60 rounded-full px-2.5 py-1, text-xs font-bold white
      const fontSize = Math.round(canvasW * 0.028); // matches text-xs scaled
      const padX = Math.round(canvasW * 0.025);
      const padY = Math.round(canvasH * 0.018);
      // boxborderw gives us the rounded-ish padding illusion
      return `drawtext=text='${displayText}':fontfile=${fontFile}:fontcolor=white:fontsize=${fontSize}:x=W-tw-${padX * 2}-${padX}:y=${padY}:box=1:boxcolor=0x000000@0.70:boxborderw=${Math.round(fontSize * 0.55)}:shadowcolor=0x000000@0.5:shadowx=1:shadowy=2`;
    }

    case 'watermark-center': {
      // UI: text-2xl font-black text-white/15 rotate-[-20deg]
      // Render a rotated semi-transparent watermark via a synthetic canvas +
      // rotate + overlay chain. We need a multi-filter graph fragment here.
      const fontSize = Math.round(canvasW * 0.13); // bigger so clearly visible in video
      // Rotation of -20 degrees = -0.349 rad.
      // 0.30 opacity + shadow for visibility against any background.
      const angleRad = '-0.349066'; // -20 degrees
      const canvasSize = `${canvasW}x${Math.round(canvasH * 0.35)}`;
      const chain = [
        `color=c=0x000000@0.0:s=${canvasSize}:r=30:d=600,format=yuva420p[wcbg]`,
        `[wcbg]drawtext=text='${displayText}':fontfile=${fontFile}:fontcolor=white@0.40:fontsize=${fontSize}:x=(w-text_w)/2:y=(h-text_h)/2:shadowcolor=black@0.7:shadowx=4:shadowy=4:borderw=2:bordercolor=black@0.5[wctxt]`,
        `[wctxt]rotate=${angleRad}:c=none:ow=rotw(${angleRad}):oh=roth(${angleRad})[wcrot]`,
        `${inputLabel}[wcrot]overlay=(W-w)/2:(H-h)/2:format=auto`,
      ].join(';');
      return { chain, complex: true };
    }

    case 'banner-bottom': {
      // UI: bg-gradient-to-t from-black/80 to-transparent, discord icon + handle
      // Fake a gradient with 3 stacked boxes of decreasing opacity (top→bottom fade-in)
      const barH = Math.round(canvasH * 0.07); // 7% of height
      const fontSize = Math.round(canvasW * 0.04);
      const textY = canvasH - barH + Math.round((barH - fontSize) / 2) - Math.round(fontSize * 0.1);
      const topY = canvasH - barH;
      const band = Math.round(barH / 3);
      return [
        // Top band (lightest, fades in)
        `drawbox=x=0:y=${topY}:w=iw:h=${band}:color=0x000000@0.35:thickness=fill`,
        // Middle band
        `drawbox=x=0:y=${topY + band}:w=iw:h=${band}:color=0x000000@0.60:thickness=fill`,
        // Bottom band (darkest)
        `drawbox=x=0:y=${topY + band * 2}:w=iw:h=${barH - band * 2}:color=0x000000@0.85:thickness=fill`,
        // Handle text centered
        `drawtext=text='${displayText}':fontfile=${fontFile}:fontcolor=white:fontsize=${fontSize}:x=(W-tw)/2:y=${textY}:shadowcolor=0x000000@0.6:shadowx=2:shadowy=2`,
      ].join(',');
    }

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Watermark
// ─────────────────────────────────────────────────────────────────────────────

function buildWatermarkFilter(watermark, position, plan) {
  if (plan !== 'free' && !watermark.logoPath) {
    return null;
  }

  if (plan === 'free') {
    const posCoords = getWatermarkCoordinates(position);
    return `drawtext=text='Viral Studio Pro':fontsize=28:fontcolor=white@0.75:shadowcolor=black@0.5:shadowx=1:shadowy=1:x=${posCoords.x}:y=${posCoords.y}`;
  }

  return null;
}

function getWatermarkCoordinates(position = 'bottom-right') {
  const coords = {
    'top-left': { x: 'W*0.03', y: 'H*0.03' },
    'top-right': { x: 'W-tw-W*0.03', y: 'H*0.03' },
    'bottom-left': { x: 'W*0.03', y: 'H-th-H*0.03' },
    'bottom-right': { x: 'W-tw-W*0.03', y: 'H-th-H*0.03' },
  };
  return coords[position] || coords['bottom-right'];
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
