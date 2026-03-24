import type { CaptionStyle } from '@/components/captions/caption-templates'

export interface WordTimestamp {
  word: string
  start: number
  end: number
}

// ── ASS time format ──────────────────────────────────────────────────────────

function toAssTime(seconds: number): string {
  const s = Math.max(0, seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const cs = Math.round((s % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

// ── Karaoke ASS generation ───────────────────────────────────────────────────

/**
 * Generates an ASS subtitle file content with karaoke word-by-word highlighting.
 * Uses the \kf (fill) tag for smooth karaoke progression.
 */
export function generateKaraokeAss(
  words: WordTimestamp[],
  style: CaptionStyle,
  clipStartTime = 0,
  wordsPerLine = 6
): string {
  const { ffmpegStyle } = style

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,${ffmpegStyle.fontname},${ffmpegStyle.fontsize},${ffmpegStyle.primaryColor},&H000000FF,${ffmpegStyle.outlineColor},${ffmpegStyle.backColor},${ffmpegStyle.bold},0,0,0,100,100,0,0,1,${ffmpegStyle.outline},${ffmpegStyle.shadow},${ffmpegStyle.alignment},20,20,${ffmpegStyle.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`

  // Group words into lines
  const lines: WordTimestamp[][] = []
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine))
  }

  const events = lines.map((lineWords) => {
    const lineStart = Math.max(0, lineWords[0].start - clipStartTime)
    const lineEnd = Math.max(lineStart + 0.1, lineWords[lineWords.length - 1].end - clipStartTime)

    const karaokeText = lineWords
      .map((w) => {
        const durationCs = Math.max(1, Math.round((w.end - w.start) * 100))
        return `{\\kf${durationCs}}${w.word}`
      })
      .join(' ')

    return `Dialogue: 0,${toAssTime(lineStart)},${toAssTime(lineEnd)},Karaoke,,0,0,0,,${karaokeText}`
  })

  return [header, ...events].join('\n')
}

// ── FFmpeg command builders ──────────────────────────────────────────────────

interface RenderOptions {
  startTime: number
  endTime: number
  aspectRatio?: '9:16' | '1:1' | '16:9'
  assFilePath?: string
}

/**
 * Builds the FFmpeg command to cut, reframe and optionally burn subtitles.
 */
export function buildRenderCommand(
  inputPath: string,
  outputPath: string,
  options: RenderOptions
): string {
  const duration = options.endTime - options.startTime
  const vfFilters: string[] = []

  if (options.aspectRatio === '9:16') {
    vfFilters.push("scale='if(gt(iw/ih,9/16),1920*ih/iw,1080)':-1,pad=1080:1920:(ow-iw)/2:(oh-ih)/2")
  } else if (options.aspectRatio === '1:1') {
    vfFilters.push("crop='min(iw,ih)':min(iw\\,ih),scale=1080:1080")
  }

  if (options.assFilePath) {
    vfFilters.push(`ass='${options.assFilePath.replace(/\\/g, '/')}'`)
  }

  const vfArg = vfFilters.length > 0 ? `-vf "${vfFilters.join(',')}"` : ''

  return [
    'ffmpeg -y',
    `-ss ${options.startTime}`,
    `-i "${inputPath}"`,
    `-t ${duration}`,
    vfArg,
    '-c:v libx264 -preset fast -crf 22',
    '-c:a aac -b:a 192k',
    '-movflags +faststart',
    `"${outputPath}"`,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Builds FFmpeg command to extract a thumbnail at a given timestamp.
 */
export function buildThumbnailCommand(
  inputPath: string,
  outputPath: string,
  atSecond: number
): string {
  return `ffmpeg -y -ss ${atSecond} -i "${inputPath}" -vframes 1 -q:v 2 "${outputPath}"`
}
