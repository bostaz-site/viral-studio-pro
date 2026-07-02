'use client'

import { TrendingUp } from 'lucide-react'

interface ProjectedCommissionProps {
  views: number
  signups: number
  monthlyLow: number
  monthlyHigh: number
}

function fmt(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`
}

export function ProjectedCommission({ views, signups, monthlyLow, monthlyHigh }: ProjectedCommissionProps) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold text-zinc-200">Projected Commission</span>
      </div>

      <div className="text-center space-y-1">
        <p className="text-2xl font-black text-amber-400">
          {fmt(monthlyLow)} — {fmt(monthlyHigh)}<span className="text-sm font-normal text-amber-400/60">/mo</span>
        </p>
        <p className="text-xs text-zinc-400">
          If {views.toLocaleString()} people see this and 0.2% sign up:
        </p>
        <p className="text-xs text-zinc-500">
          {signups} signups x $24 avg x 30% commission = recurring income
        </p>
      </div>

      <p className="text-[10px] text-zinc-600 text-center leading-relaxed">
        Estimate based on audience size — not a guarantee. Actual earnings depend on your audience&apos;s response.
      </p>
    </div>
  )
}
