import OpenAI from 'openai'

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
}

export interface WordTimestamp {
  word: string
  start: number
  end: number
}

export interface WhisperResult {
  language: string
  full_text: string
  segments: TranscriptionSegment[]
  word_timestamps: WordTimestamp[]
}

export async function transcribeAudio(
  fileBuffer: Buffer,
  filename: string
): Promise<WhisperResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const mimeType = filename.endsWith('.mp4')
    ? 'video/mp4'
    : filename.endsWith('.mov')
    ? 'video/quicktime'
    : filename.endsWith('.mkv')
    ? 'video/x-matroska'
    : filename.endsWith('.avi')
    ? 'video/x-msvideo'
    : 'video/mp4'

  const file = new File([new Uint8Array(fileBuffer)], filename, { type: mimeType })

  const response = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
  })

  return {
    language: response.language ?? 'fr',
    full_text: response.text,
    segments: (response.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })),
    word_timestamps: (response.words ?? []).map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })),
  }
}
