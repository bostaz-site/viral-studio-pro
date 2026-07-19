'use client'

import { timeAgo } from '@/lib/trending/utils'
import { getClipInsight } from '@/types/trending'
import type { TrendingClip } from '@/types/trending'
import { Flame } from 'lucide-react'

interface TopPickCardProps {
  clip: TrendingClip
  onEnhance: (clip: TrendingClip) => void
}

export function TopPickCard({ clip, onEnhance }: TopPickCardProps) {
  const score = Math.round(clip.velocity_score ?? 0)
  const insight = getClipInsight(clip)
  const age = timeAgo(clip.clip_created_at ?? clip.scraped_at)
  const niche = clip.niche ?? ''

  return (
    <div
      className="group/tp relative max-w-[680px] cursor-pointer rounded-2xl transition-all duration-300 hover:-translate-y-0.5"
      onClick={() => onEnhance(clip)}
      style={{
        background: 'linear-gradient(180deg, rgba(15,23,42,.97), rgba(4,9,24,.95))',
        boxShadow: '0 0 24px rgba(245,158,11,.12)',
      }}
    >
      {/* Gold border — same gradient as mega_viral grid cards */}
      <div
        className="absolute -inset-px rounded-2xl pointer-events-none"
        style={{
          background: 'linear-gradient(160deg, #F59E0B, #B45309)',
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'xor' as never,
          WebkitMaskComposite: 'xor' as never,
          padding: '1.5px',
          borderRadius: '16px',
        }}
      />

      {/* Content — horizontal flex, stacks on mobile */}
      <div className="relative z-[1] flex flex-col sm:flex-row items-stretch gap-3 p-3 sm:p-4">
        {/* Thumbnail */}
        {clip.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnail_url}
            alt={clip.title ?? ''}
            className="w-full sm:w-[150px] h-[150px] sm:h-[96px] rounded-[10px] object-cover shrink-0"
            style={{ outline: '1px solid rgba(245,158,11,.25)' }}
          />
        )}

        {/* Center text */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          {/* Chip */}
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: 'linear-gradient(180deg, #FEF3C7, #F59E0B)',
                color: '#451A03',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
              Top Pick &middot; {clip.feed_category === 'early_gem' ? 'Early Gem' : 'Surging'}
            </span>
          </div>

          {/* Title */}
          <p className="text-[15.5px] font-bold text-white truncate leading-tight">
            {clip.title || 'Untitled clip'}
          </p>

          {/* Meta */}
          <p className="text-[11px] text-zinc-400 truncate">
            @{clip.author_handle ?? clip.author_name ?? 'unknown'}
            {niche && ` \u00b7 ${niche}`}
            {age && ` \u00b7 ${age} ago`}
          </p>

          {/* Insight reason */}
          {insight && (
            <p className="text-[11px] font-medium" style={{ color: '#F59E0B' }}>
              {insight.icon} {insight.text}
            </p>
          )}
        </div>

        {/* Right — score + CTA */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1.5 shrink-0">
          <div className="text-right">
            <span
              className="text-[32px] font-black leading-none"
              style={{
                background: 'linear-gradient(180deg, #FEF3C7, #F59E0B 45%, #B45309)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {score}
            </span>
            <span className="block text-[8.5px] font-bold uppercase tracking-widest text-amber-500/60 mt-0.5">
              Viral Score
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onEnhance(clip) }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-amber-950 transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)',
              boxShadow: '0 0 12px rgba(245,158,11,.25)',
            }}
          >
            <Flame className="h-3.5 w-3.5" />
            Steal this clip
          </button>
        </div>
      </div>

      {/* Hover glow overlay — amber */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover/tp:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: '0 0 32px rgba(245,158,11,.18), inset 0 0 20px rgba(245,158,11,.04)' }}
      />
    </div>
  )
}
