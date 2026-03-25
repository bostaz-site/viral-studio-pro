import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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
  getDefaultBrandTemplate,
  checkSupabaseHealth,
} from '../lib/supabase-client.js';

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
// POST /api/render — Main render endpoint
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const startTime = Date.now();
  let renderSessionId = uuidv4();
  let clipId = null;
  let tempDir = null;

  try {
    // Validate request body
    const {
      clipId: reqClipId,
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
    console.log(`[Render ${renderSessionId}] Starting render for clip ${clipId}`);

    // Check FFmpeg availability
    const ffmpegStatus = await checkFfmpegAvailability();
    if (!ffmpegStatus.ffmpeg) {
      return res.status(503).json({
        success: false,
        error: 'FFmpeg not available',
        message: 'FFmpeg is not installed on this server',
      });
    }

    // Check Supabase connection
    const supabaseHealth = await checkSupabaseHealth();
    if (!supabaseHealth.connected) {
      return res.status(503).json({
        success: false,
        error: 'Supabase unavailable',
        message: 'Cannot connect to database',
      });
    }

    // Create render session temp directory
    tempDir = path.join(TEMP_DIR, renderSessionId);
    await fs.mkdir(tempDir, { recursive: true });
    console.log(`[Render ${renderSessionId}] Created temp directory: ${tempDir}`);

    // Fetch clip details
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

    // Fetch user profile for plan info
    const profile = await getUserProfile(clip.user_id);
    const userPlan = profile?.plan || 'free';

    // Update clip status to rendering
    await updateClipStatus(clipId, 'rendering');

    // Download source video
    const inputPath = path.join(tempDir, 'input.mp4');
    console.log(`[Render ${renderSessionId}] Downloading source video...`);
    await downloadVideo(video.storage_path, inputPath);

    // Prepare captions if enabled
    let assFilePath = null;
    if (settings.captions?.enabled) {
      try {
        const transcription = await getTranscription(clip.video_id);
        if (transcription?.word_timestamps) {
          // Filter word timestamps to clip time range
          const relevantWords = (transcription.word_timestamps || []).filter(
            w => w.start >= clip.start_time && w.start < clip.end_time
          );

          if (relevantWords.length > 0) {
            // Validate timestamps
            validateWordTimestamps(relevantWords);

            // Generate ASS file
            const captionStyle = settings.captions.style || 'hormozi';
            const assContent = generateASS(relevantWords, {
              style: captionStyle,
              clipStartTime: clip.start_time,
              wordsPerLine: settings.captions.wordsPerLine || 6,
              customColors: settings.captions.customColors,
            });

            assFilePath = path.join(tempDir, 'captions.ass');
            await fs.writeFile(assFilePath, assContent, 'utf-8');
            console.log(`[Render ${renderSessionId}] Generated captions: ${assFilePath}`);
          }
        }
      } catch (err) {
        console.warn(`[Render ${renderSessionId}] Warning: Failed to generate captions:`, err.message);
        // Continue without captions
      }
    }

    // Prepare watermark
    let watermarkConfig = null;
    if (settings.branding?.watermark) {
      watermarkConfig = {
        enabled: true,
        position: settings.branding.watermarkPosition || 'bottom-right',
      };

      // Try to get custom logo if Pro/Studio
      if (userPlan !== 'free') {
        try {
          const template = await getDefaultBrandTemplate(clip.user_id);
          if (template?.logo_path) {
            watermarkConfig.logoPath = template.logo_path;
          }
        } catch (err) {
          console.warn(`[Render ${renderSessionId}] Warning: Failed to fetch brand template:`, err.message);
        }
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
        const videoFiles = files.filter(f =>
          /\.(mp4|mov|mkv|webm)$/i.test(f)
        );

        if (videoFiles.length > 0) {
          // Pick a random B-roll from the category folder
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
        console.warn(`[Render ${renderSessionId}] B-roll directory not ready: ${err.message} — rendering without split-screen`);
      }
    }

    // Render clip
    const outputPath = path.join(tempDir, 'output.mp4');
    console.log(`[Render ${renderSessionId}] Starting FFmpeg render...`);

    const duration = clip.end_time - clip.start_time;
    await renderClip(inputPath, outputPath, {
      startTime: clip.start_time,
      endTime: clip.end_time,
      duration,
      aspectRatio: clip.aspect_ratio || '9:16',
      captions: assFilePath ? { assFilePath, ...settings.captions } : null,
      watermark: watermarkConfig,
      plan: userPlan,
      splitScreen: splitScreenConfig,
      cropAnchor: settings.format?.cropAnchor || 'center',
      backgroundBlur: settings.format?.backgroundBlur || false,
      crf: settings.format?.crf || 23,
    });

    // Extract thumbnail
    let thumbnailPath = null;
    try {
      const thumbnailFileName = path.join(tempDir, 'thumbnail.png');
      await extractThumbnail(inputPath, thumbnailFileName, clip.start_time + 1);

      // Upload thumbnail
      const thumbStoragePath = `${clip.user_id}/${clipId}_thumb.png`;
      const thumbUpload = await uploadThumbnail(thumbnailFileName, thumbStoragePath);
      thumbnailPath = thumbUpload.path;
      console.log(`[Render ${renderSessionId}] Uploaded thumbnail: ${thumbnailPath}`);
    } catch (err) {
      console.warn(`[Render ${renderSessionId}] Warning: Failed to create thumbnail:`, err.message);
      // Continue without thumbnail
    }

    // Upload rendered clip to Supabase Storage
    const clipStoragePath = `${clip.user_id}/${clipId}.mp4`;
    console.log(`[Render ${renderSessionId}] Uploading rendered clip...`);
    const uploadResult = await uploadClip(outputPath, clipStoragePath);

    // Update clip in database with success
    await updateClipAfterRender(clipId, duration, clipStoragePath, thumbnailPath);

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    console.log(`[Render ${renderSessionId}] Render completed in ${elapsedSeconds.toFixed(1)}s`);

    res.json({
      success: true,
      data: {
        clipId,
        storagePath: clipStoragePath,
        clipUrl: uploadResult.url,
        duration,
        thumbnailPath,
        thumbnailUrl: thumbnailPath ? `${process.env.SUPABASE_URL}/storage/v1/object/public/thumbnails/${thumbnailPath}` : null,
      },
      message: 'Clip rendered successfully',
    });
  } catch (err) {
    console.error(`[Render ${renderSessionId}] Error:`, err.message);

    // Mark clip as error in database
    if (clipId) {
      try {
        await markClipError(clipId, err.message);
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

    // Validate timestamps
    try {
      validateWordTimestamps(wordTimestamps);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid word timestamps',
        message: err.message,
      });
    }

    // Generate ASS content
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
