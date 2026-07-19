'use client'

import { cn } from '@/lib/utils'
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
      }}
    >
      {/* Ice border via pseudo — done with an outer wrapper */}
      <div
        className="absolute -inset-px rounded-2xl pointer-events-none"
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,.75), rgba(186,230,253,.45), rgba(125,211,252,.5), rgba(255,255,255,.65), rgba(148,197,233,.45))',
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'xor' as never,
          WebkitMaskComposite: 'xor' as never,
          padding: '1px',
          borderRadius: '16px',
        }}
      />

      {/* Comet glow — animated conic border */}
      <div
        className="absolute -inset-px rounded-2xl pointer-events-none animate-[cometSpin_5s_linear_infinite] opacity-60"
        style={{
          background: 'conic-gradient(from var(--c, 0deg), transparent 0deg, transparent 300deg, rgba(255,255,255,.9) 330deg, rgba(186,230,253,.7) 345deg, transparent 360deg)',
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'xor' as never,
          WebkitMaskComposite: 'xor' as never,
          padding: '1.5px',
          borderRadius: '16px',
          filter: 'drop-shadow(0 0 6px rgba(255,255,255,.4))',
        }}
      />

      {/* Corner crystals */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/frames/corner-tl.webp" alt="" className="absolute -top-4 -left-4 w-[58px] h-[58px] pointer-events-none drop-shadow-[0_0_8px_rgba(125,211,252,.3)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/frames/corner-tr.webp" alt="" className="absolute -top-4 -right-4 w-[58px] h-[58px] pointer-events-none drop-shadow-[0_0_8px_rgba(125,211,252,.3)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/frames/corner-bl.webp" alt="" className="absolute -bottom-4 -left-4 w-[58px] h-[58px] pointer-events-none drop-shadow-[0_0_8px_rgba(125,211,252,.3)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/frames/corner-br.webp" alt="" className="absolute -bottom-4 -right-4 w-[58px] h-[58px] pointer-events-none drop-shadow-[0_0_8px_rgba(125,211,252,.3)]" />

      {/* Crown */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/frames/top-pick-crown.webp"
        alt=""
        className="absolute left-1/2 top-0 w-[78px] h-[78px] -translate-x-1/2 -translate-y-[58%] pointer-events-none animate-[crownFloat_4.5s_ease-in-out_infinite] z-10"
        style={{ filter: 'drop-shadow(0 0 14px rgba(125,211,252,.5))' }}
      />

      {/* Sparkles */}
      <span className="absolute top-2 right-10 text-[10px] text-sky-200/60 animate-[sparkle_3s_ease-in-out_infinite] pointer-events-none">&#10022;</span>
      <span className="absolute bottom-3 left-8 text-[8px] text-sky-300/50 animate-[sparkle_3s_ease-in-out_infinite_0.8s] pointer-events-none">&#10022;</span>
      <span className="absolute top-4 left-16 text-[7px] text-white/40 animate-[sparkle_3s_ease-in-out_infinite_1.6s] pointer-events-none">&#10022;</span>

      {/* Content — horizontal flex, stacks on mobile */}
      <div className="relative z-[1] flex flex-col sm:flex-row items-stretch gap-3 p-3 sm:p-4">
        {/* Thumbnail */}
        {clip.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnail_url}
            alt={clip.title ?? ''}
            className="w-full sm:w-[150px] h-[150px] sm:h-[96px] rounded-[10px] object-cover shrink-0"
            style={{ outline: '1px solid rgba(224,242,254,.3)' }}
          />
        )}

        {/* Center text */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          {/* Chip */}
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: 'linear-gradient(180deg, #FFF, #BAE6FD)',
                color: '#0C4A6E',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
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
            <p className="text-[11px] font-medium" style={{ color: '#7DD3FC' }}>
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
                background: 'linear-gradient(180deg, #FFF, #BFE3F9 45%, #5EB6E8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 8px rgba(148,197,233,.55))',
              }}
            >
              {score}
            </span>
            <span className="block text-[8.5px] font-bold uppercase tracking-widest text-sky-300/60 mt-0.5">
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

      {/* Hover glow overlay */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover/tp:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: '0 0 32px rgba(125,211,252,.2), inset 0 0 20px rgba(125,211,252,.05)' }}
      />
    </div>
  )
}
