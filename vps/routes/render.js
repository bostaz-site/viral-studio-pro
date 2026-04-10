import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { renderClip, extractThumbnail, checkFfmpegAvailability, buildFollowFaceFilter } from '../lib/ffmpeg-render.js';
import { generateASS, generateStaticASS, validateWordTimestamps } from '../lib/subtitle-generator.js';
import { detectFaces } from '../lib/face-tracker.js';
import { detectPeakMoment, generateHookTexts, calculateReorderTimestamps } from '../lib/hook-generator.js';
// caption-png.js and drawtext-wordpop.js removed — all animations now use ASS subtitles
import { transcribeWithWhisper } from '../lib/whisper-client.js';
import { applyAutoCut } from '../lib/auto-cut.js';
import { enqueueRender, getQueueStatus } from '../lib/render-queue.js';
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

/**
 * Probe a file with ffprobe to make sure it's a real, playable MP4 with a
 * moov atom. Returns true if valid, false otherwise. We check for the
 * presence of at least one video stream with a positive duration — a
 * truncated download (yt-dlp killed mid-stream, fetch got a partial body)
 * will fail this check because the moov atom lives at the end of the file.
 */
async function isValidVideoFile(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_type,duration',
      '-of', 'csv=p=0',
      filePath,
    ], { timeout: 10_000 });
    const line = stdout.trim();
    if (!line) return false;
    // Expect something like "video,5.200000" or "video,N/A"
    const [codecType, duration] = line.split(',');
    if (codecType !== 'video') return false;
    const dur = parseFloat(duration);
    return Number.isFinite(dur) && dur > 0;
  } catch {
    return false;
  }
}

async function safeUnlink(path) {
  try { await fs.unlink(path); } catch { /* ignore */ }
}

async function downloadFromUrl(url, outputPath) {
  const attempts = [];

  // ── Attempt 1: yt-dlp (best for Twitch clips, handles HLS/redirects) ──
  try {
    console.log(`[download] Trying yt-dlp for: ${url}`);
    await execFileAsync('yt-dlp', [
      '-o', outputPath,
      '--no-check-certificates',
      '--no-part',        // write directly to outputPath, no .part rename race
      '--force-overwrites',
      '--quiet',
      '--no-warnings',
      url,
    ], { timeout: 120_000 }); // 2 min — was 60s, too short for long clips

    const stat = await fs.stat(outputPath).catch(() => null);
    if (stat && stat.size > 0) {
      if (await isValidVideoFile(outputPath)) {
        console.log(`[download] yt-dlp success: ${stat.size} bytes, valid MP4`);
        return true;
      }
      console.warn(`[download] yt-dlp produced a ${stat.size} byte file but ffprobe rejected it (truncated / wrong format). Retrying with direct fetch…`);
      attempts.push(`yt-dlp: corrupt output (${stat.size} bytes, no moov atom)`);
      await safeUnlink(outputPath);
    } else {
      attempts.push('yt-dlp: empty output');
    }
  } catch (err) {
    console.warn(`[yt-dlp] Failed: ${err.message}`);
    attempts.push(`yt-dlp: ${err.message}`);
    await safeUnlink(outputPath);
  }

  // ── Attempt 2: direct HTTP fetch with content-type check ──
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
    // Reject obvious HTML/JSON error pages disguised as .mp4
    if (contentType.startsWith('text/') || contentType.includes('json')) {
      throw new Error(`unexpected content-type: ${contentType}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) throw new Error('empty response body');

    await fs.writeFile(outputPath, buffer);
    if (!(await isValidVideoFile(outputPath))) {
      throw new Error(`downloaded file is not a valid MP4 (${buffer.length} bytes, content-type=${contentType})`);
    }
    console.log(`[download] direct fetch success: ${buffer.length} bytes, valid MP4`);
    return true;
  } catch (err) {
    console.warn(`[fetch] Failed: ${err.message}`);
    attempts.push(`fetch: ${err.message}`);
    await safeUnlink(outputPath);
  }

  throw new Error(`Failed to download clip from URL after ${attempts.length} attempts — ${attempts.join(' | ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/render — Main render endpoint (supports both user clips + trending)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const startTime = Date.now();
  let renderSessionId = uuidv4();
  let clipId = null;
  let tempDir = null;
  const trace = [];
  const trc = (msg) => {
    const line = `[${((Date.now() - startTime) / 1000).toFixed(2)}s] ${msg}`;
    trace.push(line);
    console.log(`[Render ${renderSessionId}] TRACE: ${line}`);
  };

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

    trc(`START source=${source} clipId=${reqClipId} jobId=${jobId || 'none'}`);
    trc(`settings.tag=${JSON.stringify(settings.tag)}`);
    trc(`settings.captions=${JSON.stringify(settings.captions)}`);
    trc(`settings.splitScreen=${JSON.stringify(settings.splitScreen)}`);
    trc(`settings.format=${JSON.stringify(settings.format)}`);
    trc(`settings.hook=${JSON.stringify({ enabled: settings.hook?.enabled, textEnabled: settings.hook?.textEnabled, reorderEnabled: settings.hook?.reorderEnabled, text: settings.hook?.text?.substring(0, 30), hasOverlayPng: !!(settings.hook?.overlayPng), hasReorder: !!(settings.hook?.reorder), reorderSegments: settings.hook?.reorder?.segments?.length || 0 })}`);
    trc(`settings.audioEnhance=${JSON.stringify(settings.audioEnhance)}`);
    trc(`settings.autoCut=${JSON.stringify(settings.autoCut)}`);
    const envHasOpenAI = !!process.env.OPENAI_API_KEY;
    const envHasOpenAIKey = !!process.env.OPENAI_KEY;
    trc(`env OPENAI_API_KEY=${envHasOpenAI} OPENAI_KEY=${envHasOpenAIKey}`);

    if (!reqClipId) {
      return res.status(400).json({
        success: false,
        error: 'Missing clipId',
        message: 'clipId is required',
      });
    }

    clipId = reqClipId;
    const queueStatus = getQueueStatus();
    console.log(`[Render ${renderSessionId}] Starting render for ${source} clip ${clipId} (job: ${jobId || 'none'}) [queue: ${queueStatus.running} running, ${queueStatus.waiting} waiting]`);

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

    let inputPath = path.join(tempDir, 'input.mp4');
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

      // Get actual duration from FFprobe.
      //
      // IMPORTANT: we probe the VIDEO STREAM duration, not the container
      // (format=duration). The container-level metadata from Twitch CDN is
      // typically a few hundred milliseconds longer than the actual last
      // video frame PTS. Feeding that inflated number to FFmpeg as `-t` on
      // the output causes the last frame to be held/duplicated to pad the
      // gap — which looks exactly like the video "freezing" at the end.
      //
      // Strategy:
      //  1) Try stream=duration on the first video stream (most accurate)
      //  2) Fall back to format=duration if the stream reports N/A
      //  3) Last resort: keep the caller-provided clipDuration
      try {
        const probeStream = await execFileAsync('ffprobe', [
          '-v', 'quiet',
          '-select_streams', 'v:0',
          '-show_entries', 'stream=duration',
          '-of', 'csv=p=0',
          inputPath,
        ]);
        const streamDur = parseFloat(probeStream.stdout.trim());
        if (Number.isFinite(streamDur) && streamDur > 0) {
          duration = streamDur;
          trc(`FFPROBE stream=duration=${duration}s`);
        } else {
          const probeFormat = await execFileAsync('ffprobe', [
            '-v', 'quiet',
            '-show_entries', 'format=duration',
            '-of', 'csv=p=0',
            inputPath,
          ]);
          const fmtDur = parseFloat(probeFormat.stdout.trim());
          if (Number.isFinite(fmtDur) && fmtDur > 0) {
            duration = fmtDur;
            trc(`FFPROBE format=duration=${duration}s (stream N/A)`);
          }
        }
        // Shave 50ms off the end to guarantee we never cut past the last
        // real video frame — prevents the "frozen last frame" artifact if
        // the container metadata is still slightly ahead of the stream.
        duration = Math.max(0.1, duration - 0.05);
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
    const captionAnim = settings.captions?.animation || 'highlight';

    // MEMORY PROTECTION: For word-pop animation, reduce to 720p to avoid OOM on Railway
    // Word-pop + blur background + ASS rendering is heavy; reducing resolution by ~50% helps significantly
    const isWordPopAnimation = settings.captions?.enabled && captionAnim === 'word-pop';

    const canvasSizes = isSplitScreen
      ? { '9:16': { w: 720, h: 1280 }, '1:1': { w: 720, h: 720 }, '16:9': { w: 1280, h: 720 } }
      : isWordPopAnimation
      ? { '9:16': { w: 720, h: 1280 }, '1:1': { w: 720, h: 720 }, '16:9': { w: 1280, h: 720 } }  // Use split-screen sizes for word-pop
      : { '9:16': { w: 1080, h: 1920 }, '1:1': { w: 1080, h: 1080 }, '16:9': { w: 1920, h: 1080 } };
    const { w: canvasW, h: canvasH } = canvasSizes[targetAspectRatio] || canvasSizes['9:16'];

    if (isWordPopAnimation) {
      trc(`CANVAS reduced to 720p for word-pop animation (memory protection)`);
    }

    // Split-screen info for subtitle positioning
    const splitScreenForCaptions = isSplitScreen ? {
      enabled: true,
      layout: settings.splitScreen.layout || 'top-bottom',
      ratio: settings.splitScreen.ratio || 50,
    } : null;

    // Prepare captions if enabled
    // IMPORTANT: also skip when style='none' — user explicitly chose no captions.
    let assFilePath = null;
    let captionWordTimestamps = []; // hoisted so reorder can remap them
    const captionStyleRequested = settings.captions?.style || 'hormozi';
    const captionsRequested = settings.captions?.enabled && captionStyleRequested !== 'none';
    if (captionsRequested) {
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
          trc(`WHISPER key present=${hasWhisperKey} source=${keySource}`);
          if (!hasWhisperKey) {
            trc(`WHISPER SKIPPED - no key`);
          }
          try {
            trc(`WHISPER calling transcribeWithWhisper...`);
            wordTimestamps = await transcribeWithWhisper(inputPath, {
              tempDir,
              language: 'en', // Most Twitch clips are English
              contextPrompt: clipTitle || '', // Use clip title as context for better vocab
              clipDuration: duration, // For timestamp sanity check
            });
            trc(`WHISPER returned ${wordTimestamps.length} word timestamps`);
            // Log first & last word timestamps for debugging subtitle timing
            if (wordTimestamps.length > 0) {
              const first = wordTimestamps[0];
              const last = wordTimestamps[wordTimestamps.length - 1];
              trc(`WHISPER first="${first.word}" start=${first.start} end=${first.end}`);
              trc(`WHISPER last="${last.word}" start=${last.start} end=${last.end}`);
              trc(`WHISPER clipDuration=${duration} clipStartTime=${clipStartTime}`);
            }
          } catch (err) {
            trc(`WHISPER ERROR: ${err.message}`);
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
          validateWordTimestamps(wordTimestamps);
          captionWordTimestamps = wordTimestamps; // save for potential reorder remap
          const captionAnim = settings.captions.animation || 'highlight';

          // ── ALL animations use ASS subtitles (reliable, single-file, like CapCut/Opus) ──
          trc(`CAPTIONS generating ASS file for animation="${captionAnim}" style="${captionStyle}"`);
          assContent = generateASS(wordTimestamps, {
            ...subtitleOpts,
            animation: captionAnim,
            clipStartTime,
            wordsPerLine: settings.captions.wordsPerLine || 4,
            customColors: settings.captions.customColors,
            customImportantWords: settings.captions.customImportantWords || [],
            emphasisEffect: settings.captions.emphasisEffect || 'none',
            emphasisColor: settings.captions.emphasisColor || 'red',
          });
          trc(`CAPTIONS ASS generated: ${assContent ? assContent.length : 0} bytes`);
        } else {
          // No word timestamps — use static ASS from title (with animation support)
          const captionAnim = settings.captions.animation || 'highlight';
          if (clipTitle && duration > 0) {
            trc(`CAPTIONS FALLBACK: static ASS from title "${clipTitle.substring(0, 40)}" animation="${captionAnim}"`);
            assContent = generateStaticASS(clipTitle, duration, {
              ...subtitleOpts,
              animation: captionAnim,
              wordsPerLine: settings.captions.wordsPerLine || 4,
            });
          } else {
            trc(`CAPTIONS SKIPPED - no word timestamps and no title for fallback`);
          }
        }

        if (assContent) {
          assFilePath = path.join(tempDir, 'captions.ass');
          await fs.writeFile(assFilePath, assContent, 'utf-8');
          trc(`CAPTIONS wrote ASS ${canvasW}x${canvasH} pos=${captionPosition} split=${!!isSplitScreen} size=${assContent.length} bytes`);
          const assLines = assContent.split('\n');
          trc(`CAPTIONS ASS header lines (first 5): ${assLines.slice(0, 5).join(' | ')}`);
          const dialogueLines = assLines.filter(l => l.startsWith('Dialogue:'));
          trc(`CAPTIONS ASS dialogue events: ${dialogueLines.length} events (first: ${dialogueLines[0]?.substring(0, 100) || 'none'})`);
        }
      } catch (err) {
        trc(`CAPTIONS ERROR: ${err.message}`);
      }
    } else {
      trc(`CAPTIONS disabled (enabled=${settings.captions?.enabled}, style=${captionStyleRequested})`);
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
    if (settings.tag && settings.tag.style && settings.tag.style !== 'none') {
      tagConfig = {
        style: settings.tag.style,
        size: settings.tag.size || 100,
        authorName: settings.tag.authorName || null,
        authorHandle: settings.tag.authorHandle || null,
        overlayPng: settings.tag.overlayPng || null,
        overlayAnchorX: settings.tag.overlayAnchorX || null,
        overlayAnchorY: settings.tag.overlayAnchorY || null,
      };
      trc(`TAG applied style=${tagConfig.style} author=${tagConfig.authorHandle || tagConfig.authorName || 'none'}`);
    } else {
      trc(`TAG skipped (style=${settings.tag?.style || 'undefined'})`);
    }

    // ─── Face Detection (for follow mode) ───
    let faceKeyframes = null;
    if (settings.smartZoom?.enabled && settings.smartZoom?.mode === 'follow') {
      try {
        trc('FACE DETECTION starting...');
        const faceResult = await detectFaces(inputPath, {
          canvasW: 720,
          canvasH: 1280,
          everyN: 8,
          timeoutMs: 25000,
        });
        if (faceResult.smoothed && faceResult.smoothed.length >= 2 && faceResult.detected_count > 0) {
          faceKeyframes = faceResult.smoothed;
          trc(`FACE DETECTION done: ${faceResult.detected_count} detections → ${faceKeyframes.length} smoothed keyframes`);
        } else {
          trc(`FACE DETECTION: no faces found or too few keyframes (${faceResult.detected_count || 0} detections), falling back to micro zoom`);
        }
      } catch (faceErr) {
        trc(`FACE DETECTION error: ${faceErr.message}, falling back to micro zoom`);
      }
    }

    // ─── Hook Reorder (pre-processing) ───
    // MUST run BEFORE Auto-Cut because reorder segments reference the ORIGINAL
    // timeline. If Auto-Cut runs first and shrinks a 35s clip to 5.2s, the
    // reorder segments would then reference times past EOF and collapse to
    // degenerate segments (see render_jobs debug_log — "reorder segments
    // collapsed after clamp").
    //
    // After reorder: inputPath points to the reordered file, clipStartTime=0,
    // duration is the reordered duration, and captionWordTimestamps are
    // remapped to the new timeline. Auto-Cut then runs on this fresh state.
    // If reorder is requested but no segments provided, calculate them on the fly
    if (settings.hook?.reorderEnabled && (!settings.hook?.reorder || !settings.hook?.reorder?.segments?.length)) {
      trc(`HOOK REORDER: no segments provided, calculating from duration=${duration}s`);
      const fallbackPeak = detectPeakMoment({ transcript: '', duration, wordTimestamps: [], audioPeaks: [] });
      const peakT = fallbackPeak.peakTime > 0 ? fallbackPeak.peakTime : Math.min(duration * 0.6, duration - 2);
      const hookLen = settings.hook?.length || 1.5;
      settings.hook.reorder = calculateReorderTimestamps(peakT, duration, hookLen, 8);
      trc(`HOOK REORDER fallback: peak=${peakT}s, ${settings.hook.reorder.segments.length} segments`);
    }
    trc(`HOOK REORDER check: enabled=${settings.hook?.enabled} reorderEnabled=${settings.hook?.reorderEnabled} hasReorder=${!!settings.hook?.reorder} segments=${settings.hook?.reorder?.segments?.length || 0}`);
    if (settings.hook?.reorderEnabled && settings.hook?.reorder?.segments?.length >= 2) {
      try {
        // Clamp any segment whose end exceeds the actual video duration.
        const maxT = Math.max(0.1, duration);
        const segments = settings.hook.reorder.segments
          .map((s) => {
            const start = Math.max(0, Math.min(Number(s.start) || 0, maxT));
            const end = Math.max(start, Math.min(Number(s.end) || 0, maxT));
            return { ...s, start, end };
          })
          .filter((s) => (s.end - s.start) >= 0.2);
        if (segments.length < 2) {
          throw new Error(`reorder segments collapsed after clamp (<2 valid segments, maxT=${maxT.toFixed(2)}s)`);
        }
        trc(`HOOK REORDER: ${segments.length} segments — ${segments.map(s => `${s.label}(${s.start.toFixed(2)}-${s.end.toFixed(2)}s)`).join(' → ')}`);

        const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
        const reorderOutputPath = path.join(tempDir, 'reordered.mp4');
        const segmentFiles = [];

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const segStart = clipStartTime + seg.start;
          const segDuration = seg.end - seg.start;
          const segFile = path.join(tempDir, `seg_${i}.ts`);
          segmentFiles.push(segFile);

          trc(`HOOK REORDER: extracting segment ${i} (${seg.label}): ${segStart}s → ${segStart + segDuration}s (${segDuration}s)`);

          const segArgs = [
            '-y',
            '-ss', String(segStart),
            '-i', inputPath,
            '-t', String(segDuration),
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
            '-c:a', 'aac', '-b:a', '128k',
            '-threads', '1',
            '-f', 'mpegts',
            segFile,
          ];

          await execFileAsync(ffmpegPath, segArgs, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
          trc(`HOOK REORDER: segment ${i} extracted OK`);
        }

        const concatInput = `concat:${segmentFiles.join('|')}`;
        const concatArgs = [
          '-y',
          '-i', concatInput,
          '-c', 'copy',
          '-movflags', '+faststart',
          reorderOutputPath,
        ];

        await execFileAsync(ffmpegPath, concatArgs, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });

        const reorderStat = await fs.stat(reorderOutputPath);
        trc(`HOOK REORDER: output file size = ${reorderStat.size} bytes`);

        if (reorderStat.size < 1000) {
          throw new Error(`Reordered file too small: ${reorderStat.size} bytes`);
        }

        // ── Remap caption word timestamps to match new segment order ──
        // Build offset map: each segment's new start in the reordered video
        let newOffset = 0;
        const segmentMap = segments.map(seg => {
          const entry = { origStart: seg.start, origEnd: seg.end, newStart: newOffset };
          newOffset += (seg.end - seg.start);
          return entry;
        });
        trc(`REORDER SUBS: remapping ${captionWordTimestamps.length} words across ${segmentMap.length} segments`);

        const remappedWords = [];
        for (const w of captionWordTimestamps) {
          const wStart = w.start - clipStartTime;
          const wEnd = w.end - clipStartTime;
          for (const seg of segmentMap) {
            if (wStart >= seg.origStart && wStart < seg.origEnd) {
              const offset = wStart - seg.origStart;
              const endOffset = Math.min(wEnd - seg.origStart, seg.origEnd - seg.origStart);
              remappedWords.push({
                ...w,
                start: Math.round((seg.newStart + offset) * 100) / 100,
                end: Math.round((seg.newStart + endOffset) * 100) / 100,
              });
              break;
            }
          }
        }
        remappedWords.sort((a, b) => a.start - b.start);
        trc(`REORDER SUBS: ${remappedWords.length}/${captionWordTimestamps.length} words remapped`);

        // ── Commit reorder: mutate the pipeline state ──
        inputPath = reorderOutputPath;
        clipStartTime = 0;
        duration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
        // Re-probe to be 100% sure we match the real video stream
        try {
          const probe = await execFileAsync('ffprobe', [
            '-v', 'quiet',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=duration',
            '-of', 'csv=p=0',
            reorderOutputPath,
          ]);
          const probed = parseFloat(probe.stdout.trim());
          if (Number.isFinite(probed) && probed > 0) {
            duration = Math.max(0.1, probed - 0.05);
            trc(`HOOK REORDER: re-probed stream duration=${probed.toFixed(3)}s → duration=${duration.toFixed(3)}s`);
          }
        } catch {}
        clipEndTime = duration;
        captionWordTimestamps = remappedWords;
        trc(`HOOK REORDER done: ${duration}s reordered clip at ${reorderOutputPath}`);

        // Rewrite ASS with remapped timestamps (clipStartTime=0 since already rebased)
        if (assFilePath && remappedWords.length > 0) {
          try {
            const captionStyle = settings.captions?.style || 'hormozi';
            const captionPosition = settings.captions?.position || 'bottom';
            const captionAnim = settings.captions?.animation || 'highlight';
            const remappedASS = generateASS(remappedWords, {
              style: captionStyle,
              position: captionPosition,
              canvasWidth: canvasW,
              canvasHeight: canvasH,
              splitScreen: splitScreenForCaptions,
              animation: captionAnim,
              clipStartTime: 0,
              wordsPerLine: settings.captions?.wordsPerLine || 4,
              customColors: settings.captions?.customColors,
              customImportantWords: settings.captions?.customImportantWords || [],
              emphasisEffect: settings.captions?.emphasisEffect || 'none',
              emphasisColor: settings.captions?.emphasisColor || 'red',
            });
            if (remappedASS) {
              await fs.writeFile(assFilePath, remappedASS, 'utf-8');
              trc(`REORDER SUBS: rewrote ASS file with remapped timestamps (${remappedASS.length} bytes)`);
            }
          } catch (subErr) {
            trc(`REORDER SUBS error: ${subErr.message} — using original subtitle timing`);
          }
        }

        // Cleanup segment temp files
        for (const f of segmentFiles) {
          fs.unlink(f).catch(() => {});
        }
      } catch (reorderErr) {
        trc(`HOOK REORDER FAILED: ${reorderErr.message}`);
        trc(`HOOK REORDER stderr: ${reorderErr.stderr || 'none'}`);
        // Fallback: continue with original input (inputPath/clipStartTime/duration unchanged)
      }
    }

    // ─── Auto-Cut Silences (pre-processing) ───
    // Runs AFTER Hook Reorder so it operates on the reordered timeline with
    // already-remapped word timestamps.
    if (settings.autoCut?.enabled && captionWordTimestamps.length > 0) {
      try {
        const threshold = settings.autoCut.silenceThreshold || 0.7;
        trc(`AUTO-CUT: enabled with threshold=${threshold}s, ${captionWordTimestamps.length} words`);
        const cutResult = await applyAutoCut(inputPath, tempDir, captionWordTimestamps, duration, {
          silenceThreshold: threshold,
          clipStartTime,
          trc,
        });
        if (cutResult) {
          inputPath = cutResult.outputPath;
          clipStartTime = 0; // cut file starts at 0
          duration = cutResult.cutDuration;
          clipEndTime = cutResult.cutDuration;
          captionWordTimestamps = cutResult.wordTimestamps;
          trc(`AUTO-CUT: applied — new duration=${duration}s, new input=${inputPath}`);

          // Regenerate ASS file with remapped timestamps
          if (assFilePath && captionWordTimestamps.length > 0) {
            const captionStyle = settings.captions?.style || 'hormozi';
            const captionPosition = settings.captions?.position || 'bottom';
            const captionAnim = settings.captions?.animation || 'highlight';
            const cutASS = generateASS(captionWordTimestamps, {
              style: captionStyle,
              position: captionPosition,
              canvasWidth: canvasW,
              canvasHeight: canvasH,
              splitScreen: splitScreenForCaptions,
              animation: captionAnim,
              clipStartTime: 0,
              wordsPerLine: settings.captions?.wordsPerLine || 4,
              customColors: settings.captions?.customColors,
              customImportantWords: settings.captions?.customImportantWords || [],
              emphasisEffect: settings.captions?.emphasisEffect || 'none',
              emphasisColor: settings.captions?.emphasisColor || 'red',
            });
            if (cutASS) {
              await fs.writeFile(assFilePath, cutASS, 'utf-8');
              trc(`AUTO-CUT: regenerated ASS subtitles (${cutASS.length} bytes)`);
            }
          }
        }
      } catch (cutErr) {
        trc(`AUTO-CUT FAILED: ${cutErr.message} — using original clip`);
      }
    }


    // Render clip with FFmpeg — serialize via the render queue so concurrent
    // requests don't OOM Railway. The queue is in-memory (process-local),
    // which is fine for a single-VPS deployment. Migrate to BullMQ + Redis
    // when we scale beyond one worker.
    const outputPath = path.join(tempDir, 'output.mp4');
    console.log(`[Render ${renderSessionId}] Enqueueing FFmpeg render...`);

    const userPlan = source === 'trending' ? 'pro' : (await getUserProfile(userId))?.plan || 'free';

    await enqueueRender(jobId || renderSessionId, () => renderClip(inputPath, outputPath, {
      startTime: clipStartTime,
      endTime: clipStartTime + duration,
      duration: duration,
      aspectRatio: settings.format?.aspectRatio || '9:16',
      captions: assFilePath
        ? { assFilePath, ...settings.captions }
        : null,
      watermark: null,
      plan: userPlan,
      splitScreen: splitScreenConfig,
      tag: tagConfig,
      cropAnchor: settings.format?.cropAnchor || 'center',
      backgroundBlur: settings.format?.backgroundBlur || false,
      videoZoom: settings.format?.videoZoom || 'fill',
      crf: settings.format?.crf || 23,
      smartZoom: settings.smartZoom?.enabled ? {
        enabled: true,
        mode: settings.smartZoom.mode || 'micro',
        faceKeyframes: faceKeyframes,
      } : null,
      hook: settings.hook?.enabled ? {
        enabled: true,
        textEnabled: settings.hook.textEnabled !== false,
        text: settings.hook.text || '',
        style: settings.hook.style || 'choc',
        textPosition: settings.hook.textPosition || 15,
        length: settings.hook.length || 1.5,
        overlayPng: settings.hook.overlayPng || null,
        overlayCapsuleW: settings.hook.overlayCapsuleW || null,
        overlayCapsuleH: settings.hook.overlayCapsuleH || null,
      } : null,
      audioEnhance: settings.audioEnhance?.enabled || false,
    }));

    // Upload rendered clip to Supabase Storage (unique path per render to avoid CDN cache)
    const renderTs = Date.now();
    const clipStoragePath = source === 'trending' ? `trending/${clipId}_${renderTs}.mp4` : `${userId}/${clipId}_${renderTs}.mp4`;
    console.log(`[Render ${renderSessionId}] Uploading rendered clip...`);
    const uploadResult = await uploadClip(outputPath, clipStoragePath);

    // Extract and upload thumbnail FROM RENDERED OUTPUT (not input!)
    // This proves the rendered video actually has subtitles baked in.
    let thumbnailPath = null;
    try {
      const thumbnailFileName = path.join(tempDir, 'thumbnail.png');
      // Extract thumbnail from the RENDERED video at 1 second in (should show subtitles)
      await extractThumbnail(outputPath, thumbnailFileName, 1);
      const thumbStoragePath = source === 'trending'
        ? `trending/${clipId}_${renderTs}_thumb.png`
        : `${userId}/${clipId}_${renderTs}_thumb.png`;
      const thumbUpload = await uploadThumbnail(thumbnailFileName, thumbStoragePath);
      thumbnailPath = thumbUpload.path;
      trc(`THUMBNAIL extracted from rendered output at t=1s → ${thumbStoragePath}`);
    } catch (err) {
      console.warn(`[Render ${renderSessionId}] Warning: Failed to create thumbnail:`, err.message);
      // Fallback: try from input
      try {
        const thumbnailFileName = path.join(tempDir, 'thumbnail.png');
        await extractThumbnail(inputPath, thumbnailFileName, clipStartTime + 1);
        const thumbStoragePath = `${userId}/${clipId}_thumb.png`;
        const thumbUpload = await uploadThumbnail(thumbnailFileName, thumbStoragePath);
        thumbnailPath = thumbUpload.path;
      } catch (err2) {
        console.warn(`[Render ${renderSessionId}] Warning: Fallback thumbnail also failed:`, err2.message);
      }
    }

    // Update database (only for user clips)
    if (source !== 'trending' && clipId) {
      await updateClipAfterRender(clipId, duration, clipStoragePath, thumbnailPath);
      if (videoId) await maybeMarkVideoComplete(videoId);
    }

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    console.log(`[Render ${renderSessionId}] Render completed in ${elapsedSeconds.toFixed(1)}s`);

    trc(`DONE elapsed=${elapsedSeconds.toFixed(1)}s captions=${assFilePath ? 'ASS' : 'none'} tag=${tagConfig?.style || 'none'}`);

    // Mark render job as done
    await updateRenderJob(req.body.jobId, {
      status: 'done',
      storage_path: clipStoragePath,
      clip_url: uploadResult.url,
      debug_log: trace.join('\n'),
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

    trace.push(`[ERROR] ${errorMsg}`);

    // Mark render job as error — do this FIRST and protect it
    try {
      await updateRenderJob(req.body?.jobId, {
        status: 'error',
        error_message: errorMsg.substring(0, 2000),
        debug_log: trace.join('\n'),
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

// ─── Hook Generator Endpoint ────────────────────────────────────────────────
// POST /api/render/hook
// Analyzes a clip and returns peak moment + 3 hook text variants + reorder timestamps
router.post('/hook', async (req, res) => {
  try {
    const {
      transcript = '',
      wordTimestamps = [],
      audioPeaks = [],
      duration = 30,
      streamerName = '',
      niche = '',
      title = '',
      hookLength = 1.5,
      maxContext = 8,
    } = req.body;

    console.log(`[Hook] Generating hooks: duration=${duration}s, words=${wordTimestamps.length}, peaks=${audioPeaks.length}`);

    // 1. Detect peak moment
    const peak = detectPeakMoment({
      audioPeaks,
      wordTimestamps,
      transcript,
      duration,
    });

    // 2. Generate 3 hook text variants (Claude API — contextual, French, emojis)
    const hooks = await generateHookTexts({
      transcript,
      streamerName,
      niche,
      title,
    });

    // 3. Calculate reorder timestamps
    const reorder = calculateReorderTimestamps(
      peak.peakTime,
      duration,
      hookLength,
      maxContext,
    );

    console.log(`[Hook] Peak at ${peak.peakTime}s (score ${peak.peakScore}), ${reorder.segments.length} segments, total ${reorder.totalDuration}s`);

    res.json({
      data: {
        peak,
        hooks,
        reorder,
      },
      error: null,
    });
  } catch (err) {
    console.error('[Hook] Error:', err.message);
    res.status(500).json({
      data: null,
      error: err.message,
      message: 'Failed to generate hooks',
    });
  }
});

export default router;
