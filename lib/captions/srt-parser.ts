/**
 * SRT subtitle file parser.
 *
 * Converts standard .SRT format into word-level timestamps compatible
 * with the existing karaoke pipeline (WordTimestamp[]).
 *
 * SRT format:
 * ```
 * 1
 * 00:00:01,500 --> 00:00:04,000
 * Hello world, this is a test
 *
 * 2
 * 00:00:04,500 --> 00:00:07,000
 * Another subtitle line
 * ```
 */

export interface SrtSegment {
  index: number
  startTime: number  // seconds
  endTime: number    // seconds
  text: string
}

export interface WordTimestamp {
  word: string
  start: number
  end: number
}

/**
 * Parse SRT timestamp "HH:MM:SS,mmm" → seconds.
 */
function parseSrtTime(timeStr: string): number {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})$/)
  if (!match) throw new Error(`Invalid SRT timestamp: "${timeStr}"`)

  const [, h, m, s, ms] = match
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000
}

/**
 * Parse raw SRT file content into segments.
 */
export function parseSrt(content: string): SrtSegment[] {
  const segments: SrtSegment[] = []

  // Normalize line endings and split into blocks
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  const blocks = normalized.split(/\n\n+/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue

    // Line 1: index number
    const index = parseInt(lines[0].trim())
    if (isNaN(index)) continue

    // Line 2: timestamps "00:00:01,500 --> 00:00:04,000"
    const timeLine = lines[1].trim()
    const timeMatch = timeLine.match(/^(.+?)\s*-->\s*(.+?)$/)
    if (!timeMatch) continue

    const startTime = parseSrtTime(timeMatch[1])
    const endTime = parseSrtTime(timeMatch[2])

    // Lines 3+: text content (may span multiple lines)
    const text = lines.slice(2).join(' ').trim()
    // Strip HTML-like tags (<i>, <b>, etc.) common in SRT files
    const cleanText = text.replace(/<[^>]+>/g, '').trim()

    if (cleanText && endTime > startTime) {
      segments.push({ index, startTime, endTime, text: cleanText })
    }
  }

  return segments
}

/**
 * Convert SRT segments into word-level timestamps.
 *
 * Since SRT only has segment-level timing (not per-word),
 * we distribute timing evenly across words within each segment.
 */
export function srtToWordTimestamps(segments: SrtSegment[]): WordTimestamp[] {
  const words: WordTimestamp[] = []

  for (const seg of segments) {
    const segWords = seg.text.split(/\s+/).filter(Boolean)
    if (segWords.length === 0) continue

    const segDuration = seg.endTime - seg.startTime
    const wordDuration = segDuration / segWords.length

    segWords.forEach((word, i) => {
      words.push({
        word,
        start: seg.startTime + i * wordDuration,
        end: seg.startTime + (i + 1) * wordDuration,
      })
    })
  }

  return words
}

/**
 * Full pipeline: parse SRT string → word timestamps.
 */
export function parseSrtToWordTimestamps(srtContent: string): WordTimestamp[] {
  const segments = parseSrt(srtContent)
  return srtToWordTimestamps(segments)
}

/**
 * Extract full text from SRT segments (for Claude analysis).
 */
export function srtToFullText(segments: SrtSegment[]): string {
  return segments.map((s) => s.text).join(' ')
}

/**
 * Convert SRT segments to the `segments` JSONB format used in the transcriptions table.
 */
export function srtToTranscriptionSegments(segments: SrtSegment[]): Array<{ start: number; end: number; text: string }> {
  return segments.map((s) => ({
    start: s.startTime,
    end: s.endTime,
    text: s.text,
  }))
}
