import express from 'express';
import { promises as fs } from 'fs';
import { checkFfmpegAvailability } from '../lib/ffmpeg-render.js';
import { checkYtdlpAvailability } from '../lib/yt-dlp-wrapper.js';
import { checkSupabaseHealth } from '../lib/supabase-client.js';

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
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: `${uptime}s`,
      version: '1.1.0',
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
          configured: !!process.env.OPENAI_API_KEY,
          length: (process.env.OPENAI_API_KEY || '').length,
          startsWith: (process.env.OPENAI_API_KEY || '').slice(0, 7),
        },
        envKeys: Object.keys(process.env).filter(k => /openai|api_key|api|secret|supabase|port/i.test(k)).sort(),
      },
    });
  } catch (err) {
    console.error('[Health Check Error]', err.message);

    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: err.message,
      message: 'Health check failed',
    });
  }
});

export default router;
