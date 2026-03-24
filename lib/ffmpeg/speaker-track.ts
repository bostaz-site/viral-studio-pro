// ── Speaker Tracking & Dynamic Zoom ──────────────────────────────────────────
//
// FFmpeg filter chains for:
// 1. Smart Crop — centers speaker assuming they're near center of frame (talking head)
// 2. Dynamic Zoom — `zoompan` filter with configurable zoom points at emphasis timestamps
// 3. Speaker Center — crops 9:16 from a wider source, biasing toward detected face region
//
// Note: true face detection requires ML (OpenCV/MediaPipe). These helpers use
// FFmpeg-native heuristics that work well for talking-head content (centered speaker).

export interface ZoomPoint {
  /** Timestamp in the clip (seconds, relative to clip start) */
  time: number
  /** Zoom level: 1.0 = no zoom, 1.3 = 30% in, 1.5 = 50% in */
  zoomLevel: number
  /** Duration of the zoom transition (seconds) */
  transitionDuration: number
}

export interface SpeakerTrackOptions {
  /** Width of the source video */
  inputWidth: number
  /** Height of the source video */
  inputHeight: number
  /** Target width (default 1080 for 9:16) */
  targetWidth?: number
  /** Target height (default 1920 for 9:16) */
  targetHeight?: number
  /** Timestamps where emphasis zoom should trigger */
  zoomPoints?: ZoomPoint[]
  /** Smoothing factor for tracking (higher = smoother, more lag). 0-1, default 0.05 */
  smoothing?: number
}

// ── Smart Crop (speaker centering for 9:16) ───────────────────────────────────
//
// Crops the center-top third of the frame where most speakers appear.
// Uses `crop` with a slight upward bias (y=0.15*H instead of center).

export function buildSpeakerCropFilter(opts: SpeakerTrackOptions): string {
  const {
    inputWidth,
    inputHeight,
    targetWidth = 1080,
    targetHeight = 1920,
  } = opts

  const targetAR = targetWidth / targetHeight
  const cropWidth = Math.min(inputWidth, Math.round(inputHeight * targetAR))
  const cropHeight = Math.min(inputHeight, Math.round(inputWidth / targetAR))

  // Center horizontally, bias 15% upward from center vertically (speaker face)
  const cx = Math.round((inputWidth - cropWidth) / 2)
  const cy = Math.max(0, Math.round((inputHeight - cropHeight) * 0.35))

  // Use `crop` + `scale` to hit exact target dimensions
  return [
    `crop=${cropWidth}:${cropHeight}:${cx}:${cy}`,
    `scale=${targetWidth}:${targetHeight}:flags=lanczos`,
    // Very subtle slow-pan stabilization using `avgblur` on motion (placeholder for real tracking)
    `setsar=1`,
  ].join(',')
}

// ── Dynamic Zoom (zoompan-based) ──────────────────────────────────────────────
//
// Builds a zoompan expression that ramps zoom in/out at specified timestamps.
// Falls back to a subtle "breathing" zoom if no zoomPoints provided.

export function buildDynamicZoomFilter(opts: {
  fps?: number
  duration: number
  zoomPoints?: ZoomPoint[]
  targetWidth?: number
  targetHeight?: number
}): string {
  const { fps = 30, duration, zoomPoints = [], targetWidth = 1080, targetHeight = 1920 } = opts

  if (zoomPoints.length === 0) {
    // Breathing zoom: slow 1.0 → 1.08 → 1.0 over the full duration
    // Using a sine wave: z='1+0.04*sin(2*PI*t/${duration/2})'
    const halfPeriod = Math.max(duration / 2, 1)
    return [
      `zoompan=z='1+0.04*sin(2*PI*t/${halfPeriod.toFixed(1)})'` +
        `:x='iw/2-(iw/zoom/2)'` +
        `:y='ih/2-(ih/zoom/2)'` +
        `:d=1:fps=${fps}:s=${targetWidth}x${targetHeight}`,
    ].join(',')
  }

  // Build piecewise zoom expression using conditional easing
  // For each zoom point, ramp from previous zoom to target zoom over transitionDuration frames
  // z = 'if(between(t,t0,t1), lerp(z0, z1, (t-t0)/(t1-t0)), ...)'
  let zExpr = '1'

  const sorted = [...zoomPoints].sort((a, b) => a.time - b.time)

  sorted.forEach((pt, i) => {
    const t0 = pt.time
    const t1 = t0 + pt.transitionDuration
    const prevZoom = i === 0 ? 1.0 : sorted[i - 1].zoomLevel
    const nextZoom = pt.zoomLevel

    // Linear interpolation between prevZoom → nextZoom over [t0, t1], hold at nextZoom after
    zExpr =
      `if(between(t,${t0.toFixed(2)},${t1.toFixed(2)}),` +
        `${prevZoom.toFixed(3)}+(${(nextZoom - prevZoom).toFixed(3)}*(t-${t0.toFixed(2)})/${pt.transitionDuration.toFixed(2)}),` +
        `if(gte(t,${t1.toFixed(2)}),${nextZoom.toFixed(3)},${zExpr}))`
  })

  return (
    `zoompan=z='min(max(${zExpr},1),2)'` +
    `:x='iw/2-(iw/zoom/2)'` +
    `:y='ih/4-(ih/zoom/4)'` +   // bias upward toward speaker face
    `:d=1:fps=${fps}:s=${targetWidth}x${targetHeight}`
  )
}

// ── Combined Smart Zoom filter string ─────────────────────────────────────────
//
// Returns the full vf filter string to replace scale+crop in the render pipeline.

export function buildSmartZoomFilters(opts: {
  inputWidth: number
  inputHeight: number
  duration: number
  zoomPoints?: ZoomPoint[]
  fps?: number
}): string {
  // inputWidth/inputHeight inform the prescale strategy (currently fixed at 1920)
  const { duration, zoomPoints, fps = 30 } = opts

  // Step 1: scale up to at least 1920x1920 (so zoompan has room to crop)
  const prescale = `scale=1920:1920:force_original_aspect_ratio=increase:flags=lanczos`

  // Step 2: dynamic zoom via zoompan (operates on 1920x1920 → outputs 1080x1920)
  const zoom = buildDynamicZoomFilter({
    fps,
    duration,
    zoomPoints,
    targetWidth: 1080,
    targetHeight: 1920,
  })

  return [prescale, zoom].join(',')
}

// ── Extract emphasis timestamps from word timestamps ──────────────────────────
//
// Identifies high-emphasis moments from transcription word timestamps.
// Keywords that signal emphasis: "incroyable", "jamais", "toujours", "voilà",
// "attention", "important", "secret", "erreur", numbers + "milliards"...

const EMPHASIS_KEYWORDS = [
  // French
  'jamais', 'toujours', 'attention', 'important', 'secret', 'erreur', 'incroyable',
  'voilà', 'vérité', 'choc', 'problème', 'solution', 'résultat', 'preuve',
  // English
  'never', 'always', 'important', 'secret', 'mistake', 'incredible', 'truth',
  'proof', 'result', 'solution', 'problem', 'warning', 'billion', 'million',
]

export function detectEmphasisTimestamps(
  wordTimestamps: Array<{ word: string; start: number; end: number }>,
  clipStart: number,
  clipEnd: number
): ZoomPoint[] {
  const clipWords = wordTimestamps.filter(
    (w) => w.start >= clipStart && w.end <= clipEnd
  )

  const zoomPoints: ZoomPoint[] = []
  const usedTimes = new Set<number>()

  clipWords.forEach((w) => {
    const clean = w.word.toLowerCase().replace(/[^a-zéèêëàâùûîïôçœæ]/gi, '')
    if (EMPHASIS_KEYWORDS.some((kw) => clean.includes(kw))) {
      const relTime = w.start - clipStart
      // Avoid clustering: skip if within 3s of a previous zoom point
      const tooClose = [...usedTimes].some((t) => Math.abs(t - relTime) < 3)
      if (!tooClose) {
        zoomPoints.push({
          time: relTime,
          zoomLevel: 1.2,
          transitionDuration: 0.4,
        })
        usedTimes.add(relTime)
      }
    }
  })

  return zoomPoints
}
