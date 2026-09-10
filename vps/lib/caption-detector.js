/**
 * Burned-in Caption Detector
 *
 * Extracts 3 frames from a video (25%, 50%, 75% of duration), crops the bottom
 * third and center third, then sends them to Claude Haiku (vision) to detect
 * whether the video already has burned-in subtitles/captions.
 *
 * Runs AFTER Whisper — uses word timestamps to cross-validate and reject
 * false positives (Twitch chat, overlays, HUD elements).
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { supabase } from './supabase-client.js';

const execFileAsync = promisify(execFile);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 1;

/**
 * Detect burned-in captions in a video file.
 *
 * @param {string} videoPath - Path to the input video file
 * @param {number} duration  - Video duration in seconds
 * @param {string} [tempDir] - Temporary directory for frame extraction
 * @param {Function} [trc]   - Optional trace/log function
 * @param {object} [opts]    - Extra options
 * @param {Array} [opts.wordTimestamps] - Whisper word timestamps for cross-validation
 * @param {string} [opts.platform] - 'twitch' | 'kick' | etc. for stricter thresholds
 * @returns {Promise<{burned_captions: boolean, position: string|null, confidence: number, crossValidated?: boolean}>}
 */
export async function detectBurnedCaptions(videoPath, duration, tempDir, trc = () => {}, opts = {}) {
  const fallback = { burned_captions: false, position: null, confidence: 0 };

  if (!ANTHROPIC_API_KEY) {
    trc('[CaptionDetect] No ANTHROPIC_API_KEY — skipping detection');
    return fallback;
  }

  if (!duration || duration < 2) {
    trc('[CaptionDetect] Duration too short — skipping');
    return fallback;
  }

  const wordTimestamps = opts.wordTimestamps ?? [];
  const platform = opts.platform ?? '';
  const isTwitchKick = /twitch|kick/i.test(platform);
  const confThreshold = isTwitchKick ? 0.98 : 0.7;

  // (a) If Whisper returned 0 words → no speech → can't have speech subtitles
  if (wordTimestamps.length === 0) {
    trc('[CaptionDetect] Whisper returned 0 words — burned=false by definition (no speech = no subtitles)');
    return fallback;
  }

  const workDir = tempDir || path.dirname(videoPath);

  try {
    // Extract 3 frames at 25%, 50%, 75% of duration
    const timestamps = [0.25, 0.50, 0.75].map(pct => Math.max(0.5, duration * pct));

    trc(`[CaptionDetect] Extracting 3 frames at ${timestamps.map(t => t.toFixed(1) + 's').join(', ')}`);

    await Promise.all(timestamps.map(async (ts, i) => {

      // Extract frame, crop bottom third + resize to 480px wide, low quality JPEG
      // vf: crop bottom 1/3 of the frame (in_h/3 tall, starting at 2*in_h/3)
      // Then also extract center 1/3 as a second frame
      const bottomPath = path.join(workDir, `caption_detect_bottom_${i}.jpg`);
      const centerPath = path.join(workDir, `caption_detect_center_${i}.jpg`);

      // Bottom third
      await execFileAsync('ffmpeg', [
        '-ss', String(ts),
        '-i', videoPath,
        '-vframes', '1',
        '-vf', 'crop=in_w:in_h/3:0:2*in_h/3,scale=480:-1',
        '-q:v', '8',
        '-y', bottomPath,
      ], { timeout: 10_000 }).catch(() => {});

      // Center third
      await execFileAsync('ffmpeg', [
        '-ss', String(ts),
        '-i', videoPath,
        '-vframes', '1',
        '-vf', 'crop=in_w:in_h/3:0:in_h/3,scale=480:-1',
        '-q:v', '8',
        '-y', centerPath,
      ], { timeout: 10_000 }).catch(() => {});
    }));

    // Collect all successfully extracted frames as base64
    const imageContents = [];
    for (let i = 0; i < 3; i++) {
      for (const region of ['bottom', 'center']) {
        const framePath = path.join(workDir, `caption_detect_${region}_${i}.jpg`);
        try {
          const buf = await fs.readFile(framePath);
          if (buf.length > 100) { // sanity check — not an empty/corrupt file
            imageContents.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: buf.toString('base64'),
              },
            });
          }
        } catch {
          // Frame extraction might have failed for this timestamp — skip
        }
      }
    }

    // Cleanup frame files (fire-and-forget)
    for (let i = 0; i < 3; i++) {
      for (const region of ['bottom', 'center']) {
        fs.unlink(path.join(workDir, `caption_detect_${region}_${i}.jpg`)).catch(() => {});
      }
    }

    if (imageContents.length === 0) {
      trc('[CaptionDetect] No frames extracted — returning false');
      return fallback;
    }

    trc(`[CaptionDetect] Sending ${imageContents.length} cropped frames to Haiku vision`);

    // Call Claude Haiku with vision
    const result = await callHaikuVision(imageContents, trc);
    trc(`[CaptionDetect] Raw result: burned=${result.burned_captions}, pos=${result.position}, conf=${result.confidence}`);

    // Apply confidence threshold (stricter for Twitch/Kick)
    if (result.confidence < confThreshold) {
      trc(`[CaptionDetect] Confidence ${result.confidence.toFixed(2)} < threshold ${confThreshold} → burned=false`);
      return fallback;
    }

    // (b) Cross-validate: compare visible_text from each frame against Whisper words
    // burned=true only if >= 2/3 frames have >= 50% word overlap with speech
    if (result.burned_captions && result.visible_text && wordTimestamps.length > 0) {
      const timestamps = [0.25, 0.50, 0.75].map(pct => Math.max(0.5, duration * pct));
      let matchCount = 0;

      for (let i = 0; i < Math.min(3, result.visible_text.length); i++) {
        const frameText = (result.visible_text[i] || '').toLowerCase();
        if (!frameText || frameText.length < 3) continue;

        const frameTs = timestamps[i] || 0;
        // Get Whisper words within ±2s window
        const windowWords = wordTimestamps
          .filter(w => Math.abs((w.start || 0) - frameTs) <= 2)
          .map(w => (w.word || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
          .filter(w => w.length >= 2);

        if (windowWords.length === 0) continue;

        // Count how many Whisper words appear in the visible text
        const frameWords = frameText.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length >= 2);
        const overlapCount = frameWords.filter(fw => windowWords.some(ww => ww.includes(fw) || fw.includes(ww))).length;
        const overlapRatio = frameWords.length > 0 ? overlapCount / frameWords.length : 0;

        if (overlapRatio >= 0.5) matchCount++;
      }

      result.crossValidated = matchCount >= 2;
      if (!result.crossValidated) {
        trc(`[CaptionDetect] Cross-validation FAILED: only ${matchCount}/3 frames match speech → text overlay, not captions`);
        return { ...fallback, crossValidated: false };
      }
      trc(`[CaptionDetect] Cross-validation PASSED: ${matchCount}/3 frames match Whisper words`);
    }

    return result;

  } catch (err) {
    trc(`[CaptionDetect] Error: ${err.message}`);
    return fallback;
  }
}

/**
 * Call Claude Haiku vision API with retry.
 */
async function callHaikuVision(imageContents, trc, attempt = 0) {
  const fallback = { burned_captions: false, position: null, confidence: 0 };
  const startMs = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: `These are cropped regions (bottom and center thirds) from 3 frames of a streaming clip. Do these frames contain BURNED-IN SUBTITLES (synchronized speech captions overlaid on the video)?

IMPORTANT — these are NOT subtitles (do NOT flag as burned_captions):
- Twitch/Kick chat messages and usernames
- Follow/subscribe/donation alerts
- "!commands" banners, bot messages
- Viewer counters, emote overlays
- Game HUD elements (health bars, minimaps, kill feeds)
- Streamer name badges or watermarks
- Social media handles (@username)

Subtitles = dialogue text that matches what someone is SAYING, usually centered at bottom, same font, appearing/disappearing in sync with speech.

For each frame: transcribe the visible text in the bottom region (verbatim, max 20 words).

Respond ONLY with JSON:
{"burned_captions": true/false, "position": "bottom" or "center" or null, "confidence": 0.0 to 1.0, "visible_text": ["text from frame 1", "text from frame 2", "text from frame 3"]}`,
            },
          ],
        }],
      }),
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startMs;

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      trc(`[CaptionDetect] Haiku API error ${response.status}: ${errText.slice(0, 200)}`);
      if (attempt < MAX_RETRIES) {
        return callHaikuVision(imageContents, trc, attempt + 1);
      }
      return fallback;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Fire-and-forget cost tracking
    try {
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;
      // Haiku pricing: $1/M input, $5/M output
      const costUsd = (inputTokens / 1_000_000) * 1.00 + (outputTokens / 1_000_000) * 5.00;
      await supabase.from('ai_calls').insert({
        model: 'claude-haiku-4-5-20251001',
        feature: 'caption_detection',
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        success: true,
        metadata: { frames: imageContents.length, attempt },
      });
    } catch { /* never block */ }

    // Parse JSON defensively
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      trc(`[CaptionDetect] Could not parse JSON from response: ${text.slice(0, 200)}`);
      return fallback;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        burned_captions: !!parsed.burned_captions,
        position: parsed.position === 'bottom' || parsed.position === 'center' ? parsed.position : null,
        confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0,
        visible_text: Array.isArray(parsed.visible_text) ? parsed.visible_text : [],
      };
    } catch {
      trc(`[CaptionDetect] JSON parse failed: ${jsonMatch[0].slice(0, 200)}`);
      return fallback;
    }

  } catch (err) {
    clearTimeout(timeout);
    const latencyMs = Date.now() - startMs;
    trc(`[CaptionDetect] Haiku call failed (attempt ${attempt}): ${err.message}`);

    // Log failed call
    try {
      await supabase.from('ai_calls').insert({
        model: 'claude-haiku-4-5-20251001',
        feature: 'caption_detection',
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        latency_ms: latencyMs,
        success: false,
        metadata: { error: err.message, attempt },
      });
    } catch { /* never block */ }

    if (attempt < MAX_RETRIES) {
      return callHaikuVision(imageContents, trc, attempt + 1);
    }
    return fallback;
  }
}
