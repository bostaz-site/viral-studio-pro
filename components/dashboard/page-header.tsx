'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Unified page header used across Browse, Enhance, Analytics, Settings.
 * Matches the visual style of Distribution's `dist-page-head` (icon glass card +
 * title + subtitle + optional right slot) so every page shares the same
 * "premium gaming SaaS" identity.
 *
 * Each page picks its own icon (Compass for Browse, Wand2 for Enhance, etc.)
 * but the visual treatment is identical, giving instant wayfinding without
 * looking cookie-cutter.
 */

type AccentColor = 'cyan' | 'orange' | 'neutral'

interface PageHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  /** Cyan = primary brand (default), orange = AI/creator energy, neutral = settings/admin */
  accent?: AccentColor
  /** Optional right-side content (status chips, action buttons, etc.) */
  rightSlot?: React.ReactNode
  className?: string
}

const ACCENT_STYLES: Record<AccentColor, { bg: string; border: string; text: string; glow: string }> = {
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/25',
    text: 'text-cyan-400',
    glow: 'shadow-[0_0_20px_rgba(34,211,238,0.15)]',
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/25',
    text: 'text-orange-400',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.15)]',
  },
  neutral: {
    bg: 'bg-zinc-800/40',
    border: 'border-zinc-700/40',
    text: 'text-zinc-300',
    glow: 'shadow-none',
  },
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  accent = 'cyan',
  rightSlot,
  className,
}: PageHeaderProps) {
  const a = ACCENT_STYLES[accent]

  return (
    <div className={cn('flex items-center justify-between gap-4 mb-6', className)}>
      <div className="flex items-center gap-3 min-w-0">
        {/* Icon glass card — same visual treatment as Distribution's dist-icon-mark */}
        <div
          className={cn(
            'flex-shrink-0 grid place-items-center w-12 h-12 rounded-xl border backdrop-blur-md',
            'transition-transform duration-200 hover:scale-[1.04]',
            'animate-[pageHeaderIconFade_0.4s_ease-out]',
            a.bg,
            a.border,
            a.glow,
          )}
        >
          <Icon size={22} className={a.text} strokeWidth={2.2} />
        </div>
        {/* Title + subtitle */}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {rightSlot && <div className="flex-shrink-0 flex items-center gap-2">{rightSlot}</div>}
      <style jsx>{`
        @keyframes pageHeaderIconFade {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
}
