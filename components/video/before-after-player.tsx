// TODO: Wire this component into app/(dashboard)/dashboard/enhance/[clipId]/page.tsx (before/after comparison)
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { GripVertical } from 'lucide-react'

interface BeforeAfterPlayerProps {
  originalUrl: string
  renderedUrl: string
  thumbnailUrl?: string | null
  aspectRatio?: string
}

export function BeforeAfterPlayer({ originalUrl, renderedUrl, thumbnailUrl, aspectRatio = '9:16' }: BeforeAfterPlayerProps) {
  const [sliderPos, setSliderPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const beforeRef = useRef<HTMLVideoElement>(null)
  const afterRef = useRef<HTMLVideoElement>(null)

  const ar = aspectRatio === '9:16' ? '9/16' : aspectRatio === '16:9' ? '16/9' : '9/16'

  const updatePos = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setSliderPos(Math.max(5, Math.min(95, pct)))
  }, [])

  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    dragging.current = true

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragging.current) return
      const x = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
      updatePos(x)
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onMove)
    document.addEventListener('touchend', onUp)
  }, [updatePos])

  // Sync both videos so they play at the same timestamp
  useEffect(() => {
    const after = afterRef.current
    const before = beforeRef.current
    if (!after || !before) return

    const sync = () => {
      if (Math.abs(before.currentTime - after.currentTime) > 0.3) {
        before.currentTime = after.currentTime
      }
    }
    after.addEventListener('timeupdate', sync)
    return () => after.removeEventListener('timeupdate', sync)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl bg-black select-none"
      style={{ aspectRatio: ar }}
    >
      {/* Before (original) — visible left of slider */}
      <video
        ref={beforeRef}
        src={originalUrl}
        poster={thumbnailUrl ?? undefined}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        autoPlay
        muted
        loop
        playsInline
      />

      {/* After (rendered) — visible right of slider */}
      <video
        ref={afterRef}
        src={renderedUrl}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
        autoPlay
        muted
        loop
        playsInline
      />

      {/* Slider handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/80 cursor-ew-resize z-10"
        style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
          <GripVertical className="h-4 w-4 text-gray-600" />
        </div>
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 z-10 text-[10px] font-bold tracking-wider text-white/70 bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
        ORIGINAL
      </span>
      <span className="absolute top-3 right-3 z-10 text-[10px] font-bold tracking-wider text-white/70 bg-gradient-to-r from-orange-500/80 to-amber-500/80 px-2 py-0.5 rounded backdrop-blur-sm">
        AI ENHANCED
      </span>
    </div>
  )
}
