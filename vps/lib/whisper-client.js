import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { supabase } from './supabase-client.js';

const execFileAsync = promisify(execFile);

/**
 * Extract audio from video and transcribe with OpenAI Whisper API
 * Returns array of word timestamps: [{ word, start, end }]
 *
 * Requires OPENAI_API_KEY environment variable to be set.
 */
export async function transcribeWithWhisper(videoPath, options = {}) {
  const { language = 'en', tempDir = '/tmp', contextPrompt = '', clipDuration = 0 } = options;

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) {
    console.warn('[Whisper] No OPENAI_API_KEY/OPENAI_KEY set — skipping transcription');
    return [];
  }

  const audioPath = path.join(tempDir, `audio-${Date.now()}.mp3`);

  try {
    // Step 1: Extract audio — simple downsample, no loudnorm (can shift timestamps)
    console.log('[Whisper] Extracting audio from video...');
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-b:a', '96k',
      '-f', 'mp3',
      audioPath,
    ], { timeout: 30000 });

    const stat = await fs.stat(audioPath);
    console.log(`[Whisper] Audio extracted: ${stat.size} bytes`);

    // Log audio duration for debugging
    let audioDuration = 0;
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        audioPath,
      ]);
      audioDuration = parseFloat(stdout.trim()) || 0;
      console.log(`[Whisper] Audio duration: ${audioDuration.toFixed(2)}s (clip expected: ${clipDuration}s)`);
    } catch {
      // Non-critical
    }

    // Step 2: Send to OpenAI Whisper API
    // IMPORTANT: Keep prompt minimal — verbose prompts get hallucinated as
    // transcription when the clip has little/no speech (known Whisper issue).
    const formData = new FormData();
    const audioBuffer = await fs.readFile(audioPath);
    formData.append('file', new Blob([audioBuffer], { type: 'audio/mp3' }), 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');
    formData.append('temperature', '0');
    if (language) formData.append('language', language);
    // Only use clip title as hint (short, relevant), NOT generic instructions
    if (contextPrompt && contextPrompt.length > 0 && contextPrompt.length < 100) {
      formData.append('prompt', contextPrompt);
    }

    console.log('[Whisper] Sending to OpenAI API...');
    const whisperStartMs = Date.now();
    const whisperAbort = new AbortController();
    const whisperTimeout = setTimeout(() => whisperAbort.abort(), 120_000); // 120s timeout
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: whisperAbort.signal,
      });
    } finally {
      clearTimeout(whisperTimeout);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Whisper API error ${response.status}: ${errText}`);
    }

    const whisperLatencyMs = Date.now() - whisperStartMs;
    const result = await response.json();
    const transcribedText = result.text || '';
    const detectedLanguage = result.language || language || 'en';
    console.log(`[Whisper] Transcription (lang=${detectedLanguage}): "${transcribedText.substring(0, 100)}"`);

    // Fire-and-forget cost tracking (Whisper: $0.006/minute = $0.0001/second)
    try {
      const durationForCost = audioDuration || clipDuration || 30;
      await supabase.from('ai_calls').insert({
        model: 'whisper-1',
        feature: 'transcription_whisper',
        cost_usd: durationForCost * 0.0001,
        latency_ms: whisperLatencyMs,
        success: true,
        metadata: { audio_duration_seconds: durationForCost, language: detectedLanguage },
      });
    } catch { /* never block render */ }

    // Step 3: Extract word-level timestamps
    const words = result.words || [];
    let wordTimestamps = words
      .map(w => ({
        word: w.word ? w.word.trim() : '',
        start: typeof w.start === 'number' ? w.start : 0,
        end: typeof w.end === 'number' ? w.end : 0,
      }))
      .filter(w => w.word.length > 0);

    console.log(`[Whisper] Got ${wordTimestamps.length} word timestamps`);

    if (wordTimestamps.length === 0) {
      return { words: [], language: detectedLanguage, fullText: transcribedText };
    }

    // Step 4: Anti-hallucination checks
    const first = wordTimestamps[0];
    const last = wordTimestamps[wordTimestamps.length - 1];
    console.log(`[Whisper] Timing: first="${first.word}" @ ${first.start.toFixed(2)}s, last="${last.word}" @ ${last.end.toFixed(2)}s`);

    // CHECK 1: All words crammed into tiny window = hallucination
    // Real speech: 12 words take at least 2-3 seconds. If all 12 words
    // fit within 0.5 seconds, Whisper hallucinated.
    const totalSpan = last.end - first.start;
    const minExpectedDuration = wordTimestamps.length * 0.15; // ~150ms per word minimum
    if (totalSpan < minExpectedDuration) {
      console.warn(`[Whisper] HALLUCINATION DETECTED: ${wordTimestamps.length} words in ${totalSpan.toFixed(2)}s (need ≥${minExpectedDuration.toFixed(1)}s). Rejecting.`);
      return { words: [], language: detectedLanguage, fullText: transcribedText };
    }

    // CHECK 2: All words start after 80% of clip = likely hallucinated at end
    if (clipDuration > 0 && first.start > clipDuration * 0.8) {
      console.warn(`[Whisper] HALLUCINATION DETECTED: first word at ${first.start.toFixed(2)}s in ${clipDuration.toFixed(1)}s clip (>80%). Rejecting.`);
      return { words: [], language: detectedLanguage, fullText: transcribedText };
    }

    // CHECK 3: Words extend way past clip duration = hallucination
    if (clipDuration > 0 && last.end > clipDuration * 1.5) {
      console.warn(`[Whisper] HALLUCINATION DETECTED: last word at ${last.end.toFixed(2)}s, clip is ${clipDuration.toFixed(1)}s. Rejecting.`);
      return { words: [], language: detectedLanguage, fullText: transcribedText };
    }

    return { words: wordTimestamps, language: detectedLanguage, fullText: transcribedText };
  } catch (err) {
    console.warn(`[Whisper] Transcription failed: ${err.message}`);
    return { words: [], language: null, fullText: '' };
  } finally {
    try {
      await fs.unlink(audioPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
