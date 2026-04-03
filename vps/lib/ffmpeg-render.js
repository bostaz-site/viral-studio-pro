import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

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
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
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

  // Strategy: scale to cover → force even dims → crop to exact target
  // force_original_aspect_ratio=increase ensures both dimensions >= target
  // The scale can produce odd dimensions (e.g. 3413x1920), so we round to even
  // before cropping to avoid non-integer crop offsets that crash FFmpeg 5.x
  const scaleFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=increase`;
  const evenFilter = `scale=trunc(iw/2)*2:trunc(ih/2)*2`;

  let cropY = `(ih-${targetH})/2`;
  if (cropAnchor === 'top') cropY = '0';
  if (cropAnchor === 'bottom') cropY = `ih-${targetH}`;

  const cropFilter = `crop=${targetW}:${targetH}:(iw-${targetW})/2:${cropY}`;

  return `${scaleFilter},${evenFilter},${cropFilter},setsar=1`;
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
    cropAnchor = 'center',
    backgroundBlur = false,
    maxDuration = 300,
    crf = 23,
    timeout = 300000,
  } = options;

  if (!inputPath || !outputPath) {
    throw new Error('inputPath and outputPath are required');
  }

  const clipDuration = duration || (endTime - startTime);
  if (clipDuration > maxDuration) {
    throw new Error(`Clip duration ${clipDuration}s exceeds max ${maxDuration}s`);
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
      cropAnchor,
      crf,
      timeout,
    });
  }

  // ── Standard (single video) render path ─────────────────────────────────
  const filters = [];

  // 1. Reframe to target aspect ratio
  filters.push(buildReframeFilters(aspectRatio, { cropAnchor }));

  // 2. Background blur for letterbox (optional)
  if (backgroundBlur) {
    const blurFilter = `split=2[main][blur];[blur]scale=iw/2:-1,boxblur=10:1[blurred];[blurred]scale=iw*2:-1,format=rgb24[scaled];[scaled][main]overlay=0:0`;
    filters.push(blurFilter);
  }

  // 3. Captions (ASS subtitle format with karaoke)
  if (captions && captions.assFilePath) {
    const captionFilter = `ass='${escapePath(captions.assFilePath)}'`;
    filters.push(captionFilter);
  }

  // 4. Watermark
  if (watermark && (plan === 'free' || (plan !== 'free' && watermark.logoPath))) {
    const watermarkFilter = buildWatermarkFilter(watermark, watermarkPosition, plan);
    if (watermarkFilter) filters.push(watermarkFilter);
  }

  // Build FFmpeg command
  const args = ['-y'];
  args.push('-ss', String(startTime));
  args.push('-i', inputPath);
  args.push('-t', String(clipDuration));

  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }

  args.push('-c:v', 'libx264');
  args.push('-preset', 'fast');
  args.push('-crf', String(crf));
  args.push('-c:a', 'aac');
  args.push('-b:a', '192k');
  args.push('-movflags', '+faststart');
  args.push('-pix_fmt', 'yuv420p');
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
    cropAnchor,
    crf,
    timeout,
  } = opts;

  const layout = splitScreen.layout || 'top-bottom';
  const ratio = Math.max(30, Math.min(70, splitScreen.ratio || 50)) / 100; // 0.3–0.7
  const brollPath = splitScreen.brollPath;

  const ratios = {
    '9:16': { w: 1080, h: 1920 },
    '1:1': { w: 1080, h: 1080 },
    '16:9': { w: 1920, h: 1080 },
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
      // Scale + crop main video to top region
      `[0:v]scale=${canvasW}:${topH}:force_original_aspect_ratio=increase,crop=${canvasW}:${topH}:(iw-${canvasW})/2:(ih-${topH})/2,setsar=1[main]`,
      // Scale + crop B-roll to bottom region, loop if shorter
      `[1:v]loop=loop=-1:size=32767:start=0,scale=${canvasW}:${botH}:force_original_aspect_ratio=increase,crop=${canvasW}:${botH}:(iw-${canvasW})/2:(ih-${botH})/2,setsar=1[broll]`,
      // Stack vertically
      `[main][broll]vstack=inputs=2[composed]`,
    ].join(';');
    mapVideo = '[composed]';

  } else if (layout === 'side-by-side') {
    // ── Side-by-Side split ────────────────────────────────────────────────
    const leftW = Math.round(canvasW * ratio);
    const rightW = canvasW - leftW;

    filterComplex = [
      `[0:v]scale=${leftW}:${canvasH}:force_original_aspect_ratio=increase,crop=${leftW}:${canvasH}:(iw-${leftW})/2:(ih-${canvasH})/2,setsar=1[main]`,
      `[1:v]loop=loop=-1:size=32767:start=0,scale=${rightW}:${canvasH}:force_original_aspect_ratio=increase,crop=${rightW}:${canvasH}:(iw-${rightW})/2:(ih-${canvasH})/2,setsar=1[broll]`,
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
      `[0:v]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase,crop=${canvasW}:${canvasH}:(iw-${canvasW})/2:(ih-${canvasH})/2,setsar=1[main]`,
      `[1:v]loop=loop=-1:size=32767:start=0,scale=${pipW}:${pipH}:force_original_aspect_ratio=increase,crop=${pipW}:${pipH}:(iw-${pipW})/2:(ih-${pipH})/2,setsar=1[broll]`,
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

  // Apply captions on the composed output
  if (captions && captions.assFilePath) {
    filterComplex += `;${mapVideo}ass='${escapePath(captions.assFilePath)}'[captioned]`;
    mapVideo = '[captioned]';
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
  args.push('-t', String(clipDuration));
  args.push('-filter_complex', filterComplex);
  args.push('-map', mapVideo);
  args.push('-map', '0:a?');             // Keep audio from main video (if exists)
  args.push('-c:v', 'libx264');
  args.push('-preset', 'fast');
  args.push('-crf', String(crf));
  args.push('-c:a', 'aac');
  args.push('-b:a', '192k');
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
    // Extract the useful part of the error (last 800 chars of stderr contain the actual error)
    const fullMsg = err.message || 'Unknown error';
    const stderrContent = err.stderr || '';
    const lastStderr = stderrContent ? stderrContent.slice(-800) : '';
    const errorSummary = lastStderr || fullMsg.slice(-800);
    console.error('[FFmpeg Error] Full stderr tail:', errorSummary);
    console.error('[FFmpeg Error] Command:', cmd);
    throw new Error(`FFmpeg render failed: ${errorSummary}`);
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
