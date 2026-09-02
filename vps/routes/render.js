import express from 'express';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { renderClip, extractThumbnail, checkFfmpegAvailability, buildFollowFaceFilter } from '../lib/ffmpeg-render.js';
import { generateASS, generateStaticASS, validateWordTimestamps } from '../lib/subtitle-generator.js';
import { detectFaces } from '../lib/face-tracker.js';
import { detectPeakMoment, generateHookTexts, calculateReorderTimestamps } from '../lib/hook-generator.js';
import { detectBurnedCaptions } from '../lib/caption-detector.js';
// caption-png.js and drawtext-wordpop.js removed — all animations now use ASS subtitles
import { transcribeWithWhisper } from '../lib/whisper-client.js';
import { applyAutoCut, classifyIntensity, getAdaptiveThreshold } from '../lib/auto-cut.js';
import { synthesizeVoiceover } from '../lib/elevenlabs-client.js';
import { detectReactionLayout, detectDuoLayout } from '../lib/layout-detector.js';
import { adviseCrop } from '../lib/crop-advisor.js';
import { createContract, trackFeatureFailure, resetFeatureStreak } from '../lib/render-contract.js';
import { enqueueRender, getQueueStatus } from '../lib/render-queue.js';
import { computeDiversify, getDiversifiedAccentColor, pickVoice } from '../lib/diversify.js';
import { deriveAllVariants } from '../lib/variant-derive.js';
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
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
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

/**
 * Send HMAC-signed webhook callback to Next.js after render completion.
 * Requires WEBHOOK_SECRET and APP_URL env vars.
 */
async function sendWebhookCallback(jobId, status, storagePath, errorMessage, extra = {}) {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  const appUrl = process.env.APP_URL || 'https://viralanimal.com';

  if (!webhookSecret) {
    console.warn('[Webhook] WEBHOOK_SECRET not set, skipping callback');
    return;
  }

  const payload = {
    jobId,
    status,
    storagePath: storagePath || null,
    errorMessage: errorMessage || null,
    timestamp: Date.now(),
    ...extra,
  };

  const bodyString = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(bodyString).digest('hex');

  const delays = [0, 5000, 30000]; // immediate, 5s, 30s
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
    try {
      const r = await fetch(`${appUrl}/api/render/hook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body: bodyString,
      });
      if (r.ok) {
        console.log(`[Webhook] Callback sent for job ${jobId}: ${r.status} (attempt ${attempt + 1})`);
        return;
      }
      console.warn(`[Webhook] Callback ${r.status} for job ${jobId} (attempt ${attempt + 1}/${delays.length})`);
    } catch (err) {
      console.error(`[Webhook] Failed for job ${jobId} (attempt ${attempt + 1}/${delays.length}):`, err.message);
    }
  }
}

const execFileAsync = promisify(execFile);
const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Language detection from streamer name
// ─────────────────────────────────────────────────────────────────────────────

const FRENCH_STREAMERS = [
  'kameto', 'gotaga', 'squeezie', 'aminematue', 'locklear',
  'sardoche', 'joueur_du_grenier', 'mistermv', 'lebouseuh',
  'michou', 'inoxtag', 'amixem', 'thekairi78', 'domingo',
  'jlxtv', 'ponce', 'kenny', 'zerator', 'joueurdugrenier',
  'xari', 'etoiles', 'solary', 'tonton',
];

function detectLanguageFromStreamer(authorName) {
  if (!authorName) return null;
  const lower = authorName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const s of FRENCH_STREAMERS) {
    if (lower.includes(s)) return 'fr';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voiceover script generation via Claude Haiku (VPS-side)
// ─────────────────────────────────────────────────────────────────────────────

// Track consecutive voiceover failures for Discord alerts
let consecutiveVoiceoverFailures = 0;

function trackVoiceoverFailure(trc) {
  consecutiveVoiceoverFailures++;
  trc(`VOICEOVER: consecutive failures: ${consecutiveVoiceoverFailures}`);
  if (consecutiveVoiceoverFailures >= 3) {
    alertDiscordVoiceoverFailure(consecutiveVoiceoverFailures).catch(() => {});
  }
}

function resetVoiceoverFailures() {
  consecutiveVoiceoverFailures = 0;
}

async function alertDiscordVoiceoverFailure(count) {
  const webhookUrl = process.env.DISCORD_AUDIT_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `**[CRITICAL] Voiceover generation failing** — ${count} consecutive renders without voiceover. Check ANTHROPIC_API_KEY and ELEVENLABS_API_KEY on Railway VPS.`,
      }),
    });
  } catch { /* non-critical */ }
}

/**
 * Generate voiceover commentary lines using Claude Haiku.
 * Finds silence gaps in word timestamps and places lines there.
 * Returns array of {text, startTime, estimatedDuration, role} or null.
 *
 * Every exit path logs a distinct reason via trc() for debug_log tracing.
 */
async function generateVoiceoverScriptOnVps({ wordTimestamps, clipTitle, streamerName, niche, clipDuration, trc }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    trc('VOICEOVER SCRIPT: ABORT reason=no_ANTHROPIC_API_KEY — env var not set on VPS');
    return null;
  }

  const transcript = wordTimestamps.map(w => w.word).join(' ').trim();
  if (!transcript || transcript.length < 10) {
    trc(`VOICEOVER SCRIPT: ABORT reason=transcript_too_short (${transcript.length} chars, need >=10)`);
    return null;
  }

  trc(`VOICEOVER SCRIPT: transcript="${transcript.slice(0, 80)}..." (${transcript.length} chars)`);

  // Find silence gaps — use 0.4s threshold (was 0.6s, too strict for fast-talking streamers)
  const MIN_GAP = 0.4;
  const gaps = [];
  if (wordTimestamps.length > 0 && wordTimestamps[0].start >= MIN_GAP) {
    gaps.push({ start: 0, end: wordTimestamps[0].start, duration: wordTimestamps[0].start });
  }
  for (let i = 0; i < wordTimestamps.length - 1; i++) {
    const gapDur = wordTimestamps[i + 1].start - wordTimestamps[i].end;
    if (gapDur >= MIN_GAP) {
      gaps.push({ start: wordTimestamps[i].end, end: wordTimestamps[i + 1].start, duration: gapDur });
    }
  }
  if (wordTimestamps.length > 0) {
    const lastEnd = wordTimestamps[wordTimestamps.length - 1].end;
    if (clipDuration - lastEnd >= MIN_GAP) {
      gaps.push({ start: lastEnd, end: clipDuration, duration: clipDuration - lastEnd });
    }
  }

  const gapsDesc = gaps.length > 0
    ? gaps.map(g => `${g.start.toFixed(1)}-${g.end.toFixed(1)}s`).join(', ')
    : 'No clear gaps — place lines at start/end anyway';

  trc(`VOICEOVER SCRIPT: found ${gaps.length} silence gaps (threshold=${MIN_GAP}s): ${gapsDesc}`);

  const prompt = `Write ENERGETIC voiceover commentary for a TikTok gaming/streaming clip. The voice actor reads your lines with high energy — write for PERFORMANCE, not for reading.

CLIP: "${clipTitle}" by ${streamerName || 'streamer'} (${niche || 'gaming'}, ${clipDuration.toFixed(1)}s)
TRANSCRIPT: "${transcript.slice(0, 1500)}"
SILENCE GAPS: ${gapsDesc}

Write 2-4 SHORT punchy lines (5-10 words, max 12). Each has role "hook"/"reaction"/"closer".
- 1 hook at startTime 0.2 (hype anticipation!)
- 1-2 reactions at or near silence gaps
- Optional closer in last 2s

PERFORMANCE RULES (the TTS reads punctuation as emotion):
- Use ! for excitement: "he actually DID it!"
- Use ... for suspense: "wait for it..."
- Use CAPS for emphasis on 1-2 key words: "that was INSANE!"
- Keep it punchy — fragments > full sentences: "no WAY!" not "there is no way that happened"
- Sound like a hyped clip commentator, NOT a narrator
- NEVER write flat declarative sentences like "he plays well" — write "he's COOKING right now!"
- Reference the actual clip content (streamer, action, situation)

Return ONLY a JSON array:
[{"text":"yo watch THIS play!","startTime":0.2,"role":"hook","estimatedDuration":1.2}]`;

  try {
    trc('VOICEOVER SCRIPT: calling Claude Haiku API...');
    const startMs = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const latencyMs = Date.now() - startMs;

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      trc(`VOICEOVER SCRIPT: ABORT reason=claude_api_error status=${response.status} body="${errBody.slice(0, 150)}" (${latencyMs}ms)`);
      return null;
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';
    trc(`VOICEOVER SCRIPT: Claude response (${latencyMs}ms, ${text.length} chars): "${text.slice(0, 200)}"`);

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      trc(`VOICEOVER SCRIPT: ABORT reason=no_json_array_in_response — Claude response didn't contain a JSON array`);
      return null;
    }

    let lines;
    try {
      lines = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      trc(`VOICEOVER SCRIPT: ABORT reason=json_parse_error — ${parseErr.message}`);
      return null;
    }

    if (!Array.isArray(lines)) {
      trc(`VOICEOVER SCRIPT: ABORT reason=not_an_array — parsed value is ${typeof lines}`);
      return null;
    }

    const valid = lines
      .filter(l => l.text && l.text.length <= 80 && typeof l.startTime === 'number' && l.startTime >= 0 && l.startTime < clipDuration)
      .slice(0, 4)
      .map(l => ({ text: l.text, startTime: l.startTime, estimatedDuration: l.estimatedDuration || 1.5, role: l.role || 'reaction' }));

    trc(`VOICEOVER SCRIPT: parsed ${lines.length} lines, ${valid.length} valid after filtering`);

    // Log cost (fire-and-forget)
    try {
      await supabase.from('ai_calls').insert({
        model: 'claude-haiku-4-5-20251001', feature: 'voiceover_script',
        tokens_input: result.usage?.input_tokens, tokens_output: result.usage?.output_tokens,
        cost_usd: ((result.usage?.input_tokens || 0) / 1e6) * 1.0 + ((result.usage?.output_tokens || 0) / 1e6) * 5.0,
        latency_ms: latencyMs,
        success: valid.length > 0,
      });
    } catch { /* non-critical */ }

    if (valid.length === 0) {
      trc(`VOICEOVER SCRIPT: ABORT reason=all_lines_filtered — ${lines.length} lines from Claude, 0 passed validation (check startTime bounds and text length)`);
      return null;
    }

    return valid;
  } catch (err) {
    trc(`VOICEOVER SCRIPT: ABORT reason=exception — ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart hook detection via Claude Haiku
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call Claude Haiku to identify the peak viral moment in a transcript.
 * Returns optimal start timestamp in seconds, or null on failure.
 */
async function detectSmartHookStart(transcript, duration, trc) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    trc('SMART HOOK: no ANTHROPIC_API_KEY, skipping');
    return null;
  }
  if (!transcript || transcript.length < 10) {
    trc('SMART HOOK: transcript too short, skipping');
    return null;
  }

  try {
    trc('SMART HOOK: calling Claude Haiku for peak moment detection...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: `Here is the transcript of a ${duration.toFixed(1)}s Twitch/gaming clip:\n\n"${transcript.slice(0, 2000)}"\n\nIdentify the most viral/funny/interesting moment. Return ONLY the timestamp in seconds (e.g. 4.5) where the clip should START to maximize the hook (= peak moment - 1.5s). If the peak is in the first 2 seconds, return 0.`,
        }],
      }),
    });

    if (!response.ok) {
      trc(`SMART HOOK: Claude API error ${response.status}`);
      return null;
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';
    const match = text.match(/([\d.]+)/);
    if (!match) {
      trc(`SMART HOOK: could not parse timestamp from response: "${text}"`);
      return null;
    }

    const peakStart = parseFloat(match[1]);
    trc(`SMART HOOK: Claude suggests start=${peakStart}s`);

    // Sanity checks
    if (!Number.isFinite(peakStart) || peakStart < 0) return 0;
    if (peakStart >= duration - 2) {
      trc(`SMART HOOK: peak ${peakStart}s is near end (duration=${duration.toFixed(1)}s) — skipping trim`);
      return null; // Don't trim — leaving only a few seconds is worse than no trim
    }
    return peakStart;
  } catch (err) {
    trc(`SMART HOOK: error ${err.message}`);
    return null;
  }
}

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

/**
 * Purge stale temp/output entries older than maxAgeMs (default 2h).
 * Runs at boot and hourly to prevent orphaned dirs from filling the disk.
 */
async function purgeStaleDirs(maxAgeMs = 2 * 60 * 60 * 1000) {
  const now = Date.now();
  for (const dir of [TEMP_DIR, OUTPUT_DIR]) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        try {
          const fullPath = path.join(dir, entry.name);
          const stat = await fs.stat(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            await fs.rm(fullPath, { recursive: true, force: true });
            console.log(`[cleanup] Purged stale entry: ${fullPath}`);
          }
        } catch { /* skip entries we can't stat */ }
      }
    } catch { /* dir may not exist yet */ }
  }
}

// Boot: ensure dirs + purge stale entries from previous deploys/crashes
ensureDirs().then(() => purgeStaleDirs());

// Hourly purge
setInterval(() => purgeStaleDirs(), 60 * 60 * 1000);

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

/**
 * Probe source resolution and FPS for observability logging.
 * Returns string like "1920x1080 @60fps" or "unknown".
 */
async function probeSourceResolution(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,r_frame_rate',
      '-of', 'csv=p=0',
      filePath,
    ], { timeout: 10_000 });
    const parts = stdout.trim().split(',');
    if (parts.length >= 3) {
      const [w, h, fpsRatio] = parts;
      const fps = fpsRatio.includes('/') ? Math.round(parseInt(fpsRatio.split('/')[0], 10) / parseInt(fpsRatio.split('/')[1], 10)) : fpsRatio;
      return `${w}x${h} @${fps}fps`;
    }
    return stdout.trim() || 'unknown';
  } catch {
    return 'probe-failed';
  }
}

/**
 * Patterns that indicate a clip has been deleted/removed at the source.
 * yt-dlp and direct fetch surface these in stderr or HTTP status.
 */
const CLIP_DELETED_PATTERNS = [
  /this clip is no longer available/i,
  /video unavailable/i,
  /this video has been removed/i,
  /HTTP Error 404/i,
  /ERROR:.*404/i,
  /Unable to download webpage.*404/i,
  /is not available/i,
  /content.*removed/i,
  /clip.*deleted/i,
];

function isClipDeletedError(message) {
  return CLIP_DELETED_PATTERNS.some(pattern => pattern.test(message));
}

async function downloadFromUrl(url, outputPath, fallbackUrl = null) {
  const attempts = [];

  // ── Attempt 1: yt-dlp on primary URL (page URL → resolves best quality) ──
  try {
    console.log(`[download] Trying yt-dlp (best quality) for: ${url}`);
    await execFileAsync('yt-dlp', [
      '-f', 'best[ext=mp4]/best',
      '-o', outputPath,
      '--no-check-certificates',
      '--no-part',
      '--force-overwrites',
      '--quiet',
      '--no-warnings',
      url,
    ], { timeout: 120_000 });

    const stat = await fs.stat(outputPath).catch(() => null);
    if (stat && stat.size > 0) {
      if (await isValidVideoFile(outputPath)) {
        console.log(`[download] yt-dlp success: ${stat.size} bytes, valid MP4`);
        return { method: 'yt-dlp', url };
      }
      console.warn(`[download] yt-dlp produced a ${stat.size} byte file but ffprobe rejected it. Trying fallback…`);
      attempts.push(`yt-dlp: corrupt output (${stat.size} bytes, no moov atom)`);
      await safeUnlink(outputPath);
    } else {
      attempts.push('yt-dlp: empty output');
    }
  } catch (err) {
    const combined = `${err.message || ''} ${err.stderr || ''}`;
    // Detect deleted/removed clips — fail fast, no fallback needed
    if (isClipDeletedError(combined)) {
      console.warn(`[yt-dlp] Clip deleted at source: ${url}`);
      throw new Error(`CLIP_DELETED: This clip has been removed from the platform`);
    }
    console.warn(`[yt-dlp] Failed: ${err.message}`);
    attempts.push(`yt-dlp: ${err.message}`);
    await safeUnlink(outputPath);
  }

  // ── Attempt 2: direct fetch on fallbackUrl (CloudFront signed MP4, 720p) ──
  const fetchUrl = fallbackUrl || url;
  try {
    console.log(`[download] Trying direct fetch for: ${fetchUrl.substring(0, 80)}...`);
    const response = await fetch(fetchUrl, { redirect: 'follow' });
    if (response.status === 404 || response.status === 410) {
      throw new Error(`CLIP_DELETED: This clip has been removed from the platform (HTTP ${response.status})`);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
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
    return { method: 'fetch-fallback', url: fetchUrl };
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

  // Gate: reject if VPS queue is too deep (Next.js handles 503 gracefully)
  const qsBeforeEnqueue = getQueueStatus();
  if (qsBeforeEnqueue.waiting >= 10) {
    return res.status(503).json({
      success: false,
      error: 'queue_full',
      message: `VPS queue full (${qsBeforeEnqueue.waiting} waiting). Try again later.`,
    });
  }

  // Idempotency: reject if this jobId is already running or queued
  const incomingJobId = req.body?.jobId;
  if (incomingJobId) {
    const qs = getQueueStatus();
    if (qs.runningJobIds.includes(incomingJobId) || qs.waitingJobIds.includes(incomingJobId)) {
      return res.status(409).json({
        success: false,
        error: 'duplicate_job',
        message: `Job ${incomingJobId} is already in the VPS queue`,
      });
    }
  }

  // Wrap the ENTIRE pipeline (download + process + render + upload) in the queue
  // so concurrent requests don't OOM Railway with parallel FFmpeg/Whisper.
  const jobIdForQueue = incomingJobId || renderSessionId;
  try {
    const result = await enqueueRender(jobIdForQueue, async () => {

  let clipId = null;
  let tempDir = null;
  const trace = [];
  let lastFlushAt = 0;
  const FLUSH_INTERVAL_MS = 10000; // flush debug_log to DB every 10s
  const timings = {};
  const t = (key) => { timings[key] = Date.now(); };

  const trc = (msg) => {
    const line = `[${((Date.now() - startTime) / 1000).toFixed(2)}s] ${msg}`;
    trace.push(line);
    console.log(`[Render ${renderSessionId}] TRACE: ${line}`);

    // Progressive flush: write trace to DB periodically so debug_log is
    // never NULL during a multi-minute render. Non-blocking, fire-and-forget.
    const now = Date.now();
    if (now - lastFlushAt >= FLUSH_INTERVAL_MS && req.body?.jobId) {
      lastFlushAt = now;
      updateRenderJob(req.body.jobId, { debug_log: trace.join('\n') }).catch(() => {});
    }
  };

  try {
    const {
      jobId,
      clipId: reqClipId,
      videoUrl,
      fallbackUrl,
      source = 'clips',
      userId: reqUserId,
      clipTitle,
      clipDuration,
      wordTimestamps: providedWordTimestamps,
      settings = {},
      variants: requestedVariants,
    } = req.body;

    // Validate variants array (max 4)
    const variants = Array.isArray(requestedVariants)
      ? requestedVariants.filter(v => v && v.id && v.platform).slice(0, 4)
      : [];

    trc(`START source=${source} clipId=${reqClipId} jobId=${jobId || 'none'} variants=${variants.length}`);
    trc(`videoUrl=${videoUrl ? videoUrl.substring(0, 80) + '...' : 'null/undefined'}`);
    trc(`fallbackUrl=${fallbackUrl ? fallbackUrl.substring(0, 60) + '...' : 'none'}`);
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

    // ── Render Diversification ──
    // Derive deterministic variations from jobId to make each render unique
    // (defeats TikTok perceptual hashing). Render-parity: never overrides user settings.
    const div = jobId ? computeDiversify(jobId) : null;
    if (div) {
      trc(`DIVERSIFY: seed=${div.seed} variations=${JSON.stringify(div)}`);
    }

    // ── Initial flush: write trace to DB immediately so debug_log is never NULL ──
    if (jobId) {
      updateRenderJob(jobId, { debug_log: trace.join('\n') }).catch(() => {});
      lastFlushAt = Date.now();
    }

    // ── Build render contract (tracks requested vs applied features) ──
    const contract = createContract(settings);

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
    let probedDuration = 0; // original FFprobe duration — reference for mismatch detection
    let userId = reqUserId || 'trending'; // payload userId or default for trending
    let videoId = null;
    let clipStartTime = 0;
    let clipEndTime = duration;

    // ── DIRECT URL FLOW (trending clips + user-uploaded videos with signed URL) ──
    t('download_start');
    if (videoUrl && videoUrl.startsWith('http')) {
      console.log(`[Render ${renderSessionId}] Downloading trending clip from: ${videoUrl}`);
      const dlResult = await downloadFromUrl(videoUrl, inputPath, fallbackUrl || null);
      trc(`DOWNLOAD method=${dlResult.method} url=${dlResult.url.substring(0, 80)}`);

      // Log source resolution for observability
      const sourceRes = await probeSourceResolution(inputPath);
      trc(`SOURCE resolution=${sourceRes}`);
      console.log(`[Render ${renderSessionId}] Downloaded: ${sourceRes} via ${dlResult.method}`);

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
        probedDuration = duration; // snapshot for mismatch detection at RENDER START

        // Kick HLS playlists (playlist.m3u8) often cover a much longer
        // window than the actual clip (e.g. 3 min playlist for a 30s clip).
        // When the caller provides a trusted clipDuration from the DB,
        // cap the probed duration so we don't render garbage beyond the
        // real clip boundary.
        if (clipDuration > 0 && duration > clipDuration + 2) {
          trc(`DURATION CAP: probed ${duration.toFixed(2)}s exceeds DB clipDuration ${clipDuration}s — capping`);
          duration = Math.max(0.1, clipDuration - 0.05);
        }

        clipEndTime = duration;
      } catch (err) {
        console.warn(`[Render ${renderSessionId}] Could not determine duration via ffprobe`);
      }

      // Log source resolution to diagnose vertical-vs-horizontal issues
      try {
        const probeRes = await execFileAsync('ffprobe', [
          '-v', 'quiet',
          '-select_streams', 'v:0',
          '-show_entries', 'stream=width,height',
          '-of', 'csv=p=0',
          inputPath,
        ]);
        const [srcW, srcH] = probeRes.stdout.trim().split(',').map(Number);
        console.log(`[Render ${renderSessionId}] Source resolution: ${srcW}x${srcH} (${srcW > srcH ? 'horizontal' : 'vertical'})`);
        // Quality gate: warn on low-res sources that will produce visible upscale
        const minDim = Math.min(srcW || 0, srcH || 0);
        if (minDim > 0 && minDim < 720) {
          trc(`LOW_RES_WARNING: source ${srcW}x${srcH} is below 720p — output may show visible upscale artifacts`);
          console.warn(`[Render ${renderSessionId}] LOW QUALITY SOURCE: ${srcW}x${srcH} — render will upscale`);
        }
      } catch { /* non-critical */ }

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
      const clip = await getClip(clipId).catch(() => null);

      if (clip) {
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
        probedDuration = duration;

        // Update clip status to rendering
        await updateClipStatus(clipId, 'rendering');

        // Download source video from Supabase storage
        console.log(`[Render ${renderSessionId}] Downloading source video from storage...`);
        await downloadVideo(video.storage_path, inputPath);
      } else {
        // Fallback: clipId might be a video UUID (user-uploaded videos without a clips row)
        trc('getClip failed — trying videos table fallback');
        const video = await getVideo(clipId);
        if (!video || !video.storage_path) {
          return res.status(404).json({
            success: false,
            error: 'Clip/Video not found',
            message: `Neither clips nor videos table has id ${clipId}`,
          });
        }

        userId = video.user_id || 'upload';
        videoId = video.id;
        // Full video — no sub-clip trimming
        clipStartTime = 0;
        clipEndTime = 0;

        console.log(`[Render ${renderSessionId}] Downloading uploaded video from storage...`);
        await downloadVideo(video.storage_path, inputPath);

        // Probe actual duration
        try {
          const probeStream = await execFileAsync('ffprobe', [
            '-v', 'quiet', '-select_streams', 'v:0',
            '-show_entries', 'stream=duration', '-of', 'csv=p=0',
            inputPath,
          ]);
          const streamDur = parseFloat(probeStream.stdout.trim());
          if (Number.isFinite(streamDur) && streamDur > 0) {
            duration = Math.max(0.1, streamDur - 0.05);
            clipEndTime = duration;
            probedDuration = duration;
            trc(`videos fallback: probed duration=${duration}s`);
          }
        } catch { /* use clipDuration from payload */ }

        if (!duration && clipDuration) {
          duration = clipDuration;
          clipEndTime = duration;
          probedDuration = duration;
        }
      }
    }

    // ── COMMON RENDER PIPELINE ──

    // Determine canvas dimensions (must match FFmpeg render output)
    const targetAspectRatio = settings.format?.aspectRatio || '9:16';
    const captionAnim = settings.captions?.animation || 'highlight';

    // MEMORY PROTECTION: For word-pop animation, reduce to 720p to avoid OOM on Railway
    // Word-pop + blur background + ASS rendering is heavy; reducing resolution by ~50% helps significantly
    const isWordPopAnimation = settings.captions?.enabled && captionAnim === 'word-pop';

    // Always generate ASS subtitles at 1080p — the render tier system handles fallback
    const canvasSizes = { '9:16': { w: 1080, h: 1920 }, '1:1': { w: 1080, h: 1080 }, '16:9': { w: 1920, h: 1080 } };
    const { w: canvasW, h: canvasH } = canvasSizes[targetAspectRatio] || canvasSizes['9:16'];

    // ─── Burned-in caption safety net ───
    // If captions are requested but the source already has burned-in captions,
    // detect and auto-disable to prevent doubling. Runs on trending clips only.
    // The frontend usually handles this, but quick export and edge cases bypass it.
    let burnedCaptionDetected = false;
    let burnedCaptionPosition = null; // 'bottom' | 'top' | 'center' | null
    if (settings.captions?.enabled && settings.captions?.style !== 'none' && source === 'trending') {
      // Skip if frontend already flagged via skippedReason
      if (settings.captions?.skippedReason !== 'source_has_burned_captions') {
        try {
          trc('BURNED CAPTION CHECK starting...');
          const burnedResult = await detectBurnedCaptions(inputPath, duration, tempDir, trc);
          if (burnedResult.burned_captions && burnedResult.confidence >= 0.7) {
            burnedCaptionDetected = true;
            burnedCaptionPosition = burnedResult.position || 'bottom';
            settings.captions.enabled = false;
            settings.captions.style = 'none';
            settings.captions.skippedReason = 'source_has_burned_captions';
            trc(`BURNED CAPTION CHECK: detected (confidence=${burnedResult.confidence.toFixed(2)}, pos=${burnedCaptionPosition}) → captions auto-disabled`);
          } else {
            trc(`BURNED CAPTION CHECK: not detected (confidence=${(burnedResult.confidence || 0).toFixed(2)})`);
          }
        } catch (burnedErr) {
          trc(`BURNED CAPTION CHECK error (non-fatal): ${burnedErr.message}`);
        }
      } else {
        burnedCaptionDetected = true;
        burnedCaptionPosition = settings.captions?.burnedPosition || 'bottom';
        trc('BURNED CAPTION CHECK: already flagged by frontend (skippedReason=source_has_burned_captions)');
      }
    }

    // Anchor crop to preserve burned captions in the source
    if (burnedCaptionDetected && burnedCaptionPosition) {
      const anchor = burnedCaptionPosition === 'top' ? 'top' : 'bottom';
      settings.format = settings.format || {};
      settings.format.cropAnchor = anchor;
      trc(`BURNED CAPTIONS: anchoring crop to ${anchor}, source captions shown in full`);
    }

    t('download_end');

    // ─── PARALLEL ANALYSIS PHASE ───
    // Whisper transcription and visual analysis (layout/crop/face) are independent
    // of each other. Running them in parallel saves ~30s on a typical render.
    let assFilePath = null;
    let captionWordTimestamps = [];
    let wordTimestamps = providedWordTimestamps || [];
    let detectedLanguage = null;
    let whisperFullText = '';
    let reactionLayout = null;
    let duoLayout = null;
    let faceKeyframes = null;

    const captionStyleRequested = settings.captions?.style || 'hormozi';
    const captionsRequested = settings.captions?.enabled && captionStyleRequested !== 'none';
    const voiceoverRequested = settings.voiceover?.enabled !== false;
    const autoCutRequested = settings.autoCut?.enabled === true;
    const needsWordTimestamps = captionsRequested || voiceoverRequested || autoCutRequested;
    const requestedZoom = settings.format?.videoZoom || 'auto';
    const isAutoMode = requestedZoom === 'auto';
    const needsVisualAnalysis = source === 'trending' && (isAutoMode || requestedZoom === 'fullframe' || requestedZoom === 'reaction' || requestedZoom === 'duo');

    // ── Task A: Whisper transcription ──
    const whisperTask = (async () => {
      if (!needsWordTimestamps || wordTimestamps.length > 0) return;
      t('whisper_start');
      try {
        if (source !== 'trending' && videoId) {
          const transcription = await getTranscription(videoId);
          if (transcription?.word_timestamps) {
            wordTimestamps = (transcription.word_timestamps || []).filter(
              w => w.start >= clipStartTime && w.start < clipEndTime
            );
          }
          if (transcription?.language) detectedLanguage = transcription.language;
        }
        if (source === 'trending' && wordTimestamps.length === 0) {
          const hasWhisperKey = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
          const keySource = process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY' : (process.env.OPENAI_KEY ? 'OPENAI_KEY' : 'NONE');
          trc(`WHISPER key present=${hasWhisperKey} source=${keySource}`);
          if (!hasWhisperKey) { trc(`WHISPER SKIPPED - no key`); return; }
          const streamerLang = detectLanguageFromStreamer(clipTitle);
          const whisperLang = streamerLang || undefined;
          trc(`WHISPER language: streamer=${streamerLang || 'auto'}, using=${whisperLang || 'auto-detect'}`);
          trc(`WHISPER calling transcribeWithWhisper...`);
          const whisperResult = await transcribeWithWhisper(inputPath, {
            tempDir, language: whisperLang,
            contextPrompt: clipTitle || '', clipDuration: duration,
          });
          wordTimestamps = whisperResult.words || [];
          detectedLanguage = whisperResult.language || whisperLang || 'en';
          whisperFullText = whisperResult.fullText || '';
          trc(`WHISPER returned ${wordTimestamps.length} word timestamps, lang=${detectedLanguage}`);
          if (wordTimestamps.length > 0) {
            const first = wordTimestamps[0], last = wordTimestamps[wordTimestamps.length - 1];
            trc(`WHISPER first="${first.word}" start=${first.start} end=${first.end}`);
            trc(`WHISPER last="${last.word}" start=${last.start} end=${last.end}`);
            trc(`WHISPER clipDuration=${duration} clipStartTime=${clipStartTime}`);
          }
        }
      } catch (err) {
        trc(`WHISPER ERROR: ${err.message}`);
      }
      t('whisper_end');
    })();

    // ── Task B: Layout Detection → Crop Advisor → Face Tracking (chained) ──
    const analysisTask = (async () => {
      if (!needsVisualAnalysis && settings.smartZoom?.mode !== 'follow') {
        trc(`FACE TRACKING: skipped (smartZoom=${settings.smartZoom?.enabled !== false}, zoom=${requestedZoom})`);
        return;
      }
      t('analysis_start');

      // B1: Layout Detection (reaction + duo)
      if (needsVisualAnalysis) {
        try {
          trc('LAYOUT DETECTION starting...');
          const layoutResult = await detectReactionLayout(inputPath, { timeoutMs: 10000 });
          if (layoutResult.isReactionLayout) {
            reactionLayout = layoutResult;
            trc(`LAYOUT DETECTION: reaction layout detected (confidence=${layoutResult.confidence.toFixed(2)})`);
          } else {
            trc(`LAYOUT DETECTION: not a reaction layout (confidence=${layoutResult.confidence.toFixed(2)})`);
          }
        } catch (layoutErr) {
          const stderr = layoutErr.stderr ? layoutErr.stderr.slice(0, 300) : '';
          trc(`LAYOUT DETECTION error (non-fatal): ${layoutErr.message}${stderr ? ` | stderr: ${stderr}` : ''}`);
        }

        // B1b: Duo Layout Detection (only if not already a reaction layout)
        if (!reactionLayout?.isReactionLayout) {
          try {
            trc('DUO DETECTION starting...');
            const duoResult = await detectDuoLayout(inputPath, { timeoutMs: 12000 });
            if (duoResult.isDuoLayout) {
              duoLayout = duoResult;
              trc(`DUO DETECTION: duo layout detected (confidence=${duoResult.confidence.toFixed(2)}, faceA=${JSON.stringify(duoResult.faceA)}, faceB=${JSON.stringify(duoResult.faceB)})`);
            } else {
              trc(`DUO DETECTION: not a duo layout (confidence=${duoResult.confidence.toFixed(2)})`);
            }
          } catch (duoErr) {
            const duoStderr = duoErr.stderr ? duoErr.stderr.slice(0, 300) : '';
            trc(`DUO DETECTION error (non-fatal): ${duoErr.message}${duoStderr ? ` | stderr: ${duoStderr}` : ''}`);
          }
        }

        // B2: Crop Advisor (needs layout result)
        if (isAutoMode) {
          try {
            trc('CROP ADVISOR starting...');
            const advice = await adviseCrop(inputPath, { reactionLayout, duoLayout, timeoutMs: 12000 });
            settings.format = settings.format || {};
            settings.format.videoZoom = advice.recommended;
            trc(`CROP ADVISOR: ${advice.recommended} (faceScore=${advice.faceScore.toFixed(2)}, reason=${advice.reason})`);
          } catch (cropErr) {
            const cropStderr = cropErr.stderr ? cropErr.stderr.slice(0, 300) : '';
          trc(`CROP ADVISOR error (non-fatal): ${cropErr.message}${cropStderr ? ` | stderr: ${cropStderr}` : ''} — defaulting to fit`);
            settings.format = settings.format || {};
            settings.format.videoZoom = 'fit';
          }
        } else if (requestedZoom === 'fullframe' && reactionLayout?.isReactionLayout) {
          settings.format = settings.format || {};
          settings.format.videoZoom = 'reaction';
          trc(`Auto-switching fullframe → reaction (reaction layout detected)`);
        }
      }

      // B3: Face Tracking (needs resolved zoom from crop advisor)
      const resolvedZoom = settings.format?.videoZoom || 'auto';
      const smartZoomOn = settings.smartZoom?.enabled !== false;
      const wantFollow = settings.smartZoom?.mode === 'follow';
      const autoFollowCandidate = smartZoomOn && (resolvedZoom === 'fullframe' || resolvedZoom === 'fit');

      if (wantFollow || autoFollowCandidate) {
        try {
          trc(`FACE TRACKING starting (reason=${wantFollow ? 'explicit_follow' : 'auto_detect'})...`);
          const faceResult = await detectFaces(inputPath, {
            canvasW: 720, canvasH: 1280, everyN: 10, timeoutMs: 15000,
          });
          const detectedCount = faceResult.detected_count || 0;
          const totalFrames = faceResult.raw_keyframes || 1;
          const detectionRate = detectedCount / totalFrames;

          if (faceResult.smoothed && faceResult.smoothed.length >= 2 && detectionRate >= 0.60) {
            faceKeyframes = faceResult.smoothed;
            settings.smartZoom = settings.smartZoom || {};
            settings.smartZoom.enabled = true;
            settings.smartZoom.mode = 'follow';
            trc(`FACE TRACKING: stable face (${detectedCount}/${totalFrames} = ${Math.round(detectionRate * 100)}%) → auto follow with ${faceKeyframes.length} keyframes`);
          } else if (faceResult.smoothed && faceResult.smoothed.length >= 2 && detectedCount > 0) {
            trc(`FACE TRACKING: intermittent face (${detectedCount}/${totalFrames} = ${Math.round(detectionRate * 100)}%) → keeping micro zoom`);
          } else {
            trc(`FACE TRACKING: no stable face (${detectedCount}/${totalFrames}) → no follow`);
          }
        } catch (faceErr) {
          const faceStderr = faceErr.stderr ? faceErr.stderr.slice(0, 300) : '';
          trc(`FACE TRACKING error (non-fatal): ${faceErr.message}${faceStderr ? ` | stderr: ${faceStderr}` : ''} → micro fallback`);
        }
      } else if (!needsVisualAnalysis) {
        // Already logged above
      } else {
        trc(`FACE TRACKING: skipped (smartZoom=${smartZoomOn}, zoom=${resolvedZoom})`);
      }
      t('analysis_end');
    })();

    // ── Wait for both parallel tasks ──
    await Promise.all([whisperTask, analysisTask]);

    // Detect no-speech clips: Whisper ran but found zero words.
    // This is a content characteristic, not a failure — features that depend
    // on speech (voiceover, auto-cut, captions) should be marked intentional.
    const noSpeechDetected = needsWordTimestamps && wordTimestamps.length === 0 && (source === 'trending' || providedWordTimestamps?.length === 0);
    if (noSpeechDetected) {
      trc('NO SPEECH DETECTED: Whisper returned 0 words — speech-dependent features will be skipped (intentional, not degraded)');
    }

    trc(`WORD TIMESTAMPS: ${wordTimestamps.length} words available for captions/voiceover/autoCut${noSpeechDetected ? ' (no speech)' : ''}`);

    // ─── Captions (ASS subtitle generation) — runs after Whisper completes ───
    t('captions_start');
    if (captionsRequested) {
      try {
        const captionStyle = settings.captions.style || 'hormozi';
        const captionPosition = settings.captions.position || 'bottom';
        let assContent = null;
        // Build diversify overrides for captions (marginV, size, accent color)
        const captionDiversify = div ? {
          captionMarginVPct: div.captionMarginVPct,
          captionSizePct: div.captionSizePct,
          accentColor: getDiversifiedAccentColor(captionStyle, div.captionColorIdx),
        } : null;
        const subtitleOpts = { style: captionStyle, position: captionPosition, canvasWidth: canvasW, canvasHeight: canvasH, diversify: captionDiversify };

        if (wordTimestamps.length > 0) {
          validateWordTimestamps(wordTimestamps);
          captionWordTimestamps = wordTimestamps;
          const captionAnim = settings.captions.animation || 'highlight';
          trc(`CAPTIONS generating ASS file for animation="${captionAnim}" style="${captionStyle}"`);
          assContent = generateASS(wordTimestamps, {
            ...subtitleOpts, animation: captionAnim, clipStartTime,
            wordsPerLine: settings.captions.wordsPerLine || 4,
            customColors: settings.captions.customColors,
            customImportantWords: settings.captions.customImportantWords || [],
            emphasisEffect: settings.captions.emphasisEffect || 'none',
            emphasisColor: settings.captions.emphasisColor || 'red',
          });
          trc(`CAPTIONS ASS generated: ${assContent ? assContent.length : 0} bytes`);
        } else {
          const captionAnim = settings.captions.animation || 'highlight';
          if (clipTitle && duration > 0) {
            trc(`CAPTIONS FALLBACK: static ASS from title "${clipTitle.substring(0, 40)}" animation="${captionAnim}"`);
            assContent = generateStaticASS(clipTitle, duration, {
              ...subtitleOpts, animation: captionAnim,
              wordsPerLine: settings.captions.wordsPerLine || 4,
            });
          } else {
            trc(`CAPTIONS SKIPPED - no word timestamps and no title for fallback`);
          }
        }

        if (assContent) {
          assFilePath = path.join(tempDir, 'captions.ass');
          await fs.writeFile(assFilePath, assContent, 'utf-8');
          trc(`CAPTIONS wrote ASS ${canvasW}x${canvasH} pos=${captionPosition} size=${assContent.length} bytes`);
          const assLines = assContent.split('\n');
          trc(`CAPTIONS ASS header lines (first 5): ${assLines.slice(0, 5).join(' | ')}`);
          const dialogueLines = assLines.filter(l => l.startsWith('Dialogue:'));
          trc(`CAPTIONS ASS dialogue events: ${dialogueLines.length} events (first: ${dialogueLines[0]?.substring(0, 100) || 'none'})`);
          contract.record('captions', true);
        } else {
          contract.record('captions', false, noSpeechDetected ? 'no speech in clip' : 'no word timestamps and no title for fallback', null, noSpeechDetected);
        }
      } catch (err) {
        trc(`CAPTIONS ERROR: ${err.message}`);
        contract.record('captions', false, `error: ${err.message}`);
      }
    } else {
      const captionSkipReason = settings.captions?.skippedReason || 'disabled by user';
      trc(`CAPTIONS disabled (enabled=${settings.captions?.enabled}, style=${captionStyleRequested}, reason=${captionSkipReason})`);
      const isIntentional = captionSkipReason === 'source_has_burned_captions'
        || captionSkipReason === 'disabled by user'
        || burnedCaptionDetected;
      contract.record('captions', false, captionSkipReason, null, isIntentional);
    }
    t('captions_end');

    // Sync wordTimestamps ↔ captionWordTimestamps: both must reflect the latest data.
    // Captions may have set captionWordTimestamps while wordTimestamps came from Whisper.
    // Voiceover, auto-cut, and hook all need word timestamps regardless of captions being on/off.
    if (captionWordTimestamps.length === 0 && wordTimestamps.length > 0) {
      captionWordTimestamps = wordTimestamps;
    }
    if (wordTimestamps.length === 0 && captionWordTimestamps.length > 0) {
      wordTimestamps = captionWordTimestamps;
    }
    trc(`TIMESTAMPS SYNC: wordTimestamps=${wordTimestamps.length}, captionWordTimestamps=${captionWordTimestamps.length}`);

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

    // ─── Smart Hook Trim (pre-processing) ───
    // For trending clips only: use Claude to detect the peak moment from transcript
    // and trim the clip to start 1.5s before peak. Skip if hook reorder is enabled
    // (reorder handles this differently by rearranging segments).
    const hookReorderEnabled = settings.hook?.reorderEnabled && settings.hook?.reorder?.segments?.length >= 2;
    if (source === 'trending' && whisperFullText && !hookReorderEnabled && duration > 10) {
      try {
        const smartStart = await detectSmartHookStart(whisperFullText, duration, trc);
        const remainingAfterTrim = smartStart !== null ? duration - smartStart : duration;
        if (smartStart !== null && smartStart > 2 && remainingAfterTrim >= 8) {
          const oldStart = clipStartTime;
          clipStartTime += smartStart;
          // Cap total duration at 30s
          const maxDur = 30;
          duration = Math.min(duration - smartStart, maxDur);
          clipEndTime = clipStartTime + duration;
          trc(`SMART HOOK: trimmed clip start ${oldStart}→${clipStartTime}s, new duration=${duration}s`);

          // Remap word timestamps to new timeline
          if (captionWordTimestamps.length > 0) {
            captionWordTimestamps = captionWordTimestamps
              .filter(w => w.start >= smartStart && w.start < smartStart + duration)
              .map(w => ({ ...w, start: w.start - smartStart, end: w.end - smartStart }));
            wordTimestamps = captionWordTimestamps; // keep in sync for voiceover/hook
            trc(`SMART HOOK: remapped ${captionWordTimestamps.length} word timestamps`);

            // Regenerate ASS file with trimmed timestamps
            if (assFilePath && captionWordTimestamps.length > 0) {
              const captionStyle = settings.captions?.style || 'hormozi';
              const captionPosition = settings.captions?.position || 'bottom';
              const captionAnim = settings.captions?.animation || 'highlight';
              const trimmedASS = generateASS(captionWordTimestamps, {
                style: captionStyle,
                position: captionPosition,
                canvasWidth: canvasW,
                canvasHeight: canvasH,
                animation: captionAnim,
                clipStartTime: 0,
                wordsPerLine: settings.captions?.wordsPerLine || 4,
                customColors: settings.captions?.customColors,
                customImportantWords: settings.captions?.customImportantWords || [],
                emphasisEffect: settings.captions?.emphasisEffect || 'none',
                emphasisColor: settings.captions?.emphasisColor || 'red',
              });
              if (trimmedASS) {
                await fs.writeFile(assFilePath, trimmedASS, 'utf-8');
                trc(`SMART HOOK: regenerated ASS subtitles (${trimmedASS.length} bytes)`);
              }
            }
          }
        } else if (smartStart !== null && smartStart > 2) {
          trc(`SMART HOOK: would leave only ${remainingAfterTrim.toFixed(1)}s — skipping trim (min 8s)`);
        }
      } catch (hookErr) {
        trc(`SMART HOOK FAILED: ${hookErr.message}`);
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
      const fallbackPeak = detectPeakMoment({ transcript: captionWordTimestamps.map(w => w.word).join(' '), duration, wordTimestamps: captionWordTimestamps, audioPeaks: [] });
      const peakT = fallbackPeak.peakTime > 0 ? fallbackPeak.peakTime : Math.min(duration * 0.6, duration - 2);
      const hookLen = settings.hook?.length ?? 1.5;
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
        wordTimestamps = captionWordTimestamps; // keep in sync for voiceover/hook/auto-cut
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
    t('cut_start');
    // Final sync: ensure both variables reflect latest data from any upstream step
    if (captionWordTimestamps.length === 0 && wordTimestamps.length > 0) captionWordTimestamps = wordTimestamps;
    if (wordTimestamps.length === 0 && captionWordTimestamps.length > 0) wordTimestamps = captionWordTimestamps;
    if (settings.autoCut?.enabled && captionWordTimestamps.length === 0) {
      contract.record('auto_cut', false, noSpeechDetected ? 'no speech in clip' : 'no word timestamps', null, noSpeechDetected);
    }
    if (settings.autoCut?.enabled && captionWordTimestamps.length > 0) {
      try {
        let threshold = settings.autoCut.silenceThreshold;

        // Adaptive threshold: if no explicit threshold, compute from mood + audio intensity
        if (!threshold) {
          const { analyzeAudioPeaks } = await import('../lib/audio-peaks.js');
          const peaks = await analyzeAudioPeaks(inputPath, clipStartTime, duration);
          const intensity = classifyIntensity(peaks, duration);
          const mood = settings.autoCut.mood || null;
          threshold = getAdaptiveThreshold({ mood, intensity });
          trc(`AUTO-CUT: adaptive threshold — mood=${mood || 'none'}, intensity=${intensity}, threshold=${threshold}s`);
        }

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
          wordTimestamps = captionWordTimestamps; // keep in sync for voiceover
          trc(`AUTO-CUT: applied — new duration=${duration}s, new input=${inputPath}`);
          contract.record('auto_cut', true, null, { originalDuration: cutResult.segments[0]?.start !== undefined ? duration : null });

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
        contract.record('auto_cut', false, cutErr.message);
      }
    }


    t('cut_end');

    // ─── AI Voiceover (TTS synthesis) ───
    // Generates commentary MP3 lines via ElevenLabs, timed to silence gaps.
    // Graceful: if ANYTHING fails, render continues without voiceover.
    t('vo_start');
    let voiceoverPaths = null;
    try {
      // Voiceover is gated: the client sends enabled=false when NEXT_PUBLIC_VOICEOVER_ENABLED is off.
      // Also respect the VPS-side env as a kill switch.
      const voiceoverGloballyOff = process.env.VOICEOVER_ENABLED === 'false';
      const voiceoverEnabled = !voiceoverGloballyOff && settings.voiceover?.enabled !== false;
      const hasTranscript = wordTimestamps.length > 0 || captionWordTimestamps.length > 0;
      const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
      const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;
      trc(`VOICEOVER CHECK: enabled=${voiceoverEnabled} words=${wordTimestamps.length} captionWords=${captionWordTimestamps.length} dur=${duration.toFixed(1)}s anthropicKey=${hasAnthropicKey} elevenLabsKey=${hasElevenLabsKey}`);

      if (!voiceoverEnabled) {
        trc('VOICEOVER SKIPPED: reason=disabled_by_user');
        contract.record('voiceover', false, 'disabled by user', null, true);
      } else if (!hasTranscript) {
        trc(`VOICEOVER SKIPPED: reason=no_word_timestamps${noSpeechDetected ? ' (no speech in clip — intentional)' : ''}`);
        contract.record('voiceover', false, noSpeechDetected ? 'no speech in clip' : 'no word timestamps', null, noSpeechDetected);
      } else if (duration <= 5) {
        trc(`VOICEOVER SKIPPED: reason=clip_too_short (${duration.toFixed(1)}s <= 5s)`);
        contract.record('voiceover', false, 'clip too short', null, true);
      } else if (!hasAnthropicKey) {
        trc('VOICEOVER SKIPPED: reason=no_ANTHROPIC_API_KEY — cannot generate script. Set this env var on Railway.');
        contract.record('voiceover', false, 'no ANTHROPIC_API_KEY');
      } else if (!hasElevenLabsKey) {
        trc('VOICEOVER SKIPPED: reason=no_ELEVENLABS_API_KEY — cannot synthesize TTS. Set this env var on Railway.');
        contract.record('voiceover', false, 'no ELEVENLABS_API_KEY');
      } else {
        trc('VOICEOVER: starting script generation + TTS pipeline...');

        // Use the voiceover script from settings if provided (user-edited),
        // otherwise generate via Claude on-the-fly.
        let voLines = settings.voiceover?.lines;
        if (voLines && voLines.length > 0) {
          trc(`VOICEOVER: using ${voLines.length} pre-generated lines from settings`);
        }

        // If no pre-generated lines, generate script via Claude
        if (!voLines || voLines.length === 0) {
          const voWordTimestamps = captionWordTimestamps.length > 0 ? captionWordTimestamps : wordTimestamps;
          trc(`VOICEOVER: no pre-generated lines, calling Claude (${voWordTimestamps.length} words, title="${(clipTitle || '').slice(0, 40)}")...`);
          try {
            const scriptResult = await generateVoiceoverScriptOnVps({
              wordTimestamps: voWordTimestamps,
              clipTitle: clipTitle || '',
              streamerName: settings.tag?.authorHandle || settings.tag?.authorName || '',
              niche: settings.sourcePlatform || 'gaming',
              clipDuration: duration,
              trc,
            });
            if (scriptResult && scriptResult.length > 0) {
              voLines = scriptResult;
              trc(`VOICEOVER: Claude generated ${voLines.length} lines: ${voLines.map(l => `[${l.role}@${l.startTime.toFixed(1)}s] "${l.text}"`).join(' | ')}`);
            } else {
              trc('VOICEOVER: Claude returned null/empty — see VOICEOVER SCRIPT logs above for reason');
            }
          } catch (scriptErr) {
            trc(`VOICEOVER SCRIPT FAILED: ${scriptErr.message}`);
          }
        }

        if (voLines && voLines.length > 0) {
          trc(`VOICEOVER TTS: synthesizing ${voLines.length} lines via ElevenLabs...`);
          const voiceKey = settings.voiceover?.voice || 'default';
          // Diversify: pick from voice pool of same register
          const diversifiedVoiceId = div ? pickVoice(voiceKey, div.voiceIdx) : null;
          if (diversifiedVoiceId) trc(`DIVERSIFY VOICE: register=${voiceKey} idx=${div.voiceIdx} id=${diversifiedVoiceId}`);
          voiceoverPaths = await synthesizeVoiceover(voLines, tempDir, voiceKey, userId, diversifiedVoiceId);
          if (voiceoverPaths.length > 0) {
            trc(`VOICEOVER TTS: ${voiceoverPaths.length}/${voLines.length} MP3s created — will mix into render`);
            contract.record('voiceover', true);
            resetVoiceoverFailures();
            resetFeatureStreak('voiceover');
          } else {
            trc(`VOICEOVER TTS: all ${voLines.length} lines failed synthesis — ELEVENLABS_API_KEY may be invalid or rate-limited`);
          }
        } else {
          trc('VOICEOVER SKIPPED: reason=no_lines_generated (Claude could not produce a script)');
          contract.record('voiceover', false, 'no lines generated');
          trackVoiceoverFailure(trc);
          trackFeatureFailure('voiceover', 'no lines generated').catch(() => {});
        }
      }
    } catch (voErr) {
      trc(`VOICEOVER FAILED (non-fatal): ${voErr.message}`);
      contract.record('voiceover', false, voErr.message);
      voiceoverPaths = null;
    }

    t('vo_end');

    // Render clip with FFmpeg (entire pipeline is already serialized by the outer enqueueRender)
    t('encode_start');
    const outputPath = path.join(tempDir, 'output.mp4');
    // Record remaining contract features before render
    contract.record('audio_shift', true); // always-on
    contract.record('loudnorm', true); // always-on
    contract.record('metadata_scrub', true); // always-on
    contract.record('audio_enhance', settings.audioEnhance?.enabled || false);
    contract.record('smart_zoom', settings.smartZoom?.enabled !== false, null, { mode: settings.smartZoom?.mode || 'micro' });
    contract.record('crop_mode', true, null, { applied_mode: settings.format?.videoZoom || 'auto' });
    // Hook text: recorded based on whether the hook text overlay will actually be in the render
    const hookHasText = settings.hook?.enabled && settings.hook?.textEnabled !== false && settings.hook?.text;
    const hookIntentionalSkip = !hookHasText && (noSpeechDetected || !settings.hook?.enabled);
    contract.record('hook_text', !!hookHasText, hookHasText ? null : (noSpeechDetected ? 'no speech in clip' : 'no hook text available'), null, hookIntentionalSkip);

    // ── Duration mismatch guardrail ──
    // If duration drifted >20% from the probed original (outside legitimate auto-cut),
    // something upstream clobbered it. Log loudly so we catch regressions instantly.
    if (probedDuration > 0 && duration > 0) {
      const drift = Math.abs(duration - probedDuration) / probedDuration;
      if (drift > 0.20) {
        trc(`DURATION MISMATCH: probed=${probedDuration.toFixed(2)}s → current=${duration.toFixed(2)}s (${(drift * 100).toFixed(0)}% drift) — possible pipeline bug`);
      }
    }

    // ── Diversify: Entry Trim ──
    // Shift clip start by 0-1.2s to break duplicate hashing.
    // Skip if hook reorder is active (it rearranges the clip) or clip would be < 5s.
    const hookReorderWasApplied = settings.hook?.reorderEnabled && settings.hook?.reorder?.segments?.length >= 2;
    if (div && div.entryTrimS > 0 && !hookReorderWasApplied && duration - div.entryTrimS >= 5) {
      const trim = div.entryTrimS;
      clipStartTime += trim;
      duration -= trim;
      clipEndTime = clipStartTime + duration;
      // Remap word timestamps
      if (captionWordTimestamps.length > 0) {
        captionWordTimestamps = captionWordTimestamps
          .map(w => ({ ...w, start: (w.start || 0) - trim, end: (w.end || 0) - trim }))
          .filter(w => w.start >= -0.1); // keep words that overlap the new start
        captionWordTimestamps.forEach(w => { if (w.start < 0) w.start = 0; });
        wordTimestamps = captionWordTimestamps;
      }
      if (voiceoverPaths && voiceoverPaths.length > 0) {
        voiceoverPaths = voiceoverPaths
          .map(vo => ({ ...vo, startTime: vo.startTime - trim }))
          .filter(vo => vo.startTime >= -0.5);
        voiceoverPaths.forEach(vo => { if (vo.startTime < 0) vo.startTime = 0; });
      }
      // Regenerate ASS with remapped timestamps
      if (assFilePath && captionWordTimestamps.length > 0) {
        try {
          const captionStyle = settings.captions?.style || 'hormozi';
          const captionPosition = settings.captions?.position || 'bottom';
          const captionAnim = settings.captions?.animation || 'highlight';
          const accentColor = div ? getDiversifiedAccentColor(captionStyle, div.captionColorIdx) : null;
          const trimASS = generateASS(captionWordTimestamps, {
            style: captionStyle, position: captionPosition,
            canvasWidth: canvasW, canvasHeight: canvasH,
            animation: captionAnim, clipStartTime: 0,
            wordsPerLine: settings.captions?.wordsPerLine || 4,
            customColors: settings.captions?.customColors,
            customImportantWords: settings.captions?.customImportantWords || [],
            emphasisEffect: settings.captions?.emphasisEffect || 'none',
            emphasisColor: settings.captions?.emphasisColor || 'red',
            diversify: div ? {
              captionMarginVPct: div.captionMarginVPct,
              captionSizePct: div.captionSizePct,
              accentColor,
            } : null,
          });
          if (trimASS) await fs.writeFile(assFilePath, trimASS, 'utf-8');
        } catch { /* keep existing ASS */ }
      }
      trc(`DIVERSIFY ENTRY TRIM: shifted start +${trim}s → new duration=${duration.toFixed(2)}s, remapped ${captionWordTimestamps.length} words`);
    } else if (div && div.entryTrimS > 0) {
      trc(`DIVERSIFY ENTRY TRIM: skipped (hookReorder=${hookReorderWasApplied}, resultDuration=${(duration - div.entryTrimS).toFixed(1)}s)`);
    }

    // ── Diversify Summary ──
    if (div) {
      trc(`DIVERSIFY SUMMARY: seed=${div.seed} audioShift=+${div.audioShiftPct}% entryTrim=${div.entryTrimS}s captionPos=${div.captionMarginVPct}% captionSize=${div.captionSizePct}% colorIdx=${div.captionColorIdx} voiceIdx=${div.voiceIdx} hookPos=${div.hookPosPct}% hookSize=${div.hookSizePct}% hookDelay=${div.hookDelayS}s zoomAmp=${div.zoomAmpMult}x zoomPhase=${div.zoomPhase} grain=${div.grainStrength} borderCrop=${div.borderCropPx}px hue=${div.hueDeg}deg sat=${div.saturation} bright=${div.brightness} crf=${div.crfVariant} fps=${div.fpsVariant}`);
    }

    trc(`AUDIO SHIFT: +${div?.audioShiftPct ?? 3}% asetrate/atempo anti-fingerprint will be applied (always-on)`);
    trc(`RENDER START: duration=${duration.toFixed(2)}s probed=${probedDuration.toFixed(2)}s voiceover=${voiceoverPaths ? voiceoverPaths.length + ' MP3s' : 'none'} smartZoom=${settings.smartZoom?.mode || 'micro'} videoZoom=${settings.format?.videoZoom || 'auto'}`);
    console.log(`[Render ${renderSessionId}] Starting FFmpeg render...`);

    // Use plan from Next.js payload (source of truth); fall back to DB lookup
    const userPlan = req.body.plan || (
      (userId && userId !== 'trending')
        ? ((await getUserProfile(userId))?.plan || 'free')
        : 'free'
    );
    // Watermark: free plan = Viral Animal logo, pro/studio = none (paid advantage).
    // Studio users with custom brand logo could pass logoPath in future.
    const watermarkAsset = path.resolve(import.meta.dirname || '.', '../assets/watermark.png');
    const watermarkConfig = userPlan === 'free' && (await import('fs')).existsSync(watermarkAsset)
      ? { enabled: true, logoPath: watermarkAsset, type: 'viral-animal' }
      : null;

    const renderResult = await renderClip(inputPath, outputPath, {
      startTime: clipStartTime,
      endTime: clipStartTime + duration,
      duration: duration,
      aspectRatio: settings.format?.aspectRatio || '9:16',
      captions: assFilePath
        ? { assFilePath, ...settings.captions }
        : null,
      watermark: watermarkConfig,
      plan: userPlan,
      tag: tagConfig,
      cropAnchor: settings.format?.cropAnchor || 'center',
      backgroundBlur: settings.format?.backgroundBlur !== false,
      videoZoom: settings.format?.videoZoom || 'auto',
      smartZoom: settings.smartZoom?.enabled ? {
        enabled: true,
        mode: settings.smartZoom.mode || 'micro',
        faceKeyframes: faceKeyframes,
      } : null,
      hook: settings.hook?.enabled ? {
        enabled: true,
        textEnabled: settings.hook.textEnabled !== false,
        text: settings.hook.text || '',
        style: settings.hook.style || 'shock',
        textPosition: settings.hook.textPosition || 15,
        length: (settings.hook.length ?? 0),
        overlayPng: settings.hook.overlayPng || null,
        overlayCapsuleW: settings.hook.overlayCapsuleW || null,
        overlayCapsuleH: settings.hook.overlayCapsuleH || null,
      } : null,
      audioEnhance: settings.audioEnhance?.enabled || false,
      voiceoverPaths: voiceoverPaths && voiceoverPaths.length > 0 ? voiceoverPaths : null,
      reactionLayout: reactionLayout && reactionLayout.isReactionLayout ? reactionLayout : null,
      duoLayout: duoLayout && duoLayout.isDuoLayout ? duoLayout : null,
      diversify: div ? {
        audioShiftPct: div.audioShiftPct,
        zoomAmpMult: div.zoomAmpMult,
        zoomPhase: div.zoomPhase,
        grainStrength: div.grainStrength,
        hookDelayS: div.hookDelayS,
        hookPosPct: div.hookPosPct,
        hookSizePct: div.hookSizePct,
      } : null,
    });

    const qualityTier = renderResult?.qualityTier || null;
    if (renderResult?.openingLuma !== undefined) {
      trc(`BRIGHT_FIRST_FRAME: openingLuma=${renderResult.openingLuma !== null ? renderResult.openingLuma.toFixed(1) : 'N/A'}, dark=${renderResult.openingDark} (threshold=${16}), action=${renderResult.openingDark ? 'exposure_lift_0.5s' : 'none'}`);
    }
    // Log output file size (visible in debug_log for monitoring)
    trc(`OUTPUT: ${renderResult.outputSizeMB ?? '?'}MB, ${renderResult.outputBitrateMbps ?? '?'}Mbps${renderResult.reEncoded ? ' (re-encoded to fit size limit)' : ''}`);

    t('encode_end');

    // Upload rendered clip to Supabase Storage (unique path per render to avoid CDN cache)
    t('upload_start');
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

    // ── Derive platform variants (lightweight second pass) ──
    const variantResults = [];
    if (variants.length > 0 && jobId) {
      trc(`VARIANTS: deriving ${variants.length} platform variants from base render`);
      t('variants_start');
      try {
        const derived = await deriveAllVariants(outputPath, tempDir, jobId, variants);

        for (const v of derived) {
          const variantStoragePath = source === 'trending'
            ? `trending/${clipId}_${v.variantKey}_${renderTs}.mp4`
            : `${userId}/${clipId}_${v.variantKey}_${renderTs}.mp4`;
          try {
            const vUpload = await uploadClip(v.localPath, variantStoragePath);
            variantResults.push({
              id: v.variantKey,
              platform: v.platform,
              accountId: v.accountId,
              storage_path: variantStoragePath,
              seed: v.div.seed,
              diversify_params: v.div,
            });
            trc(`VARIANT ${v.variantKey} uploaded → ${variantStoragePath} (${v.div.audioShiftPct}% shift, crf=${v.div.crfVariant})`);
          } catch (uploadErr) {
            console.error(`[variant] Upload failed for ${v.variantKey}:`, uploadErr.message);
          }
        }

        // Insert variants into DB
        if (variantResults.length > 0) {
          const rows = variantResults.map(v => ({
            render_job_id: jobId,
            variant_key: v.id,
            platform: v.platform,
            account_id: v.accountId || null,
            storage_path: v.storage_path,
            seed: v.seed,
            diversify_params: v.diversify_params,
          }));
          await supabase.from('render_variants').upsert(rows, { onConflict: 'render_job_id,variant_key' });
          trc(`VARIANTS: ${variantResults.length}/${variants.length} stored in DB`);
        }
      } catch (err) {
        // Variant failure is non-fatal — base render is already uploaded
        console.error(`[variant] Derivation error:`, err.message);
        trc(`VARIANTS ERROR: ${err.message} (base render unaffected)`);
      }
      t('variants_end');
    }

    t('upload_end');

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    console.log(`[Render ${renderSessionId}] Render completed in ${elapsedSeconds.toFixed(1)}s`);

    // ── Evaluate render contract ──
    const contractResult = contract.evaluate();
    const finalStatus = contractResult.isDegraded ? 'degraded' : 'done';

    if (contractResult.isDegraded) {
      trc(`CONTRACT DEGRADED: missing critical features: ${contractResult.missing.join(', ')} — ${contractResult.summary}`);
      for (const feat of contractResult.missing) {
        const entry = contract.toJSON().find(e => e.feature === feat);
        trackFeatureFailure(feat, entry?.reason || 'unknown').catch(() => {});
      }
    } else {
      trc(`CONTRACT OK: all requested features applied`);
      for (const entry of contract.toJSON()) {
        if (entry.applied) resetFeatureStreak(entry.feature);
      }
    }

    // ── Per-stage timing breakdown ──
    const dur = (a, b) => timings[b] && timings[a] ? Math.round((timings[b] - timings[a]) / 1000) : 0;
    trc(`TIMING: download=${dur('download_start','download_end')}s whisper=${dur('whisper_start','whisper_end')}s analysis=${dur('analysis_start','analysis_end')}s captions=${dur('captions_start','captions_end')}s cut=${dur('cut_start','cut_end')}s vo=${dur('vo_start','vo_end')}s encode=${dur('encode_start','encode_end')}s upload=${dur('upload_start','upload_end')}s total=${elapsedSeconds.toFixed(0)}s`);

    trc(`DONE elapsed=${elapsedSeconds.toFixed(1)}s status=${finalStatus} captions=${assFilePath ? 'ASS' : 'none'} tag=${tagConfig?.style || 'none'} quality_tier=${qualityTier || 'unknown'}`);

    // Mark render job as done or degraded (with contract + transform score)
    const transformScore = contract.transformScore();
    trc(`TRANSFORM SCORE: ${transformScore}/3 (hook=${contract.toJSON().find(e => e.feature === 'hook_text')?.applied ? 1 : 0} captions=${contract.toJSON().find(e => e.feature === 'captions')?.applied ? 1 : 0} zoom=${contract.toJSON().find(e => e.feature === 'smart_zoom')?.applied ? 1 : 0})`);
    await updateRenderJob(req.body.jobId, {
      status: finalStatus,
      storage_path: clipStoragePath,
      clip_url: uploadResult.url,
      debug_log: trace.join('\n'),
      quality_tier: qualityTier,
      contract: contract.toJSON(),
      transform_score: transformScore,
    });

    // Send HMAC-signed webhook callback to Next.js (queue management + export tracking)
    // Include wordCount from Whisper for candidate check calibration (truth loop)
    sendWebhookCallback(req.body.jobId, finalStatus, clipStoragePath, null, {
      wordCount: wordTimestamps ? wordTimestamps.length : 0,
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        clipId,
        source,
        storagePath: clipStoragePath,
        clipUrl: uploadResult.url,
        duration,
        thumbnailPath,
        variants: variantResults.length > 0 ? variantResults.map(v => ({
          id: v.id,
          platform: v.platform,
          storage_path: v.storage_path,
        })) : undefined,
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

    // Send HMAC-signed webhook callback to Next.js (queue management + retry logic)
    sendWebhookCallback(req.body?.jobId, 'error', null, errorMsg.substring(0, 2000)).catch(() => {});

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
    // ── Safety net: guarantee the job reaches a terminal status ──
    // If the process crashed, OOM'd, or an unhandled error slipped through,
    // this ensures the job is never left as a zombie in 'rendering' state.
    if (req.body?.jobId) {
      try {
        const { data: jobCheck } = await supabase
          .from('render_jobs')
          .select('status')
          .eq('id', req.body.jobId)
          .single();
        if (jobCheck && !['done', 'degraded', 'error', 'failed', 'canceled', 'expired'].includes(jobCheck.status)) {
          console.error(`[Render ${renderSessionId}] SAFETY NET: job ${req.body.jobId} still in "${jobCheck.status}" after pipeline — forcing error`);
          trace.push(`[SAFETY NET] Job stuck in "${jobCheck.status}" — forced to error`);
          await updateRenderJob(req.body.jobId, {
            status: 'error',
            error_message: 'Render pipeline exited without setting terminal status (possible OOM or crash)',
            debug_log: trace.join('\n'),
          });
          sendWebhookCallback(req.body.jobId, 'error', null, 'Pipeline crash — safety net activated').catch(() => {});
        }
      } catch (safetyErr) {
        console.error(`[Render ${renderSessionId}] Safety net DB check failed:`, safetyErr.message);
      }
    }

    // Cleanup temp files
    if (tempDir) {
      try {
        console.log(`[Render ${renderSessionId}] Cleaning up temp directory...`);
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[Render ${renderSessionId}] Warning: Failed to cleanup temp dir:`, err.message);
      }
    }

    // Final flush of trace to debug_log (in case last flush was >10s ago)
    if (req.body?.jobId && trace.length > 0) {
      updateRenderJob(req.body.jobId, { debug_log: trace.join('\n') }).catch(() => {});
    }
  }

    }); // end enqueueRender callback
    // enqueueRender resolved — response already sent inside the callback
  } catch (queueErr) {
    // enqueueRender rejected (queue full or internal error)
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: queueErr?.message || 'Queue error',
        message: 'Render queue error',
      });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/render/preview — Quick 5s low-res FFmpeg preview
// Same pipeline as full render but: 5s max, 480p, no upload, returns base64 mp4
// ─────────────────────────────────────────────────────────────────────────────

router.post('/preview', async (req, res) => {
  const startTime = Date.now();
  const renderSessionId = uuidv4();
  let tempDir = null;

  try {
    const {
      videoUrl,
      source = 'trending',
      clipTitle,
      clipDuration,
      wordTimestamps: providedWordTimestamps,
      settings = {},
    } = req.body;

    console.log(`[Preview ${renderSessionId}] Starting preview render`);

    if (!videoUrl) {
      return res.status(400).json({ success: false, error: 'Missing videoUrl' });
    }

    // Check FFmpeg
    const ffmpegStatus = await checkFfmpegAvailability();
    if (!ffmpegStatus.ffmpeg) {
      return res.status(503).json({ success: false, error: 'FFmpeg not available' });
    }

    // Create temp dir
    tempDir = path.join(TEMP_DIR, `preview_${renderSessionId}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Download source video
    const inputPath = path.join(tempDir, 'input.mp4');
    await downloadFromUrl(videoUrl, inputPath);

    // Probe real duration
    let duration = clipDuration || 0;
    try {
      const probe = await execFileAsync('ffprobe', [
        '-v', 'quiet', '-select_streams', 'v:0',
        '-show_entries', 'stream=duration',
        '-of', 'csv=p=0', inputPath,
      ], { timeout: 10_000 });
      const probed = parseFloat(probe.stdout.trim());
      if (Number.isFinite(probed) && probed > 0) duration = probed;
    } catch {}

    // ── PREVIEW LIMITS: max 5 seconds ──
    const previewDuration = Math.min(duration, 5);

    // Canvas size — 480p for speed
    const aspectRatio = settings.format?.aspectRatio || '9:16';
    let canvasW, canvasH;
    if (aspectRatio === '9:16') { canvasW = 480; canvasH = 854; }
    else if (aspectRatio === '1:1') { canvasW = 480; canvasH = 480; }
    else { canvasW = 854; canvasH = 480; }

    // Prepare captions (ASS) — use provided timestamps only, no Whisper
    let assFilePath = null;

    if (settings.captions?.enabled && settings.captions?.style !== 'none') {
      try {
        const wordTimestamps = providedWordTimestamps || [];
        const captionStyle = settings.captions.style || 'hormozi';
        const captionPosition = settings.captions.position || 'bottom';
        const captionAnim = settings.captions.animation || 'highlight';

        const subtitleOpts = {
          style: captionStyle,
          position: captionPosition,
          canvasWidth: canvasW,
          canvasHeight: canvasH,
        };

        let assContent = null;
        if (wordTimestamps.length > 0) {
          validateWordTimestamps(wordTimestamps);
          assContent = generateASS(wordTimestamps, {
            ...subtitleOpts,
            animation: captionAnim,
            clipStartTime: 0,
            wordsPerLine: settings.captions.wordsPerLine || 4,
            customColors: settings.captions.customColors,
            customImportantWords: settings.captions.customImportantWords || [],
            emphasisEffect: settings.captions.emphasisEffect || 'none',
            emphasisColor: settings.captions.emphasisColor || 'red',
          });
        } else if (clipTitle && previewDuration > 0) {
          assContent = generateStaticASS(clipTitle, previewDuration, {
            ...subtitleOpts,
            animation: captionAnim,
            wordsPerLine: settings.captions.wordsPerLine || 4,
          });
        }

        if (assContent) {
          assFilePath = path.join(tempDir, 'captions.ass');
          await fs.writeFile(assFilePath, assContent, 'utf-8');
        }
      } catch (err) {
        console.warn(`[Preview ${renderSessionId}] Captions error:`, err.message);
      }
    }

    // Prepare tag overlay — align shape with buildTagFilter (expects authorName/authorHandle)
    let tagConfig = null;
    if (settings.tag?.style && settings.tag.style !== 'none') {
      tagConfig = {
        style: settings.tag.style,
        size: settings.tag.size || 100,
        authorName: settings.tag.authorName || settings.tag.text || null,
        authorHandle: settings.tag.authorHandle || null,
      };
    }

    // ── RENDER (low-res, fast) ──
    const outputPath = path.join(tempDir, 'preview.mp4');

    await renderClip(inputPath, outputPath, {
      startTime: 0,
      endTime: previewDuration,
      duration: previewDuration,
      aspectRatio,
      captions: assFilePath ? { assFilePath, ...settings.captions } : null,
      watermark: null,
      plan: 'pro',
      tag: tagConfig,
      cropAnchor: settings.format?.cropAnchor || 'center',
      backgroundBlur: settings.format?.backgroundBlur || false,
      videoZoom: settings.format?.videoZoom || 'auto',
      crf: 30, // Lower quality for speed
      smartZoom: null, // Skip smart zoom for preview
      hook: settings.hook?.enabled ? {
        enabled: true,
        textEnabled: settings.hook.textEnabled !== false,
        text: settings.hook.text || '',
        style: settings.hook.style || 'shock',
        textPosition: settings.hook.textPosition || 15,
        length: Math.min((settings.hook.length ?? 0), previewDuration),
        overlayPng: settings.hook.overlayPng || null,
        overlayCapsuleW: settings.hook.overlayCapsuleW || null,
        overlayCapsuleH: settings.hook.overlayCapsuleH || null,
      } : null,
      audioEnhance: false, // Skip audio enhance for speed
      // Override resolution for preview
      previewMode: true,
      previewWidth: canvasW,
      previewHeight: canvasH,
    });

    // Read rendered file and return as base64
    const videoBuffer = await fs.readFile(outputPath);
    const base64Video = videoBuffer.toString('base64');
    const elapsedSeconds = (Date.now() - startTime) / 1000;

    console.log(`[Preview ${renderSessionId}] Done in ${elapsedSeconds.toFixed(1)}s (${(videoBuffer.length / 1024).toFixed(0)}KB)`);

    res.json({
      success: true,
      data: {
        video: base64Video,
        mimeType: 'video/mp4',
        duration: previewDuration,
        resolution: `${canvasW}x${canvasH}`,
        renderTime: elapsedSeconds,
      },
    });
  } catch (err) {
    console.error(`[Preview ${renderSessionId}] Error:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  } finally {
    if (tempDir) {
      fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
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

    // 2. Generate 3 hook text variants (Claude API — content-aware)
    const hooks = await generateHookTexts({
      transcript,
      streamerName,
      niche,
      title,
      peakTranscript: peak.peakTranscript || '',
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
        hooks: hooks || [], // null = no content-aware hook possible
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /detect-captions — Detect burned-in captions in a video
// Downloads the video, extracts frames, calls Haiku vision.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/detect-captions', async (req, res) => {
  const { videoUrl, duration } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ data: null, error: 'videoUrl is required' });
  }

  const tempDir = path.join('/tmp', `caption-detect-${uuidv4()}`);
  try {
    await fs.mkdir(tempDir, { recursive: true });

    // Download the video (reuse yt-dlp for platform URLs, or direct fetch)
    let inputPath;
    const isDirectUrl = videoUrl.startsWith('http') && (videoUrl.includes('.mp4') || videoUrl.includes('storage'));
    if (isDirectUrl) {
      inputPath = path.join(tempDir, 'input.mp4');
      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) throw new Error(`Failed to download video: ${videoRes.status}`);
      const buf = Buffer.from(await videoRes.arrayBuffer());
      await fs.writeFile(inputPath, buf);
    } else {
      // Use yt-dlp for Twitch/Kick/etc URLs
      const { downloadWithYtDlp } = await import('../lib/yt-dlp-wrapper.js');
      const dlResult = await downloadWithYtDlp(videoUrl, tempDir);
      inputPath = dlResult.filePath;
    }

    // Probe duration if not provided
    let videoDuration = duration;
    if (!videoDuration) {
      try {
        const { stdout } = await execFileAsync('ffprobe', [
          '-v', 'quiet', '-print_format', 'json', '-show_format', inputPath,
        ], { timeout: 10_000 });
        const info = JSON.parse(stdout);
        videoDuration = parseFloat(info.format?.duration) || 30;
      } catch {
        videoDuration = 30;
      }
    }

    const result = await detectBurnedCaptions(inputPath, videoDuration, tempDir, console.log);

    res.json({ data: result, error: null });
  } catch (err) {
    console.error('[DetectCaptions] Error:', err.message);
    res.json({ data: { burned_captions: false, position: null, confidence: 0 }, error: null });
  } finally {
    // Cleanup temp dir
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;
