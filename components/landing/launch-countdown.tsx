"use client"

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { STUDIO_LAUNCH_ENDS_AT } from '@/lib/plans'

interface LaunchCountdownProps {
  /** When the launch price expires. Defaults to the global Studio launch date. */
  endsAt?: Date
  /** Extra classes for the root element. */
  className?: string
  /** Compact variant for tight card layouts. */
  compact?: boolean
}

interface Remaining {
  days: number
  hours: number
  minutes: number
  expired: boolean
}

function getRemaining(endsAt: Date, now: Date): Remaining {
  const ms = endsAt.getTime() - now.getTime()
  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, expired: true }
  }
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  return { days, hours, minutes, expired: false }
}

/**
 * Displays a live countdown to the end of the Studio launch price.
 * Returns `null` once the launch price has expired (component self-hides).
 * Server-rendered initial state avoids hydration flicker.
 */
export function LaunchCountdown({
  endsAt = STUDIO_LAUNCH_ENDS_AT,
  className = '',
  compact = false,
}: LaunchCountdownProps) {
  const [remaining, setRemaining] = useState<Remaining>(() =>
    getRemaining(endsAt, new Date()),
  )

  useEffect(() => {
    // Re-render every minute — we show days/hours/minutes granularity.
    const tick = () => setRemaining(getRemaining(endsAt, new Date()))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [endsAt])

  if (remaining.expired) return null

  const label = compact
    ? `${remaining.days}d ${remaining.hours}h ${remaining.minutes}m`
    : `Expires in ${remaining.days}d ${remaining.hours}h ${remaining.minutes}m`

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-400 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Clock className="h-3 w-3" aria-hidden />
      <span>{label}</span>
    </div>
  )
}
