/**
 * FFmpeg watermark command builders.
 *
 * Free plan  → text watermark "Viral Studio Pro" (bottom-right corner)
 * Pro/Studio → custom logo image watermark from brand template
 */

export type UserPlan = 'free' | 'pro' | 'studio'

export interface WatermarkOptions {
  inputPath: string
  outputPath: string
  plan: UserPlan
  /** Path to custom logo (PNG with transparency). Required for Pro/Studio if using custom logo. */
  logoPath?: string
  /** Watermark opacity 0-1 (default 0.75) */
  opacity?: number
  /** Corner position (default bottom-right) */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

type Corner = NonNullable<WatermarkOptions['position']>

const CORNER_COORDS: Record<Corner, { x: string; y: string }> = {
  'top-left':     { x: 'W*0.03',           y: 'H*0.03' },
  'top-right':    { x: 'W-tw-W*0.03',      y: 'H*0.03' },
  'bottom-left':  { x: 'W*0.03',           y: 'H-th-H*0.03' },
  'bottom-right': { x: 'W-tw-W*0.03',      y: 'H-th-H*0.03' },
}

const LOGO_CORNER_COORDS: Record<Corner, { x: string; y: string }> = {
  'top-left':     { x: 'W*0.03',           y: 'H*0.03' },
  'top-right':    { x: 'W-overlay_w-W*0.03', y: 'H*0.03' },
  'bottom-left':  { x: 'W*0.03',           y: 'H-overlay_h-H*0.03' },
  'bottom-right': { x: 'W-overlay_w-W*0.03', y: 'H-overlay_h-H*0.03' },
}

/**
 * Builds FFmpeg command to add a text watermark (free plan).
 * Uses `drawtext` filter with semi-transparent white text + dark shadow.
 */
export function buildTextWatermarkCommand(options: WatermarkOptions): string {
  const { inputPath, outputPath, opacity = 0.75, position = 'bottom-right' } = options
  const { x, y } = CORNER_COORDS[position]
  const alpha = opacity.toFixed(2)

  const filter = `drawtext=text='Viral Studio Pro':fontsize=28:fontcolor=white@${alpha}:shadowcolor=black@0.5:shadowx=1:shadowy=1:x=${x}:y=${y}`

  return [
    'ffmpeg -y',
    `-i "${inputPath}"`,
    `-vf "${filter}"`,
    '-c:v libx264 -preset fast -crf 23',
    '-c:a copy',
    '-movflags +faststart',
    `"${outputPath}"`,
  ].join(' ')
}

/**
 * Builds FFmpeg command to overlay a logo image (Pro/Studio plan).
 * The logo is scaled to 8% of video width and placed in the chosen corner.
 */
export function buildLogoWatermarkCommand(options: WatermarkOptions & { logoPath: string }): string {
  const { inputPath, outputPath, logoPath, opacity = 0.85, position = 'bottom-right' } = options
  const { x, y } = LOGO_CORNER_COORDS[position]
  const alpha = opacity.toFixed(2)

  // Scale logo to 8% of video width, keep aspect ratio
  const logoFilter = `[1:v]scale=iw*0.08:-1,format=rgba,colorchannelmixer=aa=${alpha}[logo]`
  const overlayFilter = `[0:v][logo]overlay=${x}:${y}[out]`

  return [
    'ffmpeg -y',
    `-i "${inputPath}"`,
    `-i "${logoPath}"`,
    `-filter_complex "${logoFilter};${overlayFilter}"`,
    '-map "[out]" -map 0:a?',
    '-c:v libx264 -preset fast -crf 23',
    '-c:a copy',
    '-movflags +faststart',
    `"${outputPath}"`,
  ].join(' ')
}

/**
 * Returns the appropriate watermark command based on the user's plan.
 */
export function buildWatermarkCommand(options: WatermarkOptions): string {
  if ((options.plan === 'pro' || options.plan === 'studio') && options.logoPath) {
    return buildLogoWatermarkCommand({ ...options, logoPath: options.logoPath })
  }
  if (options.plan === 'free') {
    return buildTextWatermarkCommand(options)
  }
  // Pro/Studio without custom logo: no watermark
  return ''
}

/**
 * Returns true if a watermark should be applied for this plan.
 */
export function shouldApplyWatermark(plan: UserPlan, hasCustomLogo: boolean): boolean {
  if (plan === 'free') return true
  if ((plan === 'pro' || plan === 'studio') && hasCustomLogo) return true
  return false
}
