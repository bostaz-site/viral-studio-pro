/**
 * Filler word detection and FFmpeg cut command builder.
 *
 * Uses Whisper word-level timestamps to detect filler words and generate
 * an FFmpeg `select` filter that removes those segments from the output.
 *
 * Supported filler words (FR + EN):
 *   FR: euh, hum, bah, ben, genre, voilà, quoi, hein, nan, bon, enfin, en fait, du coup, donc, ouais
 *   EN: uh, um, like, you know, right, so, well, literally, basically, actually
 */

export interface WordTimestamp {
  word: string
  start: number
  end: number
}

export interface FillerSegment {
  start: number
  end: number
  word: string
}

const FILLER_WORDS = new Set([
  // French
  'euh', 'hum', 'bah', 'ben', 'genre', 'voilà', 'quoi', 'hein', 'nan', 'ouais', 'enfin',
  // English
  'uh', 'um', 'like', 'right', 'well', 'literally', 'basically',
])

// Multi-word fillers (checked after splitting)
const MULTI_WORD_FILLERS = [
  ['en', 'fait'],
  ['du', 'coup'],
  ['you', 'know'],
  ['i', 'mean'],
  ['you', 'know', 'what', 'i', 'mean'],
]

/**
 * Detects filler word segments from Whisper word timestamps.
 * Adds a small padding (50ms) around each filler to prevent audio artifacts.
 */
export function detectFillerSegments(
  words: WordTimestamp[],
  paddingMs = 50
): FillerSegment[] {
  const pad = paddingMs / 1000
  const fillers: FillerSegment[] = []

  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const normalized = w.word.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüç]/g, '')

    // Single-word filler check
    if (FILLER_WORDS.has(normalized)) {
      fillers.push({
        start: Math.max(0, w.start - pad),
        end: w.end + pad,
        word: w.word,
      })
      continue
    }

    // Multi-word filler check
    for (const phrase of MULTI_WORD_FILLERS) {
      if (i + phrase.length <= words.length) {
        const slice = words.slice(i, i + phrase.length)
        const sliceNorm = slice.map((x) => x.word.toLowerCase().replace(/[^a-z]/g, ''))
        if (phrase.every((p, idx) => sliceNorm[idx] === p)) {
          fillers.push({
            start: Math.max(0, slice[0].start - pad),
            end: slice[slice.length - 1].end + pad,
            word: slice.map((x) => x.word).join(' '),
          })
          i += phrase.length - 1
          break
        }
      }
    }
  }

  // Merge overlapping segments
  return mergeSegments(fillers)
}

function mergeSegments(segments: FillerSegment[]): FillerSegment[] {
  if (segments.length === 0) return []
  const sorted = [...segments].sort((a, b) => a.start - b.start)
  const merged: FillerSegment[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    if (sorted[i].start <= last.end + 0.1) {
      last.end = Math.max(last.end, sorted[i].end)
      last.word += ` + ${sorted[i].word}`
    } else {
      merged.push(sorted[i])
    }
  }
  return merged
}

/**
 * Builds an FFmpeg command that removes filler segments from the video.
 *
 * Strategy: use `select` + `aselect` filter to keep only non-filler segments,
 * then concat the kept parts.
 *
 * @param inputPath     Source video file
 * @param outputPath    Output file path
 * @param fillers       Array of filler segments to remove
 * @param totalDuration Total video duration in seconds (from metadata)
 */
export function buildFillerRemovalCommand(
  inputPath: string,
  outputPath: string,
  fillers: FillerSegment[],
  totalDuration: number
): string {
  if (fillers.length === 0) {
    // Nothing to cut — passthrough with re-encode for consistency
    return [
      'ffmpeg -y',
      `-i "${inputPath}"`,
      '-c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k',
      `"${outputPath}"`,
    ].join(' ')
  }

  // Build the kept time intervals (inverse of filler segments)
  const keepSegments = invertSegments(fillers, totalDuration)

  if (keepSegments.length === 0) {
    return `echo "No content remaining after filler removal"`
  }

  // Build select expression: between(t,start,end) for each kept segment
  const selectExpr = keepSegments
    .map((seg) => `between(t,${seg.start.toFixed(3)},${seg.end.toFixed(3)})`)
    .join('+')

  const filter = `[0:v]select='${selectExpr}',setpts=N/FRAME_RATE/TB[v];[0:a]aselect='${selectExpr}',asetpts=N/SR/TB[a]`

  return [
    'ffmpeg -y',
    `-i "${inputPath}"`,
    `-filter_complex "${filter}"`,
    '-map "[v]" -map "[a]"',
    '-c:v libx264 -preset fast -crf 23',
    '-c:a aac -b:a 128k',
    '-movflags +faststart',
    `"${outputPath}"`,
  ].join(' ')
}

/**
 * Returns the complement of filler segments within [0, totalDuration].
 */
function invertSegments(
  fillers: FillerSegment[],
  totalDuration: number
): { start: number; end: number }[] {
  const kept: { start: number; end: number }[] = []
  let cursor = 0

  for (const f of fillers) {
    if (f.start > cursor + 0.05) {
      kept.push({ start: cursor, end: f.start })
    }
    cursor = f.end
  }

  if (cursor < totalDuration - 0.05) {
    kept.push({ start: cursor, end: totalDuration })
  }

  return kept
}

/**
 * Returns a human-readable summary of detected filler words.
 */
export function summarizeFillers(fillers: FillerSegment[]): string {
  const totalTime = fillers.reduce((acc, f) => acc + (f.end - f.start), 0)
  return `${fillers.length} mots de remplissage détectés (${totalTime.toFixed(1)}s supprimés)`
}
