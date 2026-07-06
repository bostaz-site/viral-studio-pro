'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

// ── SVG paths extracted from public/viral_animal_wolf_trace.svg ──────────────
const CONTOUR = 'M 16.0 5.0 L 16.0 46.0 L 21.0 63.0 L 27.0 59.0 L 24.0 27.0 L 41.0 53.0 L 35.0 53.0 L 36.0 69.0 L 28.0 63.0 L 8.0 80.0 L 17.0 85.0 L 4.0 103.0 L 14.0 102.0 L 14.0 112.0 L 31.0 111.0 L 28.0 101.0 L 40.0 111.0 L 41.0 106.0 L 50.0 112.0 L 49.0 125.0 L 62.0 149.0 L 63.0 142.0 L 71.0 138.0 L 62.0 126.0 L 64.0 122.0 L 85.0 123.0 L 77.0 137.0 L 84.0 141.0 L 86.0 149.0 L 98.0 127.0 L 96.0 111.0 L 106.0 106.0 L 108.0 110.0 L 119.0 101.0 L 116.0 111.0 L 134.0 112.0 L 132.0 103.0 L 144.0 103.0 L 130.0 85.0 L 139.0 80.0 L 119.0 63.0 L 111.0 69.0 L 113.0 53.0 L 106.0 53.0 L 123.0 27.0 L 120.0 59.0 L 126.0 64.0 L 131.0 44.0 L 130.0 4.0 L 88.0 41.0 L 59.0 41.0 Z'
const JAW = 'M 51.0 137.0 L 56.0 163.0 L 64.0 173.0 L 64.0 172.0 L 66.0 171.0 L 72.0 177.0 L 74.0 178.0 L 76.0 177.0 L 81.0 172.0 L 83.0 173.0 L 89.0 167.0 L 92.0 162.0 L 92.0 159.0 L 93.0 158.0 L 93.0 153.0 L 94.0 152.0 L 94.0 148.0 L 95.0 147.0 L 96.0 138.0 L 94.0 142.0 L 94.0 145.0 L 91.0 150.0 L 90.0 155.0 L 87.0 160.0 L 85.0 159.0 L 83.0 153.0 L 82.0 157.0 L 81.0 158.0 L 81.0 161.0 L 79.0 164.0 L 68.0 164.0 L 67.0 163.0 L 67.0 159.0 L 66.0 158.0 L 65.0 153.0 L 62.0 160.0 L 61.0 160.0 L 59.0 158.0 L 58.0 154.0 L 56.0 151.0 L 55.0 146.0 L 53.0 143.0 L 52.0 138.0 Z'
const EYE_RIGHT = 'M 110.0 82.0 L 110.0 83.0 L 109.0 84.0 L 109.0 86.0 L 108.0 87.0 L 108.0 89.0 L 107.0 90.0 L 107.0 91.0 L 106.0 92.0 L 105.0 95.0 L 103.0 97.0 L 101.0 97.0 L 100.0 98.0 L 95.0 98.0 L 94.0 99.0 L 91.0 100.0 L 91.0 101.0 L 90.0 102.0 L 89.0 102.0 L 87.0 104.0 L 86.0 104.0 L 85.0 103.0 L 85.0 101.0 L 86.0 100.0 L 86.0 96.0 L 89.0 93.0 L 90.0 93.0 L 92.0 91.0 L 93.0 91.0 L 95.0 89.0 L 96.0 89.0 L 98.0 87.0 L 99.0 87.0 L 104.0 83.0 L 105.0 83.0 L 108.0 81.0 L 109.0 81.0 Z'
const EYE_LEFT = 'M 38.0 82.0 L 39.0 81.0 L 42.0 82.0 L 44.0 84.0 L 45.0 84.0 L 47.0 86.0 L 48.0 86.0 L 50.0 88.0 L 51.0 88.0 L 53.0 90.0 L 54.0 90.0 L 56.0 92.0 L 57.0 92.0 L 59.0 94.0 L 60.0 94.0 L 61.0 95.0 L 61.0 98.0 L 62.0 99.0 L 62.0 103.0 L 61.0 104.0 L 60.0 104.0 L 55.0 99.0 L 52.0 99.0 L 51.0 98.0 L 47.0 98.0 L 46.0 97.0 L 45.0 97.0 L 42.0 94.0 L 42.0 93.0 L 40.0 90.0 L 40.0 88.0 L 38.0 85.0 Z'
const CHEEK_LEFT = 'M 28.0 116.0 L 31.0 117.0 L 33.0 119.0 L 34.0 119.0 L 36.0 121.0 L 37.0 121.0 L 37.0 119.0 L 36.0 118.0 L 36.0 116.0 L 34.0 113.0 L 32.0 113.0 L 30.0 115.0 L 29.0 115.0 Z'
const CHEEK_RIGHT = 'M 119.0 116.0 L 118.0 115.0 L 117.0 115.0 L 115.0 113.0 L 113.0 113.0 L 113.0 114.0 L 112.0 115.0 L 112.0 117.0 L 111.0 118.0 L 111.0 120.0 L 110.0 121.0 L 113.0 120.0 L 115.0 118.0 L 116.0 118.0 L 118.0 116.0 Z'
const EYE_DETAIL_RIGHT = 'M 103.0 88.0 L 100.0 89.0 L 98.0 91.0 L 97.0 91.0 L 95.0 93.0 L 94.0 93.0 L 93.0 94.0 L 99.0 94.0 L 100.0 93.0 L 101.0 93.0 L 102.0 92.0 L 102.0 90.0 L 103.0 89.0 Z'
const EYE_DETAIL_LEFT = 'M 45.0 88.0 L 45.0 90.0 L 46.0 91.0 L 46.0 92.0 L 48.0 94.0 L 54.0 94.0 L 52.0 92.0 L 51.0 92.0 L 49.0 90.0 L 48.0 90.0 Z'

// ── Size map ────────────────────────────────────────────────────────────────
const SIZE_MAP = { sm: 20, md: 48, lg: 280 } as const

// ── Color palettes ──────────────────────────────────────────────────────────
type Palette = { light: string; mid: string; dark: string }

const PALETTES: Record<'amber' | 'system', Palette> = {
  amber: { light: '#fbbf24', mid: '#f59e0b', dark: '#d97706' },
  system: { light: '#67e8f9', mid: '#22d3ee', dark: '#0891b2' },
}

type WolfLoaderProps = {
  variant?: 'spinner' | 'sequence' | 'cinematic'
  size?: 'sm' | 'md' | 'lg' | number
  mode?: 'amber' | 'system'
  progress?: number
  label?: string
  className?: string
}

// ── Unique ID generator for SVG gradients ───────────────────────────────────
let idCounter = 0
function useUniqueId(prefix: string) {
  const ref = useRef('')
  if (!ref.current) {
    ref.current = `${prefix}-${++idCounter}-${Math.random().toString(36).slice(2, 6)}`
  }
  return ref.current
}

// ── SPINNER VARIANT ─────────────────────────────────────────────────────────
function WolfSpinner({ pxSize, palette, gradId }: {
  pxSize: number
  palette: Palette
  gradId: string
}) {
  return (
    <svg
      viewBox="0 0 149 183"
      width={pxSize}
      height={pxSize * (183 / 149)}
      fill="none"
      className="wolf-loader-spinner"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="50%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
      </defs>
      <path
        d={CONTOUR}
        stroke={`url(#${gradId})`}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="wolf-loader-spinner-path"
      />
      <style>{`
        .wolf-loader-spinner-path {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: wolfTrace 1.2s ease-in-out infinite;
        }
        @keyframes wolfTrace {
          0% { stroke-dashoffset: 1200; }
          50% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -1200; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wolf-loader-spinner-path {
            animation: none;
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </svg>
  )
}

// ── SEQUENCE / CINEMATIC VARIANT ────────────────────────────────────────────
type Phase = 'trace' | 'details' | 'eyes' | 'online'

const SEQUENCE_TIMINGS = { trace: 1200, details: 450, eyes: 300, hold: 550 }
const CINEMATIC_TIMINGS = { trace: 2200, details: 600, eyes: 500, hold: 1200 }

const PHASE_LABELS: Record<Phase, string> = {
  trace: 'TRACING SIGNAL\u2026',
  details: 'CARVING TRACE\u2026',
  eyes: 'WOLF ONLINE',
  online: 'WOLF ONLINE',
}

function WolfSequence({ pxSize, palette, gradId, cinematic, progress, label }: {
  pxSize: number
  palette: Palette
  gradId: string
  cinematic: boolean
  progress?: number
  label?: string
}) {
  const timings = cinematic ? CINEMATIC_TIMINGS : SEQUENCE_TIMINGS
  const totalCycle = timings.trace + timings.details + timings.eyes + timings.hold

  const contourRef = useRef<SVGPathElement>(null)
  const jawRef = useRef<SVGPathElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const [cometPos, setCometPos] = useState({ x: 16, y: 5 })
  const [phase, setPhase] = useState<Phase>('trace')
  const [traceProgress, setTraceProgress] = useState(0)
  const [detailProgress, setDetailProgress] = useState(0)
  const [eyeOpacity, setEyeOpacity] = useState(0)
  const [flashOpacity, setFlashOpacity] = useState(0)
  const [contourLength, setContourLength] = useState(1200)
  const [jawLength, setJawLength] = useState(300)

  useEffect(() => {
    if (contourRef.current) setContourLength(contourRef.current.getTotalLength())
    if (jawRef.current) setJawLength(jawRef.current.getTotalLength())
  }, [])

  const animate = useCallback((timestamp: number) => {
    if (!startRef.current) startRef.current = timestamp
    const elapsed = (timestamp - startRef.current) % totalCycle

    // If progress prop is set, use it to control trace speed
    const effectiveTraceTime = progress !== undefined
      ? timings.trace * (1 - progress / 100 * 0.5) // faster when progress is high
      : timings.trace

    if (elapsed < effectiveTraceTime) {
      // Phase: trace contour
      const t = elapsed / effectiveTraceTime
      setPhase('trace')
      setTraceProgress(t)
      setDetailProgress(0)
      setEyeOpacity(0)
      setFlashOpacity(0)

      // Move comet along path
      if (contourRef.current) {
        const pt = contourRef.current.getPointAtLength(t * contourLength)
        setCometPos({ x: pt.x, y: pt.y })
      }
    } else if (elapsed < effectiveTraceTime + timings.details) {
      // Phase: details (jaw + cheeks)
      const t = (elapsed - effectiveTraceTime) / timings.details
      setPhase('details')
      setTraceProgress(1)
      setDetailProgress(t)
      setEyeOpacity(0)
      setFlashOpacity(0)

      // Move comet along jaw
      if (jawRef.current) {
        const pt = jawRef.current.getPointAtLength(t * jawLength)
        setCometPos({ x: pt.x, y: pt.y })
      }
    } else if (elapsed < effectiveTraceTime + timings.details + timings.eyes) {
      // Phase: eyes
      const t = (elapsed - effectiveTraceTime - timings.details) / timings.eyes
      setPhase('eyes')
      setTraceProgress(1)
      setDetailProgress(1)
      setEyeOpacity(t)
      setFlashOpacity(0)
      setCometPos({ x: -10, y: -10 }) // hide comet
    } else {
      // Phase: online / hold
      const t = (elapsed - effectiveTraceTime - timings.details - timings.eyes) / timings.hold
      setPhase('online')
      setTraceProgress(1)
      setDetailProgress(1)
      setEyeOpacity(1)
      // Flash peaks at 0.3, then fades
      setFlashOpacity(t < 0.3 ? t / 0.3 * 0.42 : 0.42 * (1 - (t - 0.3) / 0.7))
      setCometPos({ x: -10, y: -10 })
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [totalCycle, timings, progress, contourLength, jawLength])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [animate])

  const showText = pxSize >= 80
  const currentLabel = label || PHASE_LABELS[phase]
  const contourOffset = contourLength * (1 - traceProgress)
  const jawOffset = jawLength * (1 - detailProgress)
  const detailOpacity = detailProgress

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 149 183"
        width={pxSize}
        height={pxSize * (183 / 149)}
        fill="none"
        className="wolf-loader-sequence"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.light} />
            <stop offset="50%" stopColor={palette.mid} />
            <stop offset="100%" stopColor={palette.dark} />
          </linearGradient>
          <filter id={`${gradId}-glow`}>
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={palette.mid} floodOpacity="0.4" />
            <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor={palette.light} floodOpacity="0.2" />
          </filter>
          <filter id={`${gradId}-comet`}>
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Flash silhouette */}
        {flashOpacity > 0 && (
          <path
            d={CONTOUR}
            fill={palette.mid}
            opacity={flashOpacity}
            filter={`url(#${gradId}-glow)`}
          />
        )}

        {/* Contour trace */}
        <path
          ref={contourRef}
          d={CONTOUR}
          stroke={`url(#${gradId})`}
          strokeWidth={2.1}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={contourLength}
          strokeDashoffset={contourOffset}
          filter={`url(#${gradId}-glow)`}
        />

        {/* Jaw */}
        <path
          ref={jawRef}
          d={JAW}
          stroke={palette.mid}
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={jawLength}
          strokeDashoffset={jawOffset}
          opacity={traceProgress >= 1 ? 1 : 0}
          filter={`url(#${gradId}-glow)`}
        />

        {/* Cheeks */}
        <path
          d={CHEEK_LEFT}
          stroke={palette.mid}
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={detailOpacity}
          filter={`url(#${gradId}-glow)`}
        />
        <path
          d={CHEEK_RIGHT}
          stroke={palette.mid}
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={detailOpacity}
          filter={`url(#${gradId}-glow)`}
        />

        {/* Eyes */}
        <path
          d={EYE_LEFT}
          stroke={palette.light}
          strokeWidth={1.35}
          fill={palette.light}
          fillOpacity={eyeOpacity * 0.6}
          opacity={eyeOpacity}
          filter={`url(#${gradId}-glow)`}
        />
        <path
          d={EYE_RIGHT}
          stroke={palette.light}
          strokeWidth={1.35}
          fill={palette.light}
          fillOpacity={eyeOpacity * 0.6}
          opacity={eyeOpacity}
          filter={`url(#${gradId}-glow)`}
        />
        <path
          d={EYE_DETAIL_LEFT}
          fill={palette.light}
          opacity={eyeOpacity}
        />
        <path
          d={EYE_DETAIL_RIGHT}
          fill={palette.light}
          opacity={eyeOpacity}
        />

        {/* Comet */}
        {cometPos.x >= 0 && (
          <circle
            cx={cometPos.x}
            cy={cometPos.y}
            r={4}
            fill={palette.light}
            filter={`url(#${gradId}-comet)`}
            opacity={0.9}
          />
        )}
      </svg>

      {/* Label */}
      {showText && (
        <p
          className="text-[10px] font-mono tracking-[0.2em] uppercase text-center transition-opacity duration-300"
          style={{ color: palette.mid, opacity: phase === 'online' ? 1 : 0.7 }}
        >
          {currentLabel}
        </p>
      )}

      {/* Progress */}
      {progress !== undefined && showText && (
        <p
          className="text-[11px] font-mono tabular-nums"
          style={{ color: palette.dark }}
        >
          {Math.round(progress)}%
        </p>
      )}

      {/* Reduced motion: static full wolf */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .wolf-loader-sequence path {
            stroke-dashoffset: 0 !important;
            opacity: 1 !important;
          }
          .wolf-loader-sequence circle { display: none; }
        }
      `}</style>
    </div>
  )
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
export function WolfLoader({
  variant = 'spinner',
  size = 'md',
  mode = 'amber',
  progress,
  label,
  className,
}: WolfLoaderProps) {
  const pxSize = typeof size === 'number' ? size : SIZE_MAP[size]
  const palette = PALETTES[mode]
  const gradId = useUniqueId('wolf-grad')

  return (
    <div
      role="status"
      aria-label={label || 'Loading'}
      className={cn('inline-flex items-center justify-center', className)}
    >
      {variant === 'spinner' ? (
        <WolfSpinner pxSize={pxSize} palette={palette} gradId={gradId} />
      ) : (
        <WolfSequence
          pxSize={pxSize}
          palette={palette}
          gradId={gradId}
          cinematic={variant === 'cinematic'}
          progress={progress}
          label={label}
        />
      )}
    </div>
  )
}
