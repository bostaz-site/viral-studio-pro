"use client"

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
}

const GAMES: { id: string; label: string }[] = [
  // IRL-only — no gaming categories
]

const PLATFORMS = [
  { id: 'twitch',         label: 'Twitch' },
  { id: 'youtube_gaming', label: 'YouTube Gaming' },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'velocity', label: 'Velocity' },
  { value: 'views',    label: 'Vues' },
  { value: 'date',     label: 'Date' },
]

export function TrendingFilters({ filters, onChange, totalCount, filteredCount }: TrendingFiltersProps) {
  const toggle = <T extends string>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]

  const hasActiveFilters =
    filters.search !== '' || filters.games.length > 0 || filters.platforms.length > 0

  return (
    <div className="space-y-3">
      {/* Search + sort row */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un streamer, un clip…"
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
            Effacer
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

        {/* Game pills — hidden when no categories configured */}
        {GAMES.length > 0 && (
          <>
            <div className="w-px h-5 bg-border self-center mx-1" />
            {GAMES.map((game) => {
              const active = filters.games.includes(game.id)
              return (
                <button
                  key={game.id}
                  onClick={() => onChange({ ...filters, games: toggle(filters.games, game.id) })}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                    active
                      ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                      : 'bg-muted/30 text-muted-foreground border-border hover:border-indigo-500/30 hover:text-foreground'
                  )}
                >
                  {game.label}
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
