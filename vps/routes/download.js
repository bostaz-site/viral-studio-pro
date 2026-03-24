import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { downloadVideo, getVideoMetadata, checkYtdlpAvailability } from '../lib/yt-dlp-wrapper.js';

const router = express.Router();

const DOWNLOAD_DIR = process.env.TEMP_DIR || '/tmp/viral-studio-downloads';

async function ensureDownloadDir() {
  try {
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create download directory:', err.message);
  }
}

ensureDownloadDir();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/download — Download video from URL
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const sessionId = uuidv4();
  let sessionDir = null;

  try {
    const { url, platform } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing URL',
        message: 'url is required',
      });
    }

    console.log(`[Download ${sessionId}] Starting download from ${platform || 'unknown platform'}: ${url}`);

    // Check yt-dlp availability
    const ytdlpStatus = await checkYtdlpAvailability();
    if (!ytdlpStatus.available) {
      return res.status(503).json({
        success: false,
        error: 'yt-dlp not available',
        message: 'yt-dlp is not installed on this server',
      });
    }

    // Create session directory
    sessionDir = path.join(DOWNLOAD_DIR, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    // Download video
    console.log(`[Download ${sessionId}] Downloading...`);
    const downloadResult = await downloadVideo(url, sessionDir, {
      timeout: 600000, // 10 minutes
    });

    if (!downloadResult.success) {
      throw new Error(downloadResult.error || 'Download failed');
    }

    console.log(`[Download ${sessionId}] Download completed:`, downloadResult.metadata.title);

    res.json({
      success: true,
      data: {
        filePath: downloadResult.filePath,
        filename: path.basename(downloadResult.filePath),
        metadata: downloadResult.metadata,
        sessionId,
      },
      message: 'Video downloaded successfully',
    });
  } catch (err) {
    console.error(`[Download ${sessionId}] Error:`, err.message);

    res.status(500).json({
      success: false,
      error: err.message || 'Download failed',
      message: 'Failed to download video',
      sessionId,
    });
  } finally {
    // Note: Don't delete session directory here — let it be cleaned up by a scheduled job
    // or keep it temporarily for the caller to process
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/download/metadata — Get video metadata without downloading
// ─────────────────────────────────────────────────────────────────────────────

router.post('/metadata', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing URL',
        message: 'url is required',
      });
    }

    console.log(`[Metadata] Fetching metadata for: ${url}`);

    // Check yt-dlp availability
    const ytdlpStatus = await checkYtdlpAvailability();
    if (!ytdlpStatus.available) {
      return res.status(503).json({
        success: false,
        error: 'yt-dlp not available',
        message: 'yt-dlp is not installed on this server',
      });
    }

    // Get metadata
    const result = await getVideoMetadata(url);

    res.json({
      success: true,
      data: result.metadata,
      message: 'Metadata fetched successfully',
    });
  } catch (err) {
    console.error('[Metadata Error]', err.message);

    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch metadata',
      message: 'Metadata fetch failed',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/download/:sessionId — Cleanup downloaded file
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || !/^[a-f0-9\-]{36}$/.test(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID',
        message: 'sessionId must be a valid UUID',
      });
    }

    const sessionDir = path.join(DOWNLOAD_DIR, sessionId);

    // Security check: ensure path is within DOWNLOAD_DIR
    if (!sessionDir.startsWith(DOWNLOAD_DIR)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Cannot delete files outside download directory',
      });
    }

    console.log(`[Download] Cleaning up session ${sessionId}`);
    await fs.rm(sessionDir, { recursive: true, force: true });

    res.json({
      success: true,
      message: 'Session cleaned up successfully',
    });
  } catch (err) {
    console.error('[Cleanup Error]', err.message);

    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Failed to cleanup session',
    });
  }
});

export default router;
