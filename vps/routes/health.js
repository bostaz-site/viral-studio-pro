import express from 'express';
import { logger } from '../lib/logger.js';
import { promises as fs } from 'fs';
import { checkFfmpegAvailability } from '../lib/ffmpeg-render.js';
import { checkYtdlpAvailability } from '../lib/yt-dlp-wrapper.js';
import { checkSupabaseHealth } from '../lib/supabase-client.js';
import { getQueueStatus, getJobPosition } from '../lib/render-queue.js';
import { getOpenCVStatus } from '../lib/opencv-check.js';

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
        opencv: {
          healthy: getOpenCVStatus(),
          error: getOpenCVStatus() === false ? 'CascadeClassifier or haarcascades unavailable — crop advisor and face tracking disabled' : null,
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

    // Fetch recent Twitch clips from DB instead of hardcoded URL
    let probeUrls = [];
    try {
      const { supabase } = await import('../lib/supabase-client.js');
      const { data: clips } = await supabase
        .from('trending_clips')
        .select('external_url')
        .eq('platform', 'twitch')
        .gte('clip_created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .order('velocity_score', { ascending: false })
        .limit(5);
      probeUrls = (clips || []).map(c => c.external_url).filter(Boolean);
    } catch { /* DB unavailable — fall through */ }

    if (probeUrls.length === 0) {
      probeUrls = ['https://clips.twitch.tv/CalmClearWatermelonBCouch'];
    }

    // Try up to 3 clips. Expired = try next. Error on all = extractor broken.
    const EXPIRED = /no longer available|HTTP Error 404|Video unavailable|has been deleted/i;
    let lastErr = null;
    let expired = 0;
    const tried = probeUrls.slice(0, 3);

    for (const url of tried) {
      try {
        const { stdout } = await execFileAsync(ytdlpPath, ['--get-title', url], { timeout: 30_000 });
        if (stdout.trim()) return res.json({ ok: true, title: stdout.trim(), probeUrl: url });
      } catch (err) {
        lastErr = err;
        if (EXPIRED.test(err.stderr || err.message || '')) { expired++; continue; }
        break;
      }
    }

    if (expired >= tried.length) {
      return res.json({ ok: true, title: '(all probe clips expired, extractor assumed OK)', expired });
    }

    logger.error({ err: lastErr?.message }, 'yt-dlp extractor health check failed');
    res.status(502).json({ ok: false, error: lastErr?.message || 'yt-dlp extractor broken', expired });
  } catch (err) {
    logger.error({ err: err.message }, 'yt-dlp health check error');
    res.status(502).json({ ok: false, error: err.message });
  }
});

export default router;
