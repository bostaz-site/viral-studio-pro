'use client'

import { Play, Clock, BarChart3, Eye, Users, MoreVertical, Pause, Archive, Copy } from 'lucide-react'
import { useState } from 'react'

interface PromoVideo {
  id: string
  title: string
  thumbnail_signed_url: string | null
  duration_seconds: number | null
  aspect_ratio: string | null
  niche: string[]
  hook_type: string | null
  tone: string | null
  status: string
  total_kits_generated: number
  total_views: number
  total_posts: number
  total_signups: number
}

interface VideoCardProps {
  video: PromoVideo
  onSelect: (id: string) => void
  onAction: (id: string, action: 'pause' | 'activate' | 'archive') => void
}

const HOOK_LABELS: Record<string, string> = {
  curiosity: 'Curiosity',
  shock: 'Shock',
  transformation: 'Transform',
  social_proof: 'Social Proof',
  storytelling: 'Story',
  tutorial: 'Tutorial',
  comparison: 'Compare',
  testimonial: 'Testimonial',
}

export function VideoCard({ video, onSelect, onAction }: VideoCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const formatDuration = (s: number | null) => {
    if (!s) return '--'
    const mins = Math.floor(s / 60)
    const secs = Math.round(s % 60)
    return mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`
  }

  return (
    <div
      className="group bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors cursor-pointer relative"
      onClick={() => onSelect(video.id)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-zinc-800">
        {video.thumbnail_signed_url ? (
          <img
            src={video.thumbnail_signed_url}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="h-8 w-8 text-zinc-600" />
          </div>
        )}

        {/* Duration badge */}
        {video.duration_seconds && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/75 rounded text-[10px] text-zinc-300">
            <Clock className="h-2.5 w-2.5" />
            {formatDuration(video.duration_seconds)}
          </span>
        )}

        {/* Status badge */}
        {video.status !== 'active' && (
          <span className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
            video.status === 'paused' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-400'
          }`}>
            {video.status === 'paused' ? 'Paused' : 'Archived'}
          </span>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="h-8 w-8 text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium text-zinc-200 line-clamp-1">{video.title}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {video.niche.slice(0, 3).map(n => (
            <span key={n} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">
              {n.replace(/_/g, ' ')}
            </span>
          ))}
          {video.hook_type && (
            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px]">
              {HOOK_LABELS[video.hook_type] || video.hook_type}
            </span>
          )}
        </div>

        {/* Mini performance */}
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-0.5">
            <BarChart3 className="h-2.5 w-2.5" />
            {video.total_kits_generated} kits
          </span>
          <span className="flex items-center gap-0.5">
            <Eye className="h-2.5 w-2.5" />
            {video.total_views}
          </span>
          <span className="flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            {video.total_signups}
          </span>
        </div>
      </div>

      {/* Menu */}
      <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded bg-black/50 text-zinc-400 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-32 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10">
            {video.status === 'active' ? (
              <button
                onClick={() => { onAction(video.id, 'pause'); setMenuOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700"
              >
                <Pause className="h-3 w-3" /> Pause
              </button>
            ) : video.status === 'paused' ? (
              <button
                onClick={() => { onAction(video.id, 'activate'); setMenuOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700"
              >
                <Play className="h-3 w-3" /> Activate
              </button>
            ) : null}
            <button
              onClick={() => { onAction(video.id, 'archive'); setMenuOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-zinc-700"
            >
              <Archive className="h-3 w-3" /> Archive
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
