import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { renderClip, extractThumbnail, checkFfmpegAvailability } from '../lib/ffmpeg-render.js';
import { generateASS, generateStaticASS, validateWordTimestamps } from '../lib/subtitle-generator.js';
import { transcribeWithWhisper } from '../lib/whisper-client.js';
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
    console.log(`[download] Trying yt-dlp for: ${url}`);
    await execFileAsync('yt-dlp', [
      '-o', outputPath,
      '--no-check-certificates',
      '--quiet',
      '--no-warnings',
      url,
    ], { timeout: 60_000 }); // 60s timeout (was 120s)

    const stat = await fs.stat(outputPath);
    if (stat.size > 0) {
      console.log(`[download] yt-dlp success: ${stat.size} bytes`);
      return true;
    }
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

    // Determine canvas dimensions (must match FFmpeg render output)
    const isSplitScreen = settings.splitScreen?.enabled;
    const targetAspectRatio = settings.format?.aspectRatio || '9:16';
    const canvasSizes = isSplitScreen
      ? { '9:16': { w: 720, h: 1280 }, '1:1': { w: 720, h: 720 }, '16:9': { w: 1280, h: 720 } }
      : { '9:16': { w: 1080, h: 1920 }, '1:1': { w: 1080, h: 1080 }, '16:9': { w: 1920, h: 1080 } };
    const { w: canvasW, h: canvasH } = canvasSizes[targetAspectRatio] || canvasSizes['9:16'];

    // Split-screen info for subtitle positioning
    const splitScreenForCaptions = isSplitScreen ? {
      enabled: true,
      layout: settings.splitScreen.layout || 'top-bottom',
      ratio: settings.splitScreen.ratio || 50,
    } : null;

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

        // For trending clips, try Whisper transcription to get real word timestamps
        if (source === 'trending' && wordTimestamps.length === 0) {
          const hasWhisperKey = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
          const keySource = process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY' : (process.env.OPENAI_KEY ? 'OPENAI_KEY' : 'NONE');
          console.log(`[Render ${renderSessionId}] Whisper key present: ${hasWhisperKey} (source: ${keySource})`);
          if (!hasWhisperKey) {
            console.warn(`[Render ${renderSessionId}] No OPENAI key set — Whisper transcription will be skipped`);
          }
          try {
            console.log(`[Render ${renderSessionId}] Attempting Whisper transcription for trending clip...`);
            wordTimestamps = await transcribeWithWhisper(inputPath, {
              tempDir,
              language: 'en', // Most Twitch clips are English
            });
            console.log(`[Render ${renderSessionId}] Whisper returned ${wordTimestamps.length} word timestamps`);
          } catch (err) {
            console.warn(
              `[Render ${renderSessionId}] Whisper transcription failed: ${err.message}`
            );
          }
        }

        const captionStyle = settings.captions.style || 'hormozi';
        const captionPosition = settings.captions.position || 'bottom';
        let assContent = null;

        // Common subtitle options — canvas-aware positioning
        const subtitleOpts = {
          style: captionStyle,
          position: captionPosition,
          canvasWidth: canvasW,
          canvasHeight: canvasH,
          splitScreen: splitScreenForCaptions,
        };

        if (wordTimestamps.length > 0) {
          // Full karaoke captions from word timestamps
          validateWordTimestamps(wordTimestamps);
          assContent = generateASS(wordTimestamps, {
            ...subtitleOpts,
            clipStartTime,
            wordsPerLine: settings.captions.wordsPerLine || 6,
            customColors: settings.captions.customColors,
          });
        } else {
          // No word timestamps available — skip captions entirely
          // (Static captions from title are useless, only real transcription matters)
          console.log(`[Render ${renderSessionId}] No word timestamps available — skipping captions`);
        }

        if (assContent) {
          assFilePath = path.join(tempDir, 'captions.ass');
          await fs.writeFile(assFilePath, assContent, 'utf-8');
          console.log(`[Render ${renderSessionId}] Generated captions (${canvasW}x${canvasH}, pos=${captionPosition}, split=${!!isSplitScreen}): ${assFilePath}`);
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

      // B-roll category → color for on-the-fly generation when no real B-roll files exist
      const BROLL_COLORS = {
        'subway-surfers': { color: '1DB954', label: 'SUBWAY SURFERS' },
        'minecraft-parkour': { color: '5B8731', label: 'MINECRAFT' },
        'sand-cutting': { color: 'E8A87C', label: 'SATISFYING' },
        'soap-cutting': { color: 'FF6B8A', label: 'SATISFYING' },
        'slime-satisfying': { color: '9B59B6', label: 'SATISFYING' },
      };

      try {
        await fs.mkdir(brollDir, { recursive: true });
        const files = await fs.readdir(brollDir);
        const videoFiles = files.filter(f => /\.(mp4|mov|mkv|webm)$/i.test(f));

        let brollPath = null;

        if (videoFiles.length > 0) {
          // Use local B-roll file
          const picked = videoFiles[Math.floor(Math.random() * videoFiles.length)];
          brollPath = path.join(brollDir, picked);
          console.log(`[Render ${renderSessionId}] Using local B-roll: ${picked}`);
        } else {
          // Generate a visually interesting B-roll video with gradient stripes and label bar
          const colorInfo = BROLL_COLORS[category] || { color: '333333', label: 'B-ROLL' };
          const genPath = path.join(tempDir, `broll-${category}.mp4`);
          const brollDuration = Math.max(duration, 30); // At least 30s to cover clip
          console.log(`[Render ${renderSessionId}] Generating enhanced B-roll for "${category}" (${colorInfo.color}, ${brollDuration}s)...`);
          try {
            // Build an enhanced lavfi filter chain with:
            // 1. Base gradient-like effect (overlaying two color strips)
            // 2. Horizontal stripe pattern for visual interest
            // 3. Dark background bar at bottom with white text label
            // 4. Play icon (▶) in center
            const baseColor = colorInfo.color.toLowerCase();

            // Lighten the hex color by 30% for the bottom stripe (simple approach)
            const darkenedColor = colorInfo.color.toLowerCase(); // darker variant

            // Complex but safe filter chain:
            // - Start with base color
            // - Split into two: one for stripes, one for bottom bar
            // - Add drawbox for bottom label bar (dark background)
            // - Add drawtext for play icon (▶) in center
            // - Add drawtext for category label at bottom
            const filterChain = `color=c=0x${baseColor}:s=540x480:d=${brollDuration}:r=30,` +
              // Add horizontal darker stripes at top and middle for depth
              `drawbox=x=0:y=0:w=540:h=120:color=0x000000@0.3:thickness=fill,` +
              `drawbox=x=0:y=160:w=540:h=100:color=0x000000@0.2:thickness=fill,` +
              // Add bottom dark background bar for label (540x80)
              `drawbox=x=0:y=400:w=540:h=80:color=0x000000@0.7:thickness=fill,` +
              // Central play icon (▶) in larger font
              `drawtext=text='▶':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h-100-text_h)/2:alpha=0.9,` +
              // Category label at bottom with shadow effect
              `drawtext=text='${colorInfo.label}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontcolor=white:fontsize=28:x=20:y=h-50:alpha=0.95,` +
              // Small accent bar on the left
              `drawbox=x=0:y=0:w=4:h=480:color=0xFFFFFF@0.5:thickness=fill,` +
              `format=yuv420p`;

            await execFileAsync('ffmpeg', [
              '-y',
              '-f', 'lavfi', '-i', filterChain,
              '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`,
              '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
              '-r', '30',
              '-c:a', 'aac', '-shortest', '-t', String(brollDuration),
              genPath,
            ], { timeout: 30000 });
            const stat = await fs.stat(genPath);
            if (stat.size > 1000) {
              brollPath = genPath;
              console.log(`[Render ${renderSessionId}] Generated enhanced B-roll: ${stat.size} bytes`);
            }
          } catch (genErr) {
            console.warn(`[Render ${renderSessionId}] B-roll generation failed: ${genErr.message}`);
          }
        }

        if (brollPath) {
          splitScreenConfig = {
            enabled: true,
            layout: settings.splitScreen.layout || 'top-bottom',
            ratio: settings.splitScreen.ratio || 50,
            brollPath,
          };
          console.log(`[Render ${renderSessionId}] Split-screen: layout=${splitScreenConfig.layout}, broll=${brollPath}`);
        } else {
          console.warn(`[Render ${renderSessionId}] No B-roll available for "${category}" — rendering without split-screen`);
        }
      } catch (err) {
        console.warn(`[Render ${renderSessionId}] B-roll setup error: ${err.message}`);
      }
    }

    // Prepare tag/credit config
    let tagConfig = null;
    console.log(`[Render ${renderSessionId}] Tag settings received:`, JSON.stringify(settings.tag));
    if (settings.tag && settings.tag.style && settings.tag.style !== 'none') {
      tagConfig = {
        style: settings.tag.style,
        authorName: settings.tag.authorName || null,
        authorHandle: settings.tag.authorHandle || null,
      };
      console.log(`[Render ${renderSessionId}] Tag: style=${tagConfig.style}, author=${tagConfig.authorHandle || tagConfig.authorName || 'none'}`);
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
      tag: tagConfig,
      cropAnchor: settings.format?.cropAnchor || 'center',
      backgroundBlur: settings.format?.backgroundBlur || false,
      crf: settings.format?.crf || 23,
    });

    // Upload rendered clip to Supabase Storage (unique path per render to avoid CDN cache)
    const renderTs = Date.now();
    const clipStoragePath = source === 'trending' ? `trending/${clipId}_${renderTs}.mp4` : `${userId}/${clipId}_${renderTs}.mp4`;
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
    const errorMsg = err?.message || 'Unknown error';
    console.error(`[Render ${renderSessionId}] Error:`, errorMsg);

    // Mark render job as error — do this FIRST and protect it
    try {
      await updateRenderJob(req.body?.jobId, {
        status: 'error',
        error_message: errorMsg.substring(0, 2000),
      });
    } catch (jobErr) {
      console.error(`[Render ${renderSessionId}] Failed to update render job:`, jobErr?.message);
    }

    // Mark clip as error (only for user clips)
    if (clipId && req.body?.source !== 'trending') {
      try {
        await markClipError(clipId, errorMsg);
        const clipData = await getClip(clipId).catch(() => null);
        if (clipData?.video_id) {
          await maybeMarkVideoComplete(clipData.video_id);
        }
      } catch (dbErr) {
        console.error(`Failed to mark clip as error:`, dbErr.message);
      }
    }

    // Only send response if not already sent
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: errorMsg,
        message: 'Render failed',
        sessionId: renderSessionId,
      });
    }
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
