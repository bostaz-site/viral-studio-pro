'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ScheduledPublication } from '@/stores/schedule-store'

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: 'bg-zinc-700',
  youtube: 'bg-red-500/60',
  instagram: 'bg-pink-500/60',
}

interface ScheduleCalendarProps {
  queue: ScheduledPublication[]
}

export function ScheduleCalendar({ queue }: ScheduleCalendarProps) {
  const days = useMemo(() => {
    const result: { date: Date; label: string; shortDay: string; items: ScheduledPublication[] }[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      date.setHours(0, 0, 0, 0)

      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      const items = queue.filter(item => {
        if (item.status === 'cancelled') return false
        const d = new Date(item.scheduled_at)
        return d >= date && d < nextDay
      })

      result.push({
        date,
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' }),
        shortDay: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        items: items.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
      })
    }
    return result
  }, [queue])

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <h3 className="text-lg font-semibold text-foreground">Weekly Calendar</h3>
        <p className="text-sm text-muted-foreground">Your scheduled posts for the next 7 days</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map(day => (
            <div
              key={day.date.toISOString()}
              className={`rounded-xl border p-2 min-h-[120px] transition-colors ${
                isToday(day.date)
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card/30'
              }`}
            >
              <div className="text-center mb-2">
                <p className={`text-xs font-semibold ${
                  isToday(day.date) ? 'text-primary' : 'text-foreground'
                }`}>
                  {day.label}
                </p>
                <p className="text-[10px] text-muted-foreground">{day.shortDay}</p>
              </div>

              <div className="space-y-1">
                {day.items.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/40 text-center mt-4">—</p>
                ) : (
                  day.items.map(item => (
                    <div
                      key={item.id}
                      className={`rounded-lg px-1.5 py-1 text-[10px] ${
                        PLATFORM_COLORS[item.platform] ?? 'bg-muted'
                      } text-white/90`}
                      title={`${item.platform} — ${new Date(item.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                    >
                      <span className="font-medium">
                        {new Date(item.scheduled_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {day.items.length > 0 && (
                <div className="flex gap-0.5 mt-1.5 justify-center">
                  {Array.from(new Set(day.items.map(i => i.platform))).map(p => (
                    <div
                      key={p}
                      className={`w-1.5 h-1.5 rounded-full ${PLATFORM_COLORS[p] ?? 'bg-muted'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
