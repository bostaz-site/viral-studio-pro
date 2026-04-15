"use client"

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NICHE_LABELS } from '@/lib/trending/constants'

export type SortOption = 'velocity' | 'views' | 'date'

export interface TrendingFiltersState {
  search: string
  games: string[]
  platforms: string[]
  sort: SortOption
}

interface TrendingFiltersProps {
  filters: TrendingFiltersState
  onChange: (filters: TrendingFiltersState) => void
  totalCount: number
  filteredCount: number
  /**
   * Niches derived from live clips (e.g. from `stats.games`).
   * Keys are lowercased niche ids, values are counts. The component
   * renders the top N as clickable pills. Pass an empty object to hide.
   */
  availableNiches?: Record<string, number>
  /** Max niche pills to show (default 6) */
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
  { id: 'twitch',         label: 'Twitch' },
  { id: 'youtube_gaming', label: 'YouTube Gaming' },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'velocity', label: 'Velocity' },
  { value: 'views',    label: 'Views' },
  { value: 'date',     label: 'Date' },
]

export function TrendingFilters({
  filters,
  onChange,
  totalCount,
  filteredCount,
  availableNiches,
  maxNichePills = 6,
}: TrendingFiltersProps) {
  const toggle = <T extends string>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]

  // Top niches, sorted by count descending, capped at maxNichePills
  const topNiches: { id: string; label: string; count: number }[] = availableNiches
    ? Object.entries(availableNiches)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxNichePills)
        .map(([id, count]) => ({ id, label: formatNicheLabel(id), count }))
    : []

  const hasActiveFilters =
    filters.search !== '' || filters.games.length > 0 || filters.platforms.length > 0

  return (
    <div className="space-y-3">
      {/* Search + sort row */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search a streamer, clip..."
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

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => onChange({ search: '', games: [], platforms: [], sort: filters.sort })}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        {/* Count */}
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {filteredCount < totalCount ? `${filteredCount} / ${totalCount}` : totalCount} clips
        </span>
      </div>

      {/* Platform pills */}
      <div className="flex flex-wrap gap-2">
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

        {/* Niche pills — derived from live clip stats */}
        {topNiches.length > 0 && (
          <>
            <div className="w-px h-5 bg-border self-center mx-1" />
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
          </>
        )}
      </div>
    </div>
  )
}
