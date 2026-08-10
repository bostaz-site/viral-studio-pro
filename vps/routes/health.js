import express from 'express';
import { logger } from '../lib/logger.js';
import { promises as fs } from 'fs';
import { checkFfmpegAvailability } from '../lib/ffmpeg-render.js';
import { checkYtdlpAvailability } from '../lib/yt-dlp-wrapper.js';
import { checkSupabaseHealth } from '../lib/supabase-client.js';
import { getQueueStatus, getJobPosition } from '../lib/render-queue.js';

const router = express.Router();
const startTime = Date.now();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/health — Health check endpoint
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    // Check system components
    const ffmpegStatus = await checkFfmpegAvailability();
    const ytdlpStatus = await checkYtdlpAvailability();
    const supabaseStatus = await checkSupabaseHealth();

    const uptime = Math.floor((Date.now() - startTime) / 1000);

    // Check font availability for drawtext
    const fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
    let fontAvailable = false;
    try {
      await fs.access(fontPath);
      fontAvailable = true;
    } catch {
      fontAvailable = false;
    }

    const allHealthy = ffmpegStatus.ffmpeg && supabaseStatus.connected;

    // Always return 200 so Railway/Docker healthchecks pass even when
    // Supabase is temporarily unreachable during cold-start. The body
    // still reports degraded status for observability.
    res.status(200).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: `${uptime}s`,
      version: '1.2.0',
      renderQueue: getQueueStatus(),
      environment: process.env.NODE_ENV || 'development',
      components: {
        ffmpeg: {
          available: ffmpegStatus.ffmpeg,
          error: ffmpegStatus.ffmpeg ? null : 'Not installed',
        },
        ffprobe: {
          available: ffmpegStatus.ffprobe,
          error: ffmpegStatus.ffprobe ? null : 'Not installed',
        },
        ytdlp: {
          available: ytdlpStatus.available,
          error: ytdlpStatus.available ? null : ytdlpStatus.error,
        },
        supabase: {
          connected: supabaseStatus.connected,
          error: supabaseStatus.connected ? null : supabaseStatus.error,
        },
        fonts: {
          dejavuBold: fontAvailable,
          path: fontPath,
        },
        openaiKey: {
          configured: !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY),
        },
      },
    });
  } catch (err) {
    logger.error({ err }, 'health check failed');

    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: err.message,
      message: 'Health check failed',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/health/queue — Lightweight queue stats + per-job position
//
// Unlike `/` above, this endpoint does NOT ffprobe or ping Supabase, so it's
// cheap enough to poll every few seconds while a render is in flight. If a
// `jobId` query param is provided, returns its position in the queue
// (0 = running, N = waiting position, -1 = unknown/finished).
// ─────────────────────────────────────────────────────────────────────────────

router.get('/queue', (req, res) => {
  const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : null;
  const queue = getQueueStatus();
  res.json({
    queue,
    jobPosition: jobId ? getJobPosition(jobId) : null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/health/ytdlp — Deep yt-dlp extractor health check
//
// Runs `yt-dlp --get-title` on a known stable Twitch clip. If the extractor
// is broken (Twitch API change), this fails before any user hits it.
// Called by the watchdog cron from the Next.js app.
// Auth: x-api-key (same as render routes).
// ─────────────────────────────────────────────────────────────────────────────

const YTDLP_PROBE_URL = 'https://clips.twitch.tv/CalmClearWatermelonBCouch';

router.get('/ytdlp', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.VPS_RENDER_API_KEY || process.env.API_SECRET;
  if (!apiKey || !expectedKey || apiKey !== expectedKey) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync(ytdlpPath, ['--get-title', YTDLP_PROBE_URL], {
      timeout: 30_000,
    });

    const title = stdout.trim();
    if (!title) {
      return res.status(502).json({ ok: false, error: 'yt-dlp returned empty title' });
    }

    res.json({ ok: true, title });
  } catch (err) {
    logger.error({ err: err.message }, 'yt-dlp extractor health check failed');
    res.status(502).json({ ok: false, error: err.message || 'yt-dlp extractor broken' });
  }
});

export default router;
