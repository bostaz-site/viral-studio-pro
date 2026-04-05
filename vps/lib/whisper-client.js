import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

/**
 * Extract audio from video and transcribe with OpenAI Whisper API
 * Returns array of word timestamps: [{ word, start, end }]
 *
 * Requires OPENAI_API_KEY environment variable to be set.
 */
export async function transcribeWithWhisper(videoPath, options = {}) {
  const { language = 'en', tempDir = '/tmp', contextPrompt = '' } = options;

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) {
    console.warn('[Whisper] No OPENAI_API_KEY/OPENAI_KEY set — skipping transcription');
    return [];
  }

  const audioPath = path.join(tempDir, `audio-${Date.now()}.mp3`);

  try {
    // Step 1: Extract audio from video with FFmpeg
    // Use 96kbps + loudnorm to give Whisper cleaner input → better accuracy.
    console.log('[Whisper] Extracting audio from video...');
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      videoPath,
      '-vn',
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-b:a',
      '96k',
      '-f',
      'mp3',
      audioPath,
    ], { timeout: 30000 });

    const stat = await fs.stat(audioPath);
    console.log(`[Whisper] Audio extracted: ${stat.size} bytes`);

    // Step 2: Send to OpenAI Whisper API with word timestamps
    // Context prompt steers Whisper toward the right domain vocabulary
    // (gaming/streaming slang, proper nouns). Bad grammar like "on his house"
    // vs "in his house" is typical without context.
    const promptText = [
      'Twitch stream gaming clip. Casual spoken English with gaming slang.',
      contextPrompt ? `Context: ${contextPrompt}.` : '',
      'Use proper grammar and punctuation.',
    ].filter(Boolean).join(' ');

    const formData = new FormData();
    const audioBuffer = await fs.readFile(audioPath);
    formData.append('file', new Blob([audioBuffer], { type: 'audio/mp3' }), 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');
    formData.append('temperature', '0');
    formData.append('prompt', promptText);
    if (language) formData.append('language', language);

    console.log('[Whisper] Sending to OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Whisper API error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    const preview = result.text ? result.text.substring(0, 80) : '(no text)';
    console.log(`[Whisper] Transcription: "${preview}..."`);

    // Step 3: Extract word-level timestamps
    const words = result.words || [];
    const wordTimestamps = words
      .map(w => ({
        word: w.word ? w.word.trim() : '',
        start: w.start || 0,
        end: w.end || 0,
      }))
      .filter(w => w.word.length > 0);

    console.log(`[Whisper] Got ${wordTimestamps.length} word timestamps`);
    return wordTimestamps;
  } catch (err) {
    console.warn(`[Whisper] Transcription failed: ${err.message}`);
    return [];
  } finally {
    // Cleanup audio file
    try {
      await fs.unlink(audioPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
