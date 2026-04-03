import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

/**
 * yt-dlp wrapper for downloading videos from various platforms
 */

// ─────────────────────────────────────────────────────────────────────────────
// Supported Platforms
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_PLATFORMS = {
  youtube: {
    domains: ['youtube.com', 'youtu.be'],
    name: 'YouTube',
  },
  tiktok: {
    domains: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
    name: 'TikTok',
  },
  instagram: {
    domains: ['instagram.com', 'instagr.am'],
    name: 'Instagram',
  },
  twitch: {
    domains: ['twitch.tv'],
    name: 'Twitch',
  },
  twitter: {
    domains: ['twitter.com', 'x.com'],
    name: 'Twitter/X',
  },
  reddit: {
    domains: ['reddit.com'],
    name: 'Reddit',
  },
  vimeo: {
    domains: ['vimeo.com'],
    name: 'Vimeo',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect platform from URL
 */
function detectPlatform(url) {
  const lowerUrl = url.toLowerCase();

  for (const [platform, config] of Object.entries(SUPPORTED_PLATFORMS)) {
    for (const domain of config.domains) {
      if (lowerUrl.includes(domain)) {
        return platform;
      }
    }
  }

  return 'unknown';
}

/**
 * Validate URL format
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate safe filename from title
 */
function sanitizeFilename(title) {
  return title
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// Download Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Download video from URL using yt-dlp
 *
 * @param {string} videoUrl - Source URL
 * @param {string} outputPath - Output directory
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, filePath: string, metadata: Object}>}
 */
export async function downloadVideo(videoUrl, outputPath, options = {}) {
  const {
    format = 'best[ext=mp4]/best',
    audioOnly = false,
    maxDuration = 3600, // 1 hour max
    timeout = 600000, // 10 minutes
  } = options;

  // Validate input
  if (!isValidUrl(videoUrl)) {
    throw new Error('Invalid video URL format');
  }

  const platform = detectPlatform(videoUrl);
  console.log(`[yt-dlp] Downloading from ${platform}: ${videoUrl}`);

  // Ensure output directory exists
  try {
    await fs.mkdir(outputPath, { recursive: true });
  } catch (err) {
    throw new Error(`Failed to create output directory: ${err.message}`);
  }

  try {
    // Build yt-dlp command
    const args = [];

    // Output template with safe characters
    const outputTemplate = path.join(outputPath, '%(title).50s.%(ext)s');
    args.push('-o', outputTemplate);

    // Format selection
    args.push('-f', format);

    // Extract metadata (--print-json downloads AND prints JSON; --dump-json only simulates)
    args.push('--print-json');
    args.push('--no-warnings');

    // Video processing options
    if (audioOnly) {
      args.push('-x');
      args.push('--audio-format', 'mp3');
    } else {
      // Recode video for compatibility
      args.push('--recode-video', 'mp4');
      args.push('--postprocessor-args', '-c:v libx264 -crf 23 -preset fast');
    }

    // Timeout and retry
    args.push('--socket-timeout', '30');
    args.push('--retries', '3');

    // Don't keep original
    args.push('--no-keep-video');

    // URL
    args.push(videoUrl);

    // Run yt-dlp
    const ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
    const { stdout, stderr } = await execFileAsync(ytdlpPath, args, {
      timeout,
      maxBuffer: 1024 * 1024 * 50, // 50MB
    });

    // Parse JSON output
    let metadata = {};
    try {
      const lines = stdout.split('\n');
      const jsonLine = lines.find(line => line.startsWith('{'));
      if (jsonLine) {
        metadata = JSON.parse(jsonLine);
      }
    } catch (err) {
      console.warn('[yt-dlp] Could not parse metadata JSON');
    }

    // Find the downloaded file
    const files = await fs.readdir(outputPath);
    const videoFile = files.find(f => f.endsWith('.mp4') || f.endsWith('.mkv'));

    if (!videoFile) {
      throw new Error('Downloaded file not found');
    }

    const filePath = path.join(outputPath, videoFile);
    const stats = await fs.stat(filePath);

    console.log(`[yt-dlp] Download completed: ${videoFile} (${stats.size} bytes)`);

    return {
      success: true,
      filePath,
      metadata: {
        title: metadata.title || 'Unknown',
        duration: metadata.duration || 0,
        uploader: metadata.uploader || 'Unknown',
        upload_date: metadata.upload_date || null,
        description: metadata.description || '',
        thumbnail: metadata.thumbnail || null,
        view_count: metadata.view_count || 0,
        platform,
      },
    };
  } catch (err) {
    console.error('[yt-dlp Error]', err.message);

    // Check if yt-dlp is installed
    if (err.message.includes('ENOENT')) {
      throw new Error('yt-dlp is not installed on this system');
    }

    throw new Error(`Failed to download video: ${err.message}`);
  }
}

/**
 * Get video metadata without downloading
 */
export async function getVideoMetadata(videoUrl) {
  if (!isValidUrl(videoUrl)) {
    throw new Error('Invalid video URL format');
  }

  const platform = detectPlatform(videoUrl);
  console.log(`[yt-dlp] Fetching metadata from ${platform}`);

  try {
    const ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
    const args = [
      '--dump-json',
      '--no-warnings',
      '--no-simulate',
      videoUrl,
    ];

    const { stdout } = await execFileAsync(ytdlpPath, args, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10,
    });

    const metadata = JSON.parse(stdout);

    return {
      success: true,
      metadata: {
        title: metadata.title || 'Unknown',
        duration: metadata.duration || 0,
        uploader: metadata.uploader || 'Unknown',
        upload_date: metadata.upload_date || null,
        description: metadata.description || '',
        thumbnail: metadata.thumbnail || null,
        view_count: metadata.view_count || 0,
        like_count: metadata.like_count || 0,
        comment_count: metadata.comment_count || 0,
        platform,
      },
    };
  } catch (err) {
    console.error('[yt-dlp Error]', err.message);
    throw new Error(`Failed to fetch metadata: ${err.message}`);
  }
}

/**
 * Check if yt-dlp is available
 */
export async function checkYtdlpAvailability() {
  try {
    const ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
    const { stdout } = await execFileAsync(ytdlpPath, ['--version'], { timeout: 5000 });
    return { available: true, version: stdout.trim() };
  } catch (err) {
    console.error('[yt-dlp Check]', err.message);
    return { available: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get supported platforms
 */
export function getSupportedPlatforms() {
  return Object.entries(SUPPORTED_PLATFORMS).map(([key, config]) => ({
    id: key,
    name: config.name,
    domains: config.domains,
  }));
}

/**
 * Format download progress message
 */
export function formatProgress(percent, totalSize, downloadedSize) {
  const downloaded = (downloadedSize / 1024 / 1024).toFixed(2);
  const total = (totalSize / 1024 / 1024).toFixed(2);
  return `${percent.toFixed(1)}% (${downloaded}MB / ${total}MB)`;
}
