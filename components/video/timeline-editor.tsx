"use client"

import { useRef, useEffect, useState, useCallback } from 'react'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface TimelineSegment {
  id: string
  start: number
  end: number
  title: string | null
  score: number | null
}

interface TimelineEditorProps {
  segments: TimelineSegment[]
  duration: number
  seedId?: string
  onSegmentsChange?: (segments: TimelineSegment[]) => void
  onSegmentClick?: (segment: TimelineSegment) => void
  currentTime?: number
  className?: string
}

// Seeded pseudo-random for consistent waveform per clip
function seededRng(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((Math.imul(31, h) + seed.charCodeAt(i)) | 0) >>> 0
  }
  return () => {
    h ^= h << 13
    h ^= h >> 17
    h ^= h << 5
    return (h >>> 0) / 0xffffffff
  }
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function getSegmentColor(score: number | null): string {
  if (!score) return 'bg-primary/50 border-primary/60'
  if (score >= 70) return 'bg-green-500/40 border-green-400/70'
  if (score >= 40) return 'bg-yellow-500/40 border-yellow-400/70'
  return 'bg-red-500/40 border-red-400/70'
}

export function TimelineEditor({
  segments,
  duration,
  seedId = 'default',
  onSegmentsChange,
  onSegmentClick,
  currentTime,
  className,
}: TimelineEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [localSegments, setLocalSegments] = useState<TimelineSegment[]>(segments)

  // Drag state (ref to avoid re-renders)
  const dragRef = useRef<{
    segIndex: number
    handle: 'start' | 'end'
    startX: number
    origTime: number
  } | null>(null)

  // Sync external segments
  useEffect(() => { setLocalSegments(segments) }, [segments])

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const rng = seededRng(seedId)
    const barCount = Math.floor(W / 3)

    ctx.clearRect(0, 0, W, H)

    for (let i = 0; i < barCount; i++) {
      const height = (0.15 + rng() * 0.7) * H
      const x = i * 3
      const y = (H - height) / 2

      ctx.fillStyle = `rgba(99, 102, 241, ${0.3 + rng() * 0.5})`
      ctx.fillRect(x, y, 2, height)
    }
  }, [seedId])

  // Time ↔ pixel helpers
  const timeToPercent = useCallback(
    (t: number) => Math.min(1, Math.max(0, t / Math.max(1, duration))),
    [duration]
  )

  // Mouse handlers for dragging segment handles
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, segIndex: number, handle: 'start' | 'end') => {
      e.preventDefault()
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      dragRef.current = {
        segIndex,
        handle,
        startX: e.clientX - rect.left,
        origTime: handle === 'start' ? localSegments[segIndex].start : localSegments[segIndex].end,
      }
    },
    [localSegments]
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const dx = x - dragRef.current.startX
      const dt = (dx / rect.width) * duration

      setLocalSegments((prev) => {
        const updated = prev.map((seg, i) => {
          if (i !== dragRef.current!.segIndex) return seg
          if (dragRef.current!.handle === 'start') {
            const newStart = Math.min(
              Math.max(0, dragRef.current!.origTime + dt),
              seg.end - 1
            )
            return { ...seg, start: Math.round(newStart * 10) / 10 }
          } else {
            const newEnd = Math.max(
              Math.min(duration, dragRef.current!.origTime + dt),
              seg.start + 1
            )
            return { ...seg, end: Math.round(newEnd * 10) / 10 }
          }
        })
        return updated
      })
    }

    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null
        onSegmentsChange?.(localSegments)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [duration, localSegments, onSegmentsChange])

  // Time ruler ticks
  const tickInterval = duration <= 30 ? 5 : duration <= 120 ? 15 : 30
  const ticks = Array.from(
    { length: Math.floor(duration / tickInterval) + 1 },
    (_, i) => i * tickInterval
  )

  return (
    <div className={cn('space-y-2', className)}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Timeline  {localSegments.length} segment{localSegments.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setZoom(1); setLocalSegments(segments) }}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Timeline container */}
      <div className="border border-border rounded-xl bg-card/50 overflow-hidden select-none">
        <div
          ref={containerRef}
          className="relative overflow-x-auto"
          style={{ minHeight: '120px' }}
        >
          <div style={{ width: `${100 * zoom}%`, minWidth: '100%', position: 'relative' }}>
            {/* Waveform */}
            <canvas
              ref={canvasRef}
              width={800}
              height={48}
              className="w-full h-12 block"
            />

            {/* Segments track */}
            <div className="relative h-12 bg-muted/20 mx-0">
              {/* Playhead */}
              {currentTime !== undefined && duration > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-primary z-10 pointer-events-none"
                  style={{ left: `${timeToPercent(currentTime) * 100}%` }}
                />
              )}

              {localSegments.map((seg, i) => {
                const leftPct = timeToPercent(seg.start) * 100
                const widthPct = (timeToPercent(seg.end) - timeToPercent(seg.start)) * 100
                const colorClass = getSegmentColor(seg.score)
                const isActive = currentTime !== undefined && currentTime >= seg.start && currentTime < seg.end

                return (
                  <div
                    key={seg.id}
                    className={cn(
                      'absolute top-1 bottom-1 rounded border flex items-center overflow-hidden transition-opacity',
                      colorClass,
                      onSegmentClick && 'cursor-pointer',
                      isActive && 'ring-1 ring-primary/70'
                    )}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onClick={() => onSegmentClick?.(seg)}
                  >
                    {/* Start handle */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center bg-white/20 hover:bg-white/40 transition-colors"
                      onMouseDown={(e) => handleMouseDown(e, i, 'start')}
                    >
                      <div className="w-0.5 h-4 bg-white/80 rounded" />
                    </div>

                    {/* Label */}
                    <p className="flex-1 text-center text-xs font-medium text-white px-4 truncate">
                      {seg.title ?? `Clip ${i + 1}`}
                      {seg.score !== null && (
                        <span className="ml-1 opacity-70">· {seg.score}</span>
                      )}
                    </p>

                    {/* End handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center bg-white/20 hover:bg-white/40 transition-colors"
                      onMouseDown={(e) => handleMouseDown(e, i, 'end')}
                    >
                      <div className="w-0.5 h-4 bg-white/80 rounded" />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Time ruler */}
            <div className="relative h-6 border-t border-border bg-card/30">
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 flex flex-col items-center"
                  style={{ left: `${timeToPercent(t) * 100}%` }}
                >
                  <div className="w-px h-2 bg-border" />
                  <span className="text-[10px] text-muted-foreground mt-0.5 -translate-x-1/2">
                    {formatTime(t)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Segment details */}
      {localSegments.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {localSegments.map((seg, i) => (
            <div key={seg.id} className="flex items-center gap-1.5 text-xs bg-muted/30 rounded-lg px-3 py-1.5 border border-border">
              <span className="font-medium text-foreground">Clip {i + 1}</span>
              <span className="text-muted-foreground">
                {formatTime(seg.start)} – {formatTime(seg.end)}
              </span>
              <span className="text-muted-foreground/60">
                ({Math.round(seg.end - seg.start)}s)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
