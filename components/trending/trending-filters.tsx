"use client"

import { useState, useMemo } from 'react'
import { Search, X, Timer, SlidersHorizontal, ChevronDown, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NICHE_LABELS } from '@/lib/trending/constants'
import type { TrendingFiltersState, SortOption, DurationFilter } from '@/types/trending'

export type { SortOption, TrendingFiltersState }

interface TrendingFiltersProps {
  filters: TrendingFiltersState
  onChange: (filters: TrendingFiltersState) => void
  totalCount: number
  filteredCount: number
  availableNiches?: Record<string, number>
  availableStreamers?: { name: string; count: number }[]
  maxNichePills?: number
}

function formatNicheLabel(id: string): string {
  if (NICHE_LABELS[id]) return NICHE_LABELS[id]
  return id
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const PLATFORMS = [
  { id: 'twitch', label: 'Twitch' },
  { id: 'kick', label: 'Kick' },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'velocity', label: 'Score' },
  { value: 'date',     label: 'Date' },
]

const DURATION_OPTIONS: { value: DurationFilter; label: string; sub: string }[] = [
  { value: 'all',    label: 'All',    sub: '' },
  { value: 'short',  label: 'Short',  sub: '< 30s' },
  { value: 'medium', label: 'Medium', sub: '30-60s' },
  { value: 'long',   label: 'Long',   sub: '60s+' },
]

export function TrendingFilters({
  filters,
  onChange,
  totalCount,
  filteredCount,
  availableNiches,
  availableStreamers,
  maxNichePills = 6,
}: TrendingFiltersProps) {
  const [showMoreFilters, setShowMoreFilters] = useState(false)

  const toggle = <T extends string>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]

  const topNiches: { id: string; label: string; count: number }[] = availableNiches
    ? Object.entries(availableNiches)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxNichePills)
        .map(([id, count]) => ({ id, label: formatNicheLabel(id), count }))
    : []

  // Streamers sorted by clip count desc
  const streamerOptions = useMemo(() => {
    return (availableStreamers ?? []).slice().sort((a, b) => b.count - a.count)
  }, [availableStreamers])

  const hasAdvancedFilters =
    filters.games.length > 0 || filters.platforms.length > 0 || filters.duration !== 'all'
  const hasAnyFilter =
    filters.search !== '' || filters.streamer !== '' && filters.streamer !== undefined || hasAdvancedFilters

  const sortLabel = SORT_OPTIONS.find(s => s.value === filters.sort)?.label ?? 'Score'

  return (
    <div className="space-y-3">
      {/* MAIN ROW — Search + Sort + Streamer + More filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by streamer or title..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-9 h-9 bg-background/50"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card/50">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...filters, sort: opt.value })}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                filters.sort === opt.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Streamer dropdown */}
        <div className="relative">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <select
            value={filters.streamer ?? ''}
            onChange={(e) => onChange({ ...filters, streamer: e.target.value })}
            className={cn(
              'pl-9 pr-7 h-9 text-xs font-medium border border-border rounded-lg bg-card/50',
              'appearance-none cursor-pointer transition-colors',
              'hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40',
              filters.streamer
                ? 'text-primary border-primary/40'
                : 'text-muted-foreground'
            )}
          >
            <option value="">All streamers</option>
            {streamerOptions.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {/* More filters toggle */}
        <button
          onClick={() => setShowMoreFilters((prev) => !prev)}
          className={cn(
            'h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium border rounded-lg transition-colors',
            showMoreFilters || hasAdvancedFilters
              ? 'border-primary/40 text-primary bg-primary/5'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          More filters
          {hasAdvancedFilters && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
              {filters.games.length + filters.platforms.length + (filters.duration !== 'all' ? 1 : 0)}
            </span>
          )}
        </button>

        {/* Clear filters */}
        {hasAnyFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => onChange({ ...filters, search: '', games: [], platforms: [], duration: 'all', streamer: '' })}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* MORE FILTERS — collapsible (Platform / Duration / Niches) */}
      {showMoreFilters && (
        <div className="rounded-lg border border-border bg-card/40 p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Platform */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20">Platform</span>
            {PLATFORMS.map((p) => {
              const active = filters.platforms.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => onChange({ ...filters, platforms: toggle(filters.platforms, p.id) })}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                    active
                      ? 'bg-primary/10 text-primary border-primary/40'
                      : 'bg-muted/30 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Duration */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20 flex items-center gap-1">
              <Timer className="h-3 w-3" /> Duration
            </span>
            {DURATION_OPTIONS.filter(d => d.value !== 'all').map((d) => {
              const active = filters.duration === d.value
              return (
                <button
                  key={d.value}
                  onClick={() => onChange({ ...filters, duration: active ? 'all' : d.value })}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                    active
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-muted/30 text-muted-foreground border-border hover:border-amber-500/30 hover:text-foreground'
                  )}
                >
                  {d.label}
                  {d.sub && <span className="ml-1 opacity-60">{d.sub}</span>}
                </button>
              )
            })}
          </div>

          {/* Niches */}
          {topNiches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20">Niche</span>
              {topNiches.map((niche) => {
                const active = filters.games.includes(niche.id)
                return (
                  <button
                    key={niche.id}
                    onClick={() => onChange({ ...filters, games: toggle(filters.games, niche.id) })}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5',
                      active
                        ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                        : 'bg-muted/30 text-muted-foreground border-border hover:border-indigo-500/30 hover:text-foreground'
                    )}
                  >
                    {niche.label}
                    <span className={cn(
                      'text-[10px] tabular-nums',
                      active ? 'text-indigo-400/80' : 'text-muted-foreground/60'
                    )}>
                      {niche.count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Count — humanized, always "X clips found" (radar style, not database UI) */}
      <p className="text-xs text-muted-foreground">
        {filteredCount} {filteredCount === 1 ? 'clip' : 'clips'} · sorted by {sortLabel}
      </p>
    </div>
  )
}
