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
 * Builds a simple FFmpeg command string from args array
 */
function buildCommand(args) {
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  return [ffmpegPath, ...args].map(arg => {
    // Quote args with spaces but not filter specs
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
  const targetRatio = (targetW / targetH).toFixed(4);

  // Smart zoom/scale logic
  const scaleFilter = `scale=iw*${targetRatio}>iw?iw:iw*${targetRatio},iw*${targetRatio}<iw?iw*${targetRatio}:iw:-1`;

  // Crop position
  let cropY = '(ih-oh)/2'; // center (default)
  if (cropAnchor === 'top') cropY = '0';
  if (cropAnchor === 'bottom') cropY = 'ih-oh';

  const cropFilter = `crop=${targetW}:${targetH}:(iw-${targetW})/2:${cropY}`;

  return `${scaleFilter},${cropFilter}`;
}

/**
 * Main render function: cuts, reframes, and applies filters to a video
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
    maxDuration = 300, // 5 minutes max
    crf = 23, // Quality (lower = better)
    timeout = 300000, // 5 minutes
  } = options;

  // Validate inputs
  if (!inputPath || !outputPath) {
    throw new Error('inputPath and outputPath are required');
  }

  const clipDuration = duration || (endTime - startTime);
  if (clipDuration > maxDuration) {
    throw new Error(`Clip duration ${clipDuration}s exceeds max ${maxDuration}s`);
  }

  // Build filter chain
  const filters = [];

  // 1. Reframe to target aspect ratio
  filters.push(buildReframeFilters(aspectRatio, { cropAnchor }));

  // 2. Background blur for letterbox (optional)
  if (backgroundBlur) {
    // Add blur effect - scale input smaller, blur it, then overlay main content
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
  const args = ['-y']; // Overwrite output

  // Input specification
  args.push('-ss', String(startTime));
  args.push('-i', inputPath);
  args.push('-t', String(clipDuration));

  // Filter chain
  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }

  // Video codec options
  args.push('-c:v', 'libx264');
  args.push('-preset', 'fast');
  args.push('-crf', String(crf));
  args.push('-c:a', 'aac');
  args.push('-b:a', '192k');
  args.push('-movflags', '+faststart');
  args.push('-pix_fmt', 'yuv420p');

  // Output
  args.push(outputPath);

  // Execute FFmpeg
  const cmd = buildCommand(args);
  console.log(`[FFmpeg] Running: ${cmd.substring(0, 200)}...`);

  try {
    const { stderr } = await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', args, {
      timeout,
      maxBuffer: 1024 * 1024 * 100, // 100MB
    });

    // Log progress if available
    if (stderr && stderr.includes('frame=')) {
      const frameMatch = stderr.match(/frame=\s*(\d+)/);
      if (frameMatch) {
        console.log(`[FFmpeg] Progress: frame ${frameMatch[1]}`);
      }
    }

    console.log(`[FFmpeg] Render completed successfully: ${outputPath}`);
    return { success: true, outputPath };
  } catch (err) {
    console.error('[FFmpeg Error]', err.message);
    throw new Error(`FFmpeg render failed: ${err.message}`);
  }
}

/**
 * Build watermark filter for drawtext
 */
function buildWatermarkFilter(watermark, position, plan) {
  if (plan !== 'free' && !watermark.logoPath) {
    return null; // Pro/Studio without custom logo = no watermark
  }

  if (plan === 'free') {
    // Text watermark for free plan
    const posCoords = getWatermarkCoordinates(position);
    return `drawtext=text='Viral Studio Pro':fontsize=28:fontcolor=white@0.75:shadowcolor=black@0.5:shadowx=1:shadowy=1:x=${posCoords.x}:y=${posCoords.y}`;
  }

  // Logo watermark for Pro/Studio (handled separately in renderClip with multiple inputs)
  return null;
}

/**
 * Get FFmpeg coordinates for watermark position
 */
function getWatermarkCoordinates(position = 'bottom-right') {
  const coords = {
    'top-left': { x: 'W*0.03', y: 'H*0.03' },
    'top-right': { x: 'W-tw-W*0.03', y: 'H*0.03' },
    'bottom-left': { x: 'W*0.03', y: 'H-th-H*0.03' },
    'bottom-right': { x: 'W-tw-W*0.03', y: 'H-th-H*0.03' },
  };
  return coords[position] || coords['bottom-right'];
}

/**
 * Extract thumbnail from video at given timestamp
 */
export async function extractThumbnail(inputPath, outputPath, atSecond = 0) {
  const args = [
    '-y',
    '-ss', String(atSecond),
    '-i', inputPath,
    '-vframes', '1',
    '-q:v', '2',
    outputPath,
  ];

  const cmd = buildCommand(args);
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

/**
 * Get video metadata (duration, dimensions, etc)
 */
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

/**
 * Verify FFmpeg and FFprobe are available
 */
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
