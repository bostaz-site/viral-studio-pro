/**
 * Burned-in Caption Detector
 *
 * Extracts 3 frames from a video (25%, 50%, 75% of duration), crops the bottom
 * third and center third, then sends them to Claude Haiku (vision) to detect
 * whether the video already has burned-in subtitles/captions.
 *
 * Designed to run in parallel with Whisper transcription — never blocks render.
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
 * @returns {Promise<{burned_captions: boolean, position: string|null, confidence: number}>}
 */
export async function detectBurnedCaptions(videoPath, duration, tempDir, trc = () => {}) {
  const fallback = { burned_captions: false, position: null, confidence: 0 };

  if (!ANTHROPIC_API_KEY) {
    trc('[CaptionDetect] No ANTHROPIC_API_KEY — skipping detection');
    return fallback;
  }

  if (!duration || duration < 2) {
    trc('[CaptionDetect] Duration too short — skipping');
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
    trc(`[CaptionDetect] Result: burned=${result.burned_captions}, pos=${result.position}, conf=${result.confidence}`);
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
              text: `These are cropped regions (bottom third and center third) from 3 frames of a video clip. Do these frames contain burned-in subtitles or captions (synchronized dialogue text overlaid on the video, NOT a stream overlay, logo, username watermark, or chat widget)?

Respond ONLY with this JSON, no other text:
{"burned_captions": true/false, "position": "bottom" or "center" or null, "confidence": 0.0 to 1.0}`,
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
