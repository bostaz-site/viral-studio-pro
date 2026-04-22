'use client'

// Shown once per browser when the signed-in user has unclaimed bonus_videos
// (i.e. they were referred and got +2, or they referred someone and got +5).
// Dismissible. We don't reset the dismissal when the balance changes — only
// new bonus activity of a DIFFERENT amount will re-open it.

import { useEffect, useState } from 'react'
import { Gift, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'vsp:referral_bonus_ack'

interface AnalyticsResponse {
  data: {
    usage: { bonusVideos: number }
  } | null
}

export function ReferralBonusBanner() {
  const [bonus, setBonus] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/analytics', { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as AnalyticsResponse
        if (cancelled) return
        const n = json.data?.usage.bonusVideos ?? 0
        if (n <= 0) return
        // Only show if the user hasn't acked THIS exact amount yet — so
        // new rewards re-open the banner automatically.
        const acked = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
        if (acked === String(n)) return
        setBonus(n)
      } catch {
        // silent — non-critical UX
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleDismiss = () => {
    if (bonus !== null && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(bonus))
      } catch {
        // ignore
      }
    }
    setDismissed(true)
  }

  if (dismissed || bonus === null) return null

  return (
    <div
      className={cn(
        'relative flex items-center gap-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-4',
        'animate-in fade-in slide-in-from-top-2 duration-500',
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
        <Gift className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          +{bonus} bonus clip{bonus > 1 ? 's' : ''} unlocked!
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Through our referral program. Usable once you reach your monthly limit.
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-emerald-500/10 hover:text-foreground transition-colors"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
