'use client'

import { useRef, useEffect, useCallback } from 'react'
import { trackEvent } from '@/lib/partner/repost-kit/tracker'
import { Download } from 'lucide-react'

interface VideoPlayerTrackedProps {
  videoUrl: string | null
  onDownloaded: () => void
}

export function VideoPlayerTracked({ videoUrl, onDownloaded }: VideoPlayerTrackedProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const milestonesHit = useRef(new Set<string>())

  const checkMilestones = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.duration) return

    const pct = (video.currentTime / video.duration) * 100
    const milestones = [
      { pct: 25, event: 'video_25_percent' },
      { pct: 50, event: 'video_50_percent' },
      { pct: 75, event: 'video_75_percent' },
      { pct: 99, event: 'video_completed' },
    ]

    for (const m of milestones) {
      if (pct >= m.pct && !milestonesHit.current.has(m.event)) {
        milestonesHit.current.add(m.event)
        trackEvent(m.event)
      }
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onPlay = () => trackEvent('video_played')
    const onTimeUpdate = () => checkMilestones()

    video.addEventListener('play', onPlay)
    video.addEventListener('timeupdate', onTimeUpdate)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [checkMilestones])

  const handleDownload = (quality: 'hd' | 'mobile') => {
    trackEvent(quality === 'hd' ? 'download_hd_clicked' : 'download_mobile_clicked')
    onDownloaded()
    if (videoUrl) {
      window.open(videoUrl, '_blank')
    }
  }

  return (
    <div className="space-y-3">
      {/* Video */}
      <div className="rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[50vh] mx-auto">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            muted
            autoPlay
            preload="metadata"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
            Preview video coming soon
          </div>
        )}
      </div>

      <p className="text-center text-xs text-zinc-500">Time to post: ~45 seconds</p>

      {/* Download buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleDownload('hd')}
          className="rounded-lg bg-amber-500 text-amber-950 py-3 text-sm font-semibold hover:bg-amber-400 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Download className="h-4 w-4" />
          Download HD
        </button>
        <button
          onClick={() => handleDownload('mobile')}
          className="rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-200 py-3 text-sm font-medium hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Download className="h-4 w-4" />
          Mobile
        </button>
      </div>
    </div>
  )
}
