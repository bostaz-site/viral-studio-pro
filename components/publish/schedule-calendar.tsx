"use client"

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X, ExternalLink, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Publication {
  id: string
  platform: string
  caption: string | null
  scheduled_at: string | null
  published_at: string | null
  status: string | null
  clip_id: string | null
  platform_post_id?: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  tiktok:    { dot: 'bg-cyan-400',  bg: 'bg-cyan-500/15 border-cyan-500/30',    text: 'text-cyan-300' },
  instagram: { dot: 'bg-pink-400',  bg: 'bg-pink-500/15 border-pink-500/30',    text: 'text-pink-300' },
  youtube:   { dot: 'bg-red-400',   bg: 'bg-red-500/15 border-red-500/30',      text: 'text-red-300' },
}

const STATUS_ICON: Record<string, string> = {
  scheduled:  '🕐',
  publishing: '⏳',
  published:  '✅',
  error:      '❌',
  draft:      '📝',
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// ── Date helpers ──────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  )
}

function dayOfWeekMon(d: Date) {
  return (d.getDay() + 6) % 7
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Publication detail modal ──────────────────────────────────────────────────

function PubDetailModal({ pub, onClose }: { pub: Publication; onClose: () => void }) {
  const style = PLATFORM_STYLES[pub.platform] ?? {
    dot: 'bg-muted',
    bg: 'bg-muted/20 border-border',
    text: 'text-muted-foreground',
  }
  const dt = pub.scheduled_at ?? pub.published_at

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md bg-card border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', style.dot)} />
              <span className="font-semibold capitalize text-foreground">{pub.platform}</span>
              <span className="text-xs text-muted-foreground">
                {STATUS_ICON[pub.status ?? ''] ?? ''} {pub.status}
              </span>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Date */}
          {dt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {formatDateTime(dt)}
            </div>
          )}

          {/* Caption */}
          {pub.caption && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Caption</p>
              <p className="text-sm text-foreground leading-relaxed line-clamp-6">{pub.caption}</p>
            </div>
          )}

          {/* Post link (only when published and we have a post ID) */}
          {pub.platform_post_id && pub.status === 'published' && (
            <a
              href={`https://${pub.platform}.com/watch?v=${pub.platform_post_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Voir la publication
            </a>
          )}

          <Button variant="outline" size="sm" className="w-full" onClick={onClose}>
            Fermer
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ScheduleCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [publications, setPublications] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null)

  const fetchPublications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/publish/schedule')
      const json = (await res.json()) as { data: Publication[] | null }
      setPublications(json.data ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPublications()
  }, [fetchPublications])

  // Build Monday-first calendar grid
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  const startPad = dayOfWeekMon(firstDay)
  const totalCells = startPad + lastDay.getDate()
  const rows = Math.ceil(totalCells / 7)

  const cells: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d))
  }
  while (cells.length < rows * 7) cells.push(null)

  const pubsForDay = (date: Date) =>
    publications.filter((p) => {
      const dt = p.scheduled_at ?? p.published_at
      return dt ? isSameDay(new Date(dt), date) : false
    })

  const today = new Date()

  return (
    <>
      <div className="space-y-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setCurrentMonth(new Date())}
            >
              Aujourd&apos;hui
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 bg-card/80 border-b border-border">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7">
              {cells.map((date, idx) => {
                if (!date) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[88px] border-b border-r border-border/30 bg-muted/10"
                    />
                  )
                }

                const dayPubs = pubsForDay(date)
                const isToday = isSameDay(date, today)
                const isPast = date < today && !isToday

                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      'min-h-[88px] p-1.5 border-b border-r border-border/30 transition-colors',
                      isPast ? 'bg-muted/10' : 'bg-card/40 hover:bg-card/70'
                    )}
                  >
                    {/* Day number */}
                    <div
                      className={cn(
                        'text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                        isToday
                          ? 'bg-primary text-primary-foreground'
                          : isPast
                          ? 'text-muted-foreground/40'
                          : 'text-muted-foreground'
                      )}
                    >
                      {date.getDate()}
                    </div>

                    {/* Publication badges */}
                    <div className="space-y-0.5">
                      {dayPubs.slice(0, 3).map((pub) => {
                        const style = PLATFORM_STYLES[pub.platform] ?? {
                          dot: 'bg-muted',
                          bg: 'bg-muted/20 border-border',
                          text: 'text-muted-foreground',
                        }
                        return (
                          <button
                            key={pub.id}
                            onClick={() => setSelectedPub(pub)}
                            className={cn(
                              'w-full text-left text-[10px] px-1.5 py-0.5 rounded border truncate',
                              'flex items-center gap-1 transition-opacity hover:opacity-75',
                              style.bg,
                              style.text
                            )}
                            title={pub.caption ?? pub.platform}
                          >
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />
                            <span className="truncate">
                              {STATUS_ICON[pub.status ?? ''] ?? ''} {pub.platform}
                            </span>
                          </button>
                        )
                      })}
                      {dayPubs.length > 3 && (
                        <p className="text-[10px] text-muted-foreground px-1">
                          +{dayPubs.length - 3} autres
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {Object.entries(PLATFORM_STYLES).map(([platform, style]) => (
            <span key={platform} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', style.dot)} />
              <span className="capitalize">{platform}</span>
            </span>
          ))}
          <span className="ml-auto flex flex-wrap gap-3">
            {Object.entries(STATUS_ICON).map(([status, icon]) => (
              <span key={status}>
                {icon} {status}
              </span>
            ))}
          </span>
        </div>

        {/* Stats row */}
        {!loading && publications.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {(['scheduled', 'published', 'error'] as const).map((status) => {
              const count = publications.filter((p) => p.status === status).length
              return (
                <Card key={status} className="bg-card/30 border-border">
                  <CardContent className="p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{count}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {STATUS_ICON[status]} {status}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Publication detail modal */}
      {selectedPub && (
        <PubDetailModal pub={selectedPub} onClose={() => setSelectedPub(null)} />
      )}
    </>
  )
}
