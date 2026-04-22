"use client"

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize2, SkipBack, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Public handle exposed via ref ─────────────────────────────────────────────

export interface VideoPlayerHandle {
  /** Jump to `start` and play until `end`, then pause */
  playClip: (start: number, end: number) => void
  /** Return the current playback position */
  getCurrentTime: () => number
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface VideoPlayerProps {
  src: string
  className?: string
  onTimeUpdate?: (time: number) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ src, className, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const clipEndRef = useRef<number | null>(null)

    const [playing, setPlaying] = useState(false)
    const [muted, setMuted] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [bufferedPct, setBufferedPct] = useState(0)
    const [showControls, setShowControls] = useState(true)
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Expose handle to parent
    useImperativeHandle(ref, () => ({
      playClip: (start: number, end: number) => {
        const v = videoRef.current
        if (!v) return
        clipEndRef.current = end
        v.currentTime = start
        v.play().catch(() => null)
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    }))

    // Auto-hide controls after 2.5s of inactivity
    const resetHideTimer = useCallback(() => {
      setShowControls(true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setShowControls(false), 2500)
    }, [])

    useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current) }, [])

    // Wire up video events
    useEffect(() => {
      const v = videoRef.current
      if (!v) return

      const onTimeUpdate = () => {
        setCurrentTime(v.currentTime)
        if (v.buffered.length > 0) {
          setBufferedPct(v.buffered.end(v.buffered.length - 1) / (v.duration || 1))
        }
        // Stop at clip end
        if (clipEndRef.current !== null && v.currentTime >= clipEndRef.current) {
          v.pause()
          clipEndRef.current = null
        }
      }
      const onMeta = () => setDuration(v.duration)
      const onPlay = () => setPlaying(true)
      const onPause = () => setPlaying(false)
      const onEnded = () => { setPlaying(false); clipEndRef.current = null }

      v.addEventListener('timeupdate', onTimeUpdate)
      v.addEventListener('loadedmetadata', onMeta)
      v.addEventListener('play', onPlay)
      v.addEventListener('pause', onPause)
      v.addEventListener('ended', onEnded)

      return () => {
        v.removeEventListener('timeupdate', onTimeUpdate)
        v.removeEventListener('loadedmetadata', onMeta)
        v.removeEventListener('play', onPlay)
        v.removeEventListener('pause', onPause)
        v.removeEventListener('ended', onEnded)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Separate effect for the onTimeUpdate prop (avoids re-adding listeners)
    useEffect(() => {
      const v = videoRef.current
      if (!v || !onTimeUpdate) return
      const cb = () => onTimeUpdate(v.currentTime)
      v.addEventListener('timeupdate', cb)
      return () => v.removeEventListener('timeupdate', cb)
    }, [onTimeUpdate])

    const togglePlay = () => {
      const v = videoRef.current
      if (!v) return
      if (v.paused) v.play().catch(() => null)
      else v.pause()
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = videoRef.current
      if (!v) return
      clipEndRef.current = null
      const t = Number(e.target.value)
      v.currentTime = t
      setCurrentTime(t)
    }

    const toggleMute = () => {
      const v = videoRef.current
      if (!v) return
      v.muted = !v.muted
      setMuted(v.muted)
    }

    const handleFullscreen = () => {
      const el = containerRef.current
      if (!el) return
      if (document.fullscreenElement) document.exitFullscreen()
      else el.requestFullscreen().catch(() => null)
    }

    const skip = (delta: number) => {
      const v = videoRef.current
      if (!v) return
      clipEndRef.current = null
      v.currentTime = Math.max(0, Math.min(duration, v.currentTime + delta))
    }

    const progress = duration > 0 ? currentTime / duration : 0

    return (
      <div
        ref={containerRef}
        className={cn('relative bg-black rounded-xl overflow-hidden', className)}
        onMouseMove={resetHideTimer}
        onMouseEnter={resetHideTimer}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          preload="metadata"
          playsInline
          onClick={togglePlay}
        />

        {/* Big play button overlay when paused */}
        {!playing && (
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
          >
            <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <Play className="h-7 w-7 text-white ml-1" />
            </div>
          </div>
        )}

        {/* Controls bar */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-10 pb-3 px-3 transition-opacity duration-200',
            showControls || !playing ? 'opacity-100' : 'opacity-0'
          )}
        >
          {/* Seek bar */}
          <div className="relative mb-2.5 h-1.5 bg-white/20 rounded-full">
            <div
              className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
              style={{ width: `${bufferedPct * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full pointer-events-none"
              style={{ width: `${progress * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          {/* Button row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => skip(-5)}
              className="text-white/70 hover:text-white transition-colors"
              title="Rewind 5s"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={togglePlay}
              className="text-white hover:text-primary transition-colors"
            >
              {playing
                ? <Pause className="h-5 w-5" />
                : <Play className="h-5 w-5 ml-0.5" />
              }
            </button>

            <button
              onClick={() => skip(5)}
              className="text-white/70 hover:text-white transition-colors"
              title="Forward 5s"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <span className="text-xs text-white/70 font-mono ml-1 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            <button
              onClick={toggleMute}
              className="text-white/70 hover:text-white transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <button
              onClick={handleFullscreen}
              className="text-white/70 hover:text-white transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }
)

VideoPlayer.displayName = 'VideoPlayer'
