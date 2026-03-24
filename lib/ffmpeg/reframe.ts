/**
 * FFmpeg multi-format reframe command builder.
 *
 * Supported aspect ratios:
 *   9:16  (1080×1920) — TikTok, Instagram Reels, YouTube Shorts (vertical)
 *   1:1   (1080×1080) — Instagram, Twitter/X (square)
 *   16:9  (1920×1080) — YouTube, LinkedIn (horizontal)
 */

export type AspectRatio = '9:16' | '1:1' | '16:9'

export interface ReframeOptions {
  inputPath: string
  outputPath: string
  aspectRatio: AspectRatio
  /** Smart crop: use face/subject detection offset instead of center crop (default: center) */
  cropAnchor?: 'center' | 'top' | 'bottom'
  /** CRF quality (lower = better, default 23) */
  crf?: number
}

interface Dimensions {
  width: number
  height: number
}

const RATIO_DIMENSIONS: Record<AspectRatio, Dimensions> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
}

/**
 * Builds the FFmpeg crop+scale filter for a given aspect ratio.
 * Strategy:
 *   1. Scale the input so the SHORT side fits the target dimension
 *   2. Crop the excess from the LONG side (centered by default)
 */
function buildCropFilter(
  targetW: number,
  targetH: number,
  cropAnchor: 'center' | 'top' | 'bottom'
): string {
  const targetRatio = targetW / targetH

  // Scale so the video fills the target frame (cover mode)
  // If source is wider than target: scale height to targetH, then crop width
  // If source is taller than target: scale width to targetW, then crop height
  const scaleFilter = `scale='if(gt(iw/ih,${targetRatio.toFixed(4)}),trunc(oh*${targetRatio.toFixed(4)}/2)*2,${targetW})':'if(gt(iw/ih,${targetRatio.toFixed(4)}),${targetH},trunc(ow/${targetRatio.toFixed(4)}/2)*2)'`

  // Crop to exact target dimensions
  let cropY: string
  if (cropAnchor === 'top') {
    cropY = '0'
  } else if (cropAnchor === 'bottom') {
    cropY = 'ih-${targetH}'
  } else {
    cropY = '(ih-oh)/2'
  }

  const cropFilter = `crop=${targetW}:${targetH}:(iw-${targetW})/2:${cropY}`

  return `${scaleFilter},${cropFilter}`
}

/**
 * Builds an FFmpeg command that reframes a video to the target aspect ratio.
 */
export function buildReframeCommand(options: ReframeOptions): string {
  const {
    inputPath,
    outputPath,
    aspectRatio,
    cropAnchor = 'center',
    crf = 23,
  } = options

  const { width, height } = RATIO_DIMENSIONS[aspectRatio]
  const videoFilter = buildCropFilter(width, height, cropAnchor)

  return [
    'ffmpeg -y',
    `-i "${inputPath}"`,
    `-vf "${videoFilter}"`,
    `-c:v libx264 -preset fast -crf ${crf}`,
    '-c:a copy',
    '-movflags +faststart',
    `-s ${width}x${height}`,
    `"${outputPath}"`,
  ].join(' ')
}

/**
 * Builds FFmpeg commands for all three export formats at once.
 * Returns a map of aspectRatio → command.
 */
export function buildAllFormatsCommands(
  inputPath: string,
  outputDir: string,
  baseName: string,
  cropAnchor: ReframeOptions['cropAnchor'] = 'center'
): Record<AspectRatio, string> {
  const ratios: AspectRatio[] = ['9:16', '1:1', '16:9']
  const suffixes: Record<AspectRatio, string> = {
    '9:16': 'vertical',
    '1:1':  'square',
    '16:9': 'horizontal',
  }

  return Object.fromEntries(
    ratios.map((ratio) => [
      ratio,
      buildReframeCommand({
        inputPath,
        outputPath: `${outputDir}/${baseName}_${suffixes[ratio]}.mp4`,
        aspectRatio: ratio,
        cropAnchor,
      }),
    ])
  ) as Record<AspectRatio, string>
}

/**
 * Returns a human-readable label for the aspect ratio.
 */
export function getAspectRatioLabel(ratio: AspectRatio): string {
  const labels: Record<AspectRatio, string> = {
    '9:16': 'Vertical (9:16)',
    '1:1':  'Carré (1:1)',
    '16:9': 'Horizontal (16:9)',
  }
  return labels[ratio]
}

/**
 * Returns the platform icons/names for a given aspect ratio.
 */
export function getAspectRatioPlatforms(ratio: AspectRatio): string[] {
  const platforms: Record<AspectRatio, string[]> = {
    '9:16': ['TikTok', 'Reels', 'Shorts'],
    '1:1':  ['Instagram', 'Twitter'],
    '16:9': ['YouTube', 'LinkedIn'],
  }
  return platforms[ratio]
}
