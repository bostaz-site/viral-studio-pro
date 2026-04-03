import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { renderClip, extractThumbnail, checkFfmpegAvailability } from '../lib/ffmpeg-render.js';
import { generateASS, validateWordTimestamps } from '../lib/subtitle-generator.js';
import {
  getClip,
  getVideo,
  getUserProfile,
  getTranscription,
  downloadVideo,
  uploadClip,
  uploadThumbnail,
  updateClipStatus,
  updateClipAfterRender,
  markClipError,
  maybeMarkVideoComplete,
  checkSupabaseHealth,
} from '../lib/supabase-client.js';
import { createClient } from '@supabase/supabase-js';

// Direct supabase client for render_jobs updates
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function updateRenderJob(jobId, updates) {
  if (!jobId) return;
  try {
    await supabase
      .from('render_jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  } catch (err) {
    console.warn(`[RenderJob] Failed to update job ${jobId}:`, err.message);
  }
}

const execFileAsync = promisify(execFile);
const router = express.Router();

// Create temp directory if needed
const TEMP_DIR = process.env.TEMP_DIR || '/tmp/viral-studio-render';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/tmp/viral-studio-output';

async function ensureDirs() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create directories:', err.message);
  }
}

ensureDirs();

// ─────────────────────────────────────────────────────────────────────────────
// Download clip via yt-dlp or direct fetch (for trending clips)
// ─────────────────────────────────────────────────────────────────────────────

async function downloadFromUrl(url, outputPath) {
  // Try yt-dlp first (handles Twitch clips well)
  try {
    await execFileAsync('yt-dlp', [
      '-o', outputPath,
      '--no-check-certificates',
      '--quiet',
      '--no-warnings',
      url,
    ], { timeout: 120_000 });

    const stat = await fs.stat(outputPath);
    if (stat.size > 0) return true;
  } catch (err) {
    console.warn(`[yt-dlp] Failed: ${err.message}, trying direct fetch...`);
  }

  // Fallback: direct HTTP fetch
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(outputPath, buffer);
    const stat = await fs.stat(outputPath);
    if (stat.size > 0) return true;
  } catch (err) {
    console.warn(`[fetch] Failed: ${err.message}`);
  }

  throw new Error('Failed to download clip from URL');
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/render — Main render endpoint (supports both user clips + trending)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const startTime = Date.now();
  let renderSessionId = uuidv4();
  let clipId = null;
  let tempDir = null;

  try {
    const {
      jobId,
      clipId: reqClipId,
      videoUrl,
      source = 'clips',
      clipTitle,
      clipDuration,
      wordTimestamps: providedWordTimestamps,
      settings = {},
    } = req.body;

    if (!reqClipId) {
      return res.status(400).json({
        success: false,
        error: 'Missing clipId',
        message: 'clipId is required',
      });
    }

    clipId = reqClipId;
    console.log(`[Render ${renderSessionId}] Starting render for ${source} clip ${clipId} (job: ${jobId || 'none'})`);

    // Mark job as rendering
    await updateRenderJob(jobId, { status: 'rendering' });

    // Check FFmpeg availability
    const ffmpegStatus = await checkFfmpegAvailability();
    if (!ffmpegStatus.ffmpeg) {
      return res.status(503).json({
        success: false,
        error: 'FFmpeg not available',
        message: 'FFmpeg is not installed on this server',
      });
    }

    // Create render session temp directory
    tempDir = path.join(TEMP_DIR, renderSessionId);
    await fs.mkdir(tempDir, { recursive: true });
    console.log(`[Render ${renderSessionId}] Created temp directory: ${tempDir}`);

    const inputPath = path.join(tempDir, 'input.mp4');
    let duration = clipDuration || 0;
    let userId = 'trending'; // default for trending clips
    let videoId = null;
    let clipStartTime = 0;
    let clipEndTime = duration;

    // ── TRENDING CLIP FLOW ──
    if (source === 'trending' && videoUrl) {
      console.log(`[Render ${renderSessionId}] Downloading trending clip from: ${videoUrl}`);
      await downloadFromUrl(videoUrl, inputPath);
      console.log(`[Render ${renderSessionId}] Downloaded trending clip successfully`);

      // Get actual duration from FFprobe
      try {
        const { stdout } = await execFileAsync('ffprobe', [
          '-v', 'quiet',
          '-show_entries', 'format=duration',
          '-of', 'csv=p=0',
          inputPath,
        ]);
        duration = parseFloat(stdout.trim()) || duration;
        clipEndTime = duration;
      } catch (err) {
        console.warn(`[Render ${renderSessionId}] Could not determine duration via ffprobe`);
      }

    // ── USER CLIP FLOW (original) ──
    } else {
      // Check Supabase connection
      const supabaseHealth = await checkSupabaseHealth();
      if (!supabaseHealth.connected) {
        return res.status(503).json({
          success: false,
          error: 'Supabase unavailable',
          message: 'Cannot connect to database',
        });
      }

      // Fetch clip details from clips table
      const clip = await getClip(clipId);
      if (!clip) {
        return res.status(404).json({
          success: false,
          error: 'Clip not found',
          message: `Clip ${clipId} does not exist`,
        });
      }

      const video = clip.videos;
      if (!video || !video.storage_path) {
        return res.status(404).json({
          success: false,
          error: 'Video not found',
          message: 'Source video not found',
        });
      }

      userId = clip.user_id;
      videoId = clip.video_id;
      clipStartTime = clip.start_time;
      clipEndTime = clip.end_time;
      duration = clipEndTime - clipStartTime;

      // Update clip status to rendering
      await updateClipStatus(clipId, 'rendering');

      // Download source video from Supabase storage
      console.log(`[Render ${renderSessionId}] Downloading source video from storage...`);
      await downloadVideo(video.storage_path, inputPath);
    }

    // ── COMMON RENDER PIPELINE ──

    // Prepare captions if enabled
    let assFilePath = null;
    if (settings.captions?.enabled) {
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

        if (wordTimestamps.length > 0) {
          validateWordTimestamps(wordTimestamps);
          const captionStyle = settings.captions.style || 'hormozi';
          const assContent = generateASS(wordTimestamps, {
            style: captionStyle,
            clipStartTime,
            wordsPerLine: settings.captions.wordsPerLine || 6,
            customColors: settings.captions.customColors,
          });
          assFilePath = path.join(tempDir, 'captions.ass');
          await fs.writeFile(assFilePath, assContent, 'utf-8');
          console.log(`[Render ${renderSessionId}] Generated captions: ${assFilePath}`);
        }
      } catch (err) {
        console.warn(`[Render ${renderSessionId}] Warning: Failed to generate captions:`, err.message);
      }
    }

    // Prepare split-screen if enabled
    let splitScreenConfig = null;
    if (settings.splitScreen?.enabled) {
      const BROLL_DIR = '/opt/viral-studio/broll';
      const category = settings.splitScreen.brollCategory || 'minecraft';
      const brollDir = path.join(BROLL_DIR, category);

      try {
        await fs.mkdir(brollDir, { recursive: true });
        const files = await fs.readdir(brollDir);
        const videoFiles = files.filter(f => /\.(mp4|mov|mkv|webm)$/i.test(f));

        if (videoFiles.length > 0) {
          const picked = videoFiles[Math.floor(Math.random() * videoFiles.length)];
          splitScreenConfig = {
            enabled: true,
            layout: settings.splitScreen.layout || 'top-bottom',
            ratio: settings.splitScreen.ratio || 50,
            brollPath: path.join(brollDir, picked),
          };
          console.log(`[Render ${renderSessionId}] Split-screen: layout=${splitScreenConfig.layout}, broll=${picked}`);
        } else {
          console.warn(`[Render ${renderSessionId}] No B-roll files in ${brollDir} — rendering without split-screen`);
        }
      } catch (err) {
        console.warn(`[Render ${renderSessionId}] B-roll directory not ready: ${err.message}`);
      }
    }

    // Render clip with FFmpeg
    const outputPath = path.join(tempDir, 'output.mp4');
    console.log(`[Render ${renderSessionId}] Starting FFmpeg render...`);

    const userPlan = source === 'trending' ? 'pro' : (await getUserProfile(userId))?.plan || 'free';

    await renderClip(inputPath, outputPath, {
      startTime: clipStartTime,
      endTime: clipEndTime,
      duration,
      aspectRatio: settings.format?.aspectRatio || '9:16',
      captions: assFilePath ? { assFilePath, ...settings.captions } : null,
      watermark: null,
      plan: userPlan,
      splitScreen: splitScreenConfig,
      cropAnchor: settings.format?.cropAnchor || 'center',
      backgroundBlur: settings.format?.backgroundBlur || false,
      crf: settings.format?.crf || 23,
    });

    // Upload rendered clip to Supabase Storage
    const clipStoragePath = `${userId}/${clipId}.mp4`;
    console.log(`[Render ${renderSessionId}] Uploading rendered clip...`);
    const uploadResult = await uploadClip(outputPath, clipStoragePath);

    // Extract and upload thumbnail
    let thumbnailPath = null;
    try {
      const thumbnailFileName = path.join(tempDir, 'thumbnail.png');
      await extractThumbnail(inputPath, thumbnailFileName, clipStartTime + 1);
      const thumbStoragePath = `${userId}/${clipId}_thumb.png`;
      const thumbUpload = await uploadThumbnail(thumbnailFileName, thumbStoragePath);
      thumbnailPath = thumbUpload.path;
    } catch (err) {
      console.warn(`[Render ${renderSessionId}] Warning: Failed to create thumbnail:`, err.message);
    }

    // Update database (only for user clips)
    if (source !== 'trending' && clipId) {
      await updateClipAfterRender(clipId, duration, clipStoragePath, thumbnailPath);
      if (videoId) await maybeMarkVideoComplete(videoId);
    }

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    console.log(`[Render ${renderSessionId}] Render completed in ${elapsedSeconds.toFixed(1)}s`);

    // Mark render job as done
    await updateRenderJob(req.body.jobId, {
      status: 'done',
      storage_path: clipStoragePath,
      clip_url: uploadResult.url,
    });

    res.json({
      success: true,
      data: {
        clipId,
        source,
        storagePath: clipStoragePath,
        clipUrl: uploadResult.url,
        duration,
        thumbnailPath,
      },
      message: 'Clip rendered successfully',
    });
  } catch (err) {
    console.error(`[Render ${renderSessionId}] Error:`, err.message);

    // Mark render job as error
    await updateRenderJob(req.body.jobId, {
      status: 'error',
      error_message: err.message || 'Unknown error',
    });

    // Mark clip as error (only for user clips)
    if (clipId && req.body.source !== 'trending') {
      try {
        await markClipError(clipId, err.message);
        const clipData = await getClip(clipId).catch(() => null);
        if (clipData?.video_id) {
          await maybeMarkVideoComplete(clipData.video_id);
        }
      } catch (dbErr) {
        console.error(`Failed to mark clip as error:`, dbErr.message);
      }
    }

    res.status(500).json({
      success: false,
      error: err.message || 'Unknown error',
      message: 'Render failed',
      sessionId: renderSessionId,
    });
  } finally {
    // Cleanup temp files
    if (tempDir) {
      try {
        console.log(`[Render ${renderSessionId}] Cleaning up temp directory...`);
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[Render ${renderSessionId}] Warning: Failed to cleanup temp dir:`, err.message);
      }
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/render/caption — Generate ASS subtitle file
// ─────────────────────────────────────────────────────────────────────────────

router.post('/caption', async (req, res) => {
  try {
    const {
      wordTimestamps,
      style = 'hormozi',
      clipStartTime = 0,
      wordsPerLine = 6,
    } = req.body;

    if (!wordTimestamps || !Array.isArray(wordTimestamps)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'wordTimestamps must be an array',
      });
    }

    try {
      validateWordTimestamps(wordTimestamps);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid word timestamps',
        message: err.message,
      });
    }

    const assContent = generateASS(wordTimestamps, {
      style,
      clipStartTime,
      wordsPerLine,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="captions.ass"');
    res.send(assContent);
  } catch (err) {
    console.error('[Caption Generation Error]', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Failed to generate captions',
    });
  }
});

export default router;
