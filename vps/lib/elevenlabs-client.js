/**
 * ElevenLabs TTS Client — synthesizes voiceover lines via the ElevenLabs API.
 *
 * Graceful degradation: if the API key is missing, the API fails, or any line
 * fails to synthesize, the render continues without voiceover. No TTS failure
 * should ever block a render.
 *
 * Cost: ~$0.01-0.03 per clip (2-4 short lines, ~5-15 words total).
 * Logged to ai_calls table with feature: 'voiceover_elevenlabs'.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Supabase client for ai_calls logging (fire-and-forget)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

// Default voices — energetic, clear, good for commentary
const VOICES = {
  default: 'JBFqnCBsd6RMkjVDRZzb',  // George — energetic male narrator
  female: 'EXAVITQu4vr4xnSDxMaL',   // Bella — clear female
  deep: 'VR6AewLTigWG4xSOukaG',      // Arnold — deep male
};

/**
 * Synthesize a single text line to MP3 via ElevenLabs API.
 *
 * @param {string} text - The line to synthesize
 * @param {string} voiceId - ElevenLabs voice ID
 * @param {string} outputPath - Where to save the MP3
 * @returns {Promise<{success: boolean, durationMs?: number, characters?: number}>}
 */
async function synthesizeLine(text, voiceId, outputPath) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn('[ElevenLabs] No ELEVENLABS_API_KEY — skipping TTS');
    return { success: false };
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(15000), // 15s timeout per line
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[ElevenLabs] API error ${response.status}: ${errText.slice(0, 200)}`);
      return { success: false };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    console.log(`[ElevenLabs] Synthesized "${text.slice(0, 30)}..." → ${buffer.length} bytes`);
    return { success: true, characters: text.length };
  } catch (err) {
    console.error(`[ElevenLabs] Synthesis failed for "${text.slice(0, 30)}...":`, err.message);
    return { success: false };
  }
}

/**
 * Synthesize all voiceover lines to MP3 files in the given directory.
 *
 * @param {Array<{text: string, startTime: number, estimatedDuration: number, role: string}>} lines
 * @param {string} outputDir - Directory to write MP3 files into
 * @param {string} voice - Voice key: 'default', 'female', 'deep'
 * @param {string} userId - For cost logging
 * @returns {Promise<Array<{path: string, startTime: number, estimatedDuration: number, role: string}>>}
 *          Only successfully synthesized lines are returned.
 */
export async function synthesizeVoiceover(lines, outputDir, voice = 'default', userId = null) {
  if (!lines || lines.length === 0) return [];
  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn('[ElevenLabs] No API key — voiceover disabled');
    return [];
  }

  const voiceId = VOICES[voice] || VOICES.default;
  const results = [];
  const startMs = Date.now();
  let totalChars = 0;

  // Synthesize lines sequentially (avoid rate limits)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mp3Path = path.join(outputDir, `vo_${i}.mp3`);

    const result = await synthesizeLine(line.text, voiceId, mp3Path);
    if (result.success) {
      results.push({
        path: mp3Path,
        startTime: line.startTime,
        estimatedDuration: line.estimatedDuration,
        role: line.role,
      });
      totalChars += result.characters || 0;
    }
  }

  const latencyMs = Date.now() - startMs;

  // Log cost to ai_calls (fire-and-forget)
  // ElevenLabs Turbo v2.5: ~$0.15/1K chars
  const cost = (totalChars / 1000) * 0.15;
  try {
    await supabase.from('ai_calls').insert({
      user_id: userId,
      model: 'eleven_turbo_v2_5',
      feature: 'voiceover_elevenlabs',
      tokens_input: totalChars,
      tokens_output: 0,
      cost_usd: cost,
      latency_ms: latencyMs,
      success: results.length > 0,
    });
  } catch { /* non-critical */ }

  console.log(`[ElevenLabs] ${results.length}/${lines.length} lines synthesized in ${latencyMs}ms ($${cost.toFixed(4)})`);
  return results;
}

export { VOICES };
