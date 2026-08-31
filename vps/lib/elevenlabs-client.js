/**
 * ElevenLabs TTS Client — synthesizes voiceover lines via the ElevenLabs API.
 *
 * Voices selected for gaming/streaming commentary: energetic, expressive,
 * social-media-native. Model: eleven_multilingual_v2 for style expressiveness.
 *
 * Graceful degradation: if the API key is missing, the API fails, or any line
 * fails to synthesize, the render continues without voiceover.
 *
 * Cost: ~$0.01-0.03 per clip (2-4 short lines).
 * Logged to ai_calls table with feature: 'voiceover_elevenlabs'.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

// Voices optimized for gaming/streaming clip commentary.
// Selected from ElevenLabs library for energy + clarity at short line lengths.
const VOICES = {
  default: 'nPczCjzI2devNBz1zQrb',  // Brian — energetic young male, social media native
  female: 'cgSgspJ2msm6clMCkdW9',   // Jessica — expressive female, upbeat delivery
  deep: 'N2lVS1w4EtoT3dr4eOWO',     // Callum — deep male with character, punchy
};

// Model: eleven_multilingual_v2 — best style expressiveness.
// The `style` param is most effective on this model (reads punctuation,
// caps, and emotional cues in the text much better than turbo).
const MODEL_ID = 'eleven_multilingual_v2';

/**
 * Synthesize a single text line to MP3 via ElevenLabs API.
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
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.30,           // low = more expressive intonation variation
          similarity_boost: 0.75,    // keep voice identity recognizable
          style: 0.55,               // energetic delivery (reads ! ... CAPS as emotion)
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[ElevenLabs] API error ${response.status}: ${errText.slice(0, 200)}`);
      return { success: false };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    console.log(`[ElevenLabs] Synthesized "${text.slice(0, 40)}..." → ${buffer.length} bytes (${MODEL_ID})`);
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
 */
export async function synthesizeVoiceover(lines, outputDir, voice = 'default', userId = null, voiceIdOverride = null) {
  if (!lines || lines.length === 0) return [];
  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn('[ElevenLabs] No API key — voiceover disabled');
    return [];
  }

  const voiceId = voiceIdOverride || VOICES[voice] || VOICES.default;
  const results = [];
  const startMs = Date.now();
  let totalChars = 0;

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

  // Log cost — multilingual_v2: ~$0.18/1K chars
  const cost = (totalChars / 1000) * 0.18;
  try {
    await supabase.from('ai_calls').insert({
      user_id: userId,
      model: MODEL_ID,
      feature: 'voiceover_elevenlabs',
      tokens_input: totalChars,
      tokens_output: 0,
      cost_usd: cost,
      latency_ms: latencyMs,
      success: results.length > 0,
    });
  } catch { /* non-critical */ }

  console.log(`[ElevenLabs] ${results.length}/${lines.length} lines synthesized in ${latencyMs}ms ($${cost.toFixed(4)}, ${MODEL_ID})`);
  return results;
}

export { VOICES };
