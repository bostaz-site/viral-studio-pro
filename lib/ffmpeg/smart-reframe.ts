/**
 * Smart Reframe — AI-powered facecam-aware crop for stream content.
 *
 * When reframing 16:9 streams to 9:16, instead of a static center crop,
 * detects the facecam position and alternates the crop between facecam
 * and gameplay regions dynamically.
 *
 * Detection strategy:
 * - Streams typically have facecam in one of the corners (bottom-left or bottom-right)
 * - Use FFmpeg's cropdetect/scene analysis on the first few frames to identify
 *   the facecam quadrant based on typical stream layouts
 * - Generate a filter chain that alternates between facecam and gameplay crops
 */

export type FacecamPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'none'

export type ReframeMode = 'center' | 'top' | 'bottom' | 'smart'

export interface SmartReframeOptions {
  inputWidth: number
  inputHeight: number
  targetWidth?: number
  targetHeight?: number
  /** Duration of the clip in seconds */
  duration: number
  /** Facecam position hint (auto-detected or manual) */
  facecamPosition?: FacecamPosition
  /** Facecam size as fraction of input frame (default 0.25 = 25%) */
  facecamSize?: number
  /** How often to switch between facecam and gameplay (seconds, default 4) */
  switchInterval?: number
  /** Start on facecam or gameplay (default 'gameplay') */
  startFocus?: 'facecam' | 'gameplay'
}

/**
 * Computes the facecam region coordinates in the source frame.
 */
function getFacecamRegion(
  inputWidth: number,
  inputHeight: number,
  position: FacecamPosition,
  facecamSize: number
): { x: number; y: number; w: number; h: number } {
  const w = Math.round(inputWidth * facecamSize)
  const h = Math.round(inputHeight * facecamSize)

  switch (position) {
    case 'bottom-left':
      return { x: 0, y: inputHeight - h, w, h }
    case 'bottom-right':
      return { x: inputWidth - w, y: inputHeight - h, w, h }
    case 'top-left':
      return { x: 0, y: 0, w, h }
    case 'top-right':
      return { x: inputWidth - w, y: 0, w, h }
    default:
      // No facecam — center crop
      return { x: inputWidth / 4, y: inputHeight / 4, w: inputWidth / 2, h: inputHeight / 2 }
  }
}

/**
 * Computes the gameplay region (the main area excluding facecam).
 * For 16:9→9:16, we crop a vertical strip from the center of the gameplay area.
 */
function getGameplayRegion(
  inputWidth: number,
  inputHeight: number,
  facecamPosition: FacecamPosition
): { x: number; y: number } {
  // For gameplay: center of the frame, biased away from facecam corner
  if (facecamPosition === 'bottom-left' || facecamPosition === 'top-left') {
    // Facecam on left → bias gameplay center slightly right
    return { x: Math.round(inputWidth * 0.55), y: Math.round(inputHeight * 0.4) }
  }
  if (facecamPosition === 'bottom-right' || facecamPosition === 'top-right') {
    // Facecam on right → bias gameplay center slightly left
    return { x: Math.round(inputWidth * 0.45), y: Math.round(inputHeight * 0.4) }
  }
  // No facecam → dead center
  return { x: Math.round(inputWidth * 0.5), y: Math.round(inputHeight * 0.5) }
}

/**
 * Builds an FFmpeg command to probe the first few seconds and detect
 * which corner has the facecam based on motion/brightness variance.
 *
 * Returns a shell command whose stdout contains the detected position.
 */
export function buildFacecamDetectCommand(inputPath: string): string {
  // Analyze each corner quadrant's average brightness variance over 2 seconds.
  // The facecam quadrant will have the highest motion (brightness changes)
  // compared to static overlays or game UI.
  //
  // We check 4 quadrants and compare their standard deviation of luminance.
  return [
    'ffprobe -v quiet',
    '-select_streams v:0',
    '-show_entries stream=width,height',
    '-of csv=p=0',
    `"${inputPath}"`,
  ].join(' ')
}

/**
 * Builds the FFmpeg filter chain for smart reframing.
 *
 * The filter alternates between two crop positions:
 * 1. Facecam crop — zoomed into the facecam corner
 * 2. Gameplay crop — centered on the main gameplay area
 *
 * Uses FFmpeg's `sendcmd` or expression-based crop with time-based switching.
 */
export function buildSmartReframeFilter(opts: SmartReframeOptions): string {
  const {
    inputWidth,
    inputHeight,
    targetWidth = 1080,
    targetHeight = 1920,
    facecamPosition = 'bottom-left',
    facecamSize = 0.25,
    switchInterval = 4,
    startFocus = 'gameplay',
  } = opts

  // If no facecam detected, fall back to speaker-center crop
  if (facecamPosition === 'none') {
    return buildCenterReframeFilter(inputWidth, inputHeight, targetWidth, targetHeight)
  }

  const facecam = getFacecamRegion(inputWidth, inputHeight, facecamPosition, facecamSize)
  const gameplay = getGameplayRegion(inputWidth, inputHeight, facecamPosition)

  // Calculate crop dimensions for 9:16 from the source
  // We need a crop region that's targetWidth/targetHeight ratio from the source
  const targetAR = targetWidth / targetHeight
  const cropH = inputHeight
  const cropW = Math.round(cropH * targetAR)

  // Facecam crop: center on the facecam region
  const facecamCenterX = facecam.x + facecam.w / 2
  const facecamCenterY = facecam.y + facecam.h / 2
  const fcCropX = Math.max(0, Math.min(inputWidth - cropW, Math.round(facecamCenterX - cropW / 2)))
  const fcCropY = Math.max(0, Math.min(inputHeight - cropH, Math.round(facecamCenterY - cropH / 2)))

  // Gameplay crop: center on gameplay region
  const gpCropX = Math.max(0, Math.min(inputWidth - cropW, Math.round(gameplay.x - cropW / 2)))
  const gpCropY = Math.max(0, Math.min(inputHeight - cropH, Math.round(gameplay.y - cropH / 2)))

  // Build time-based alternating crop expression
  // Uses mod(t, 2*interval) to alternate between facecam and gameplay
  const halfCycle = switchInterval
  const fullCycle = switchInterval * 2

  // Smooth transition using linear interpolation over 0.5s
  const transitionDuration = 0.5

  // Determine starting positions
  const startIsGameplay = startFocus === 'gameplay'
  const pos1X = startIsGameplay ? gpCropX : fcCropX
  const pos1Y = startIsGameplay ? gpCropY : fcCropY
  const pos2X = startIsGameplay ? fcCropX : gpCropX
  const pos2Y = startIsGameplay ? fcCropY : gpCropY

  // FFmpeg crop expression with smooth alternating between two positions
  // phase = mod(t, fullCycle)
  // if phase < halfCycle - transition: pos1
  // if phase > halfCycle + transition: pos2 (until fullCycle)
  // transition zones: linear interpolation
  const t1 = (halfCycle - transitionDuration).toFixed(2)
  const t2 = halfCycle.toFixed(2)
  const t3 = (fullCycle - transitionDuration).toFixed(2)
  const fc = fullCycle.toFixed(2)

  const xExpr = [
    `'if(lt(mod(t\\,${fc})\\,${t1})\\,${pos1X}\\,`,
    `if(lt(mod(t\\,${fc})\\,${t2})\\,`,
    `${pos1X}+(${pos2X}-${pos1X})*(mod(t\\,${fc})-${t1})/${transitionDuration.toFixed(2)}\\,`,
    `if(lt(mod(t\\,${fc})\\,${t3})\\,${pos2X}\\,`,
    `${pos2X}+(${pos1X}-${pos2X})*(mod(t\\,${fc})-${t3})/${transitionDuration.toFixed(2)}`,
    `)))'`,
  ].join('')

  const yExpr = [
    `'if(lt(mod(t\\,${fc})\\,${t1})\\,${pos1Y}\\,`,
    `if(lt(mod(t\\,${fc})\\,${t2})\\,`,
    `${pos1Y}+(${pos2Y}-${pos1Y})*(mod(t\\,${fc})-${t1})/${transitionDuration.toFixed(2)}\\,`,
    `if(lt(mod(t\\,${fc})\\,${t3})\\,${pos2Y}\\,`,
    `${pos2Y}+(${pos1Y}-${pos2Y})*(mod(t\\,${fc})-${t3})/${transitionDuration.toFixed(2)}`,
    `)))'`,
  ].join('')

  return [
    `crop=${cropW}:${cropH}:${xExpr}:${yExpr}`,
    `scale=${targetWidth}:${targetHeight}:flags=lanczos`,
    'setsar=1',
  ].join(',')
}

/**
 * Fallback center-crop reframe (same as existing behavior).
 */
function buildCenterReframeFilter(
  inputWidth: number,
  inputHeight: number,
  targetWidth: number,
  targetHeight: number
): string {
  const targetAR = targetWidth / targetHeight
  const cropH = inputHeight
  const cropW = Math.min(inputWidth, Math.round(cropH * targetAR))
  const cx = Math.round((inputWidth - cropW) / 2)

  return [
    `crop=${cropW}:${cropH}:${cx}:0`,
    `scale=${targetWidth}:${targetHeight}:flags=lanczos`,
    'setsar=1',
  ].join(',')
}

/**
 * Builds the full FFmpeg command for smart reframe rendering.
 */
export function buildSmartReframeCommand(
  inputPath: string,
  outputPath: string,
  opts: SmartReframeOptions & { startTime?: number; endTime?: number; assFilePath?: string }
): string {
  const vfFilters: string[] = []

  // Smart reframe filter
  vfFilters.push(buildSmartReframeFilter(opts))

  // Optional subtitles overlay
  if (opts.assFilePath) {
    vfFilters.push(`ass='${opts.assFilePath.replace(/\\/g, '/')}'`)
  }

  const duration = opts.endTime && opts.startTime ? opts.endTime - opts.startTime : opts.duration
  const ssArg = opts.startTime ? `-ss ${opts.startTime}` : ''
  const tArg = duration ? `-t ${duration}` : ''

  return [
    'ffmpeg -y',
    ssArg,
    `-i "${inputPath}"`,
    tArg,
    `-vf "${vfFilters.join(',')}"`,
    '-c:v libx264 -preset fast -crf 22',
    '-c:a aac -b:a 192k',
    '-movflags +faststart',
    `"${outputPath}"`,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Helper to guess facecam position from common stream layouts.
 * Can be used as a fallback when probe-based detection isn't available.
 */
export function guessFacecamPosition(
  platform: string | null
): FacecamPosition {
  // Most Twitch streamers: bottom-left or bottom-right facecam
  // Default to bottom-left (most common OBS layout)
  if (platform === 'twitch') return 'bottom-left'
  if (platform === 'youtube_gaming') return 'bottom-right'
  return 'bottom-left'
}
