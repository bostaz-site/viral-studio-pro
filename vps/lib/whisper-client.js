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
  const { language = 'en', tempDir = '/tmp', contextPrompt = '', clipDuration = 0 } = options;

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) {
    console.warn('[Whisper] No OPENAI_API_KEY/OPENAI_KEY set — skipping transcription');
    return [];
  }

  const audioPath = path.join(tempDir, `audio-${Date.now()}.mp3`);

  try {
    // Step 1: Extract audio from video with FFmpeg
    // IMPORTANT: No loudnorm filter — it can shift timestamps by adding silence
    // during single-pass analysis, causing Whisper to report wrong timing.
    // Simple extraction: just downsample to 16kHz mono for Whisper.
    console.log('[Whisper] Extracting audio from video...');
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      videoPath,
      '-vn',
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

    // Check audio duration matches expected clip duration
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        audioPath,
      ]);
      const audioDuration = parseFloat(stdout.trim()) || 0;
      console.log(`[Whisper] Audio duration: ${audioDuration.toFixed(2)}s (clip: ${clipDuration}s)`);
    } catch {
      // Non-critical, just for debugging
    }

    // Step 2: Send to OpenAI Whisper API with word timestamps
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
    console.log(`[Whisper] Transcription: "${preview}"`);

    // Step 3: Extract word-level timestamps
    const words = result.words || [];
    const wordTimestamps = words
      .map(w => ({
        word: w.word ? w.word.trim() : '',
        start: typeof w.start === 'number' ? w.start : 0,
        end: typeof w.end === 'number' ? w.end : 0,
      }))
      .filter(w => w.word.length > 0);

    console.log(`[Whisper] Got ${wordTimestamps.length} word timestamps`);

    // Log timing distribution for debugging
    if (wordTimestamps.length > 0) {
      const first = wordTimestamps[0];
      const last = wordTimestamps[wordTimestamps.length - 1];
      console.log(`[Whisper] Timing: first="${first.word}" @ ${first.start.toFixed(2)}s, last="${last.word}" @ ${last.end.toFixed(2)}s`);

      // SANITY CHECK: if all words are clustered in the last 20% of the clip,
      // something is wrong (likely loudnorm added silence, or yt-dlp downloaded extra content).
      // In this case, shift all timestamps to start near 0.
      if (clipDuration > 0 && first.start > clipDuration * 0.8) {
        const offset = first.start - 0.5; // Shift so first word starts at 0.5s
        console.warn(`[Whisper] WARNING: All words start after 80% of clip (${first.start.toFixed(2)}s / ${clipDuration}s). Shifting timestamps by -${offset.toFixed(2)}s`);
        for (const w of wordTimestamps) {
          w.start = Math.max(0, w.start - offset);
          w.end = Math.max(w.start + 0.05, w.end - offset);
        }
        console.log(`[Whisper] After shift: first="${wordTimestamps[0].word}" @ ${wordTimestamps[0].start.toFixed(2)}s, last="${wordTimestamps[wordTimestamps.length - 1].word}" @ ${wordTimestamps[wordTimestamps.length - 1].end.toFixed(2)}s`);
      }
    }

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
