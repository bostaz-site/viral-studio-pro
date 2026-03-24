/**
 * FFmpeg split-screen (picture-in-picture vertical) command builder.
 * Creates a 9:16 vertical video with:
 *   - Top half: original trending clip (scaled to fill)
 *   - Bottom half: remixed content with satisfying/gameplay background
 *   - Credit overlay at the bottom of the top section
 */

export interface SplitScreenOptions {
  /** Path to the main/original trending clip (top panel) */
  topInputPath: string
  /** Path to the remixed/secondary content (bottom panel) — can be same as top for placeholder */
  bottomInputPath: string
  /** Output file path */
  outputPath: string
  /** Credit text to overlay, e.g. "Inspiration : @username" */
  creditText?: string
  /** Target output dimensions for 9:16 (default 1080x1920) */
  width?: number
  height?: number
  /** Clip start time in seconds (trim top input) */
  startTime?: number
  /** Clip duration in seconds */
  duration?: number
}

/**
 * Escapes a string for use in FFmpeg drawtext filter.
 */
function escapeDrawtext(text: string): string {
  return text.replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/\[/g, '\\[').replace(/\]/g, '\\]')
}

/**
 * Builds an FFmpeg command for a vertical split-screen (top/bottom) video.
 * Both panels are cropped to 9:16, stacked vertically.
 */
export function buildSplitScreenCommand(options: SplitScreenOptions): string {
  const {
    topInputPath,
    bottomInputPath,
    outputPath,
    creditText,
    width = 1080,
    height = 1920,
    startTime,
    duration,
  } = options

  const halfH = height / 2      // 960
  const panelW = width           // 1080

  const inputs: string[] = []

  // Input 0: top clip (original)
  if (startTime !== undefined) inputs.push(`-ss ${startTime}`)
  if (duration !== undefined) inputs.push(`-t ${duration}`)
  inputs.push(`-i "${topInputPath}"`)

  // Input 1: bottom clip (remixed/secondary)
  if (startTime !== undefined) inputs.push(`-ss ${startTime}`)
  if (duration !== undefined) inputs.push(`-t ${duration}`)
  inputs.push(`-i "${bottomInputPath}"`)

  // Filter complex:
  // [0:v] scale+crop to 1080x960 for top panel
  // [1:v] scale+crop to 1080x960 for bottom panel
  // Stack vertically → 1080x1920
  // Overlay credit text if provided
  const filterComplex = [
    `[0:v]scale=${panelW}:${halfH}:force_original_aspect_ratio=increase,crop=${panelW}:${halfH}[top]`,
    `[1:v]scale=${panelW}:${halfH}:force_original_aspect_ratio=increase,crop=${panelW}:${halfH}[bottom]`,
    `[top][bottom]vstack=inputs=2[stacked]`,
  ]

  let videoOutput = 'stacked'

  if (creditText) {
    const safe = escapeDrawtext(creditText)
    filterComplex.push(
      `[stacked]drawtext=text='${safe}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=${halfH - 48}:box=1:boxcolor=black@0.55:boxborderw=8[credited]`
    )
    videoOutput = 'credited'
  }

  const filterArg = `-filter_complex "${filterComplex.join('; ')}" -map "[${videoOutput}]" -map 0:a?`

  const cmd = [
    'ffmpeg',
    '-y',
    ...inputs,
    filterArg,
    '-c:v libx264',
    '-preset fast',
    '-crf 23',
    '-c:a aac',
    '-b:a 128k',
    '-movflags +faststart',
    '-pix_fmt yuv420p',
    `"${outputPath}"`,
  ].join(' ')

  return cmd
}

/**
 * Builds a simpler single-input split-screen where the same clip fills both panels
 * (top: original footage, bottom: mirrored/color-shifted version as placeholder).
 * Use this when no secondary content is available yet.
 */
export function buildSingleSourceSplitScreen(
  inputPath: string,
  outputPath: string,
  creditText?: string,
  duration?: number
): string {
  const width = 1080
  const halfH = 960

  const timeArgs = duration !== undefined ? `-t ${duration}` : ''

  const filterParts = [
    `[0:v]split=2[orig][copy]`,
    `[orig]scale=${width}:${halfH}:force_original_aspect_ratio=increase,crop=${width}:${halfH}[top]`,
    `[copy]scale=${width}:${halfH}:force_original_aspect_ratio=increase,crop=${width}:${halfH},hue=s=0.3:b=0.1[bottom]`,
    `[top][bottom]vstack=inputs=2[stacked]`,
  ]

  let videoOutput = 'stacked'

  if (creditText) {
    const safe = escapeDrawtext(creditText)
    filterParts.push(
      `[stacked]drawtext=text='${safe}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=${halfH - 48}:box=1:boxcolor=black@0.55:boxborderw=8[out]`
    )
    videoOutput = 'out'
  }

  return [
    'ffmpeg -y',
    `-i "${inputPath}"`,
    timeArgs,
    `-filter_complex "${filterParts.join('; ')}"`,
    `-map "[${videoOutput}]" -map 0:a?`,
    '-c:v libx264 -preset fast -crf 23',
    '-c:a aac -b:a 128k',
    '-movflags +faststart -pix_fmt yuv420p',
    `"${outputPath}"`,
  ].filter(Boolean).join(' ')
}
