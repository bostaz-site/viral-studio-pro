'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Search, Users, Check } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'

const STATUS_OPTIONS = ['cold', 'contacted', 'opened', 'replied', 'interested', 'queued']
const NICHE_OPTIONS = [
  'gaming', 'fps', 'moba', 'irl', 'fitness', 'business',
  'beauty', 'music', 'education', 'tech', 'cooking', 'travel', 'other',
]
const PLATFORM_OPTIONS = ['twitch', 'kick', 'youtube', 'tiktok', 'instagram', 'podcast', 'other']

interface Filters {
  statuses: string[]
  niches: string[]
  platforms: string[]
  audience_min: string
  audience_max: string
  country: string
  search: string
}

interface Influencer {
  id: string
  email: string
  display_name: string | null
  first_name: string | null
  primary_platform: string | null
  niche: string | null
  audience_size: number | null
  status: string
  country: string | null
}

interface RecipientSelectorProps {
  onSelectionChange: (ids: string[]) => void
  selectedIds: string[]
}

export function RecipientSelector({ onSelectionChange, selectedIds }: RecipientSelectorProps) {
  const [filters, setFilters] = useState<Filters>({
    statuses: ['cold'],
    niches: [],
    platforms: [],
    audience_min: '',
    audience_max: '',
    country: '',
    search: '',
  })
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [matchCount, setMatchCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectAll, setSelectAll] = useState(false)

  const toggleFilter = (field: 'statuses' | 'niches' | 'platforms', value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }))
  }

  const fetchInfluencers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.statuses.length > 0) params.set('statuses', filters.statuses.join(','))
    if (filters.niches.length > 0) params.set('niches', filters.niches.join(','))
    if (filters.platforms.length > 0) params.set('platforms', filters.platforms.join(','))
    if (filters.audience_min) params.set('audience_min', filters.audience_min)
    if (filters.audience_max) params.set('audience_max', filters.audience_max)
    if (filters.country) params.set('country', filters.country)
    if (filters.search) params.set('search', filters.search)

    try {
      const res = await fetch(`/api/admin/influencers/search?${params}`)
      const json = await res.json()
      if (json.data) {
        setInfluencers(json.data.influencers || [])
        setMatchCount(json.data.count || 0)
      }
    } catch {
      setInfluencers([])
      setMatchCount(0)
    }
    setLoading(false)
  }, [filters])

  useEffect(() => {
    const debounce = setTimeout(fetchInfluencers, 300)
    return () => clearTimeout(debounce)
  }, [fetchInfluencers])

  const handleSelectAll = () => {
    if (selectAll) {
      onSelectionChange([])
      setSelectAll(false)
    } else {
      onSelectionChange(influencers.map((i) => i.id))
      setSelectAll(true)
    }
  }

  const toggleInfluencer = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id))
      setSelectAll(false)
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
        <h3 className="text-sm font-medium text-zinc-300">Filters</h3>

        {/* Status */}
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Status</Label>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleFilter('statuses', s)}
                className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                  filters.statuses.includes(s)
                    ? 'border-green-500 bg-green-500/20 text-green-400'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Niche */}
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Niche</Label>
          <div className="flex flex-wrap gap-1.5">
            {NICHE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleFilter('niches', n)}
                className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                  filters.niches.includes(n)
                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Platform */}
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Platform</Label>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => toggleFilter('platforms', p)}
                className={`rounded border px-2 py-0.5 text-xs capitalize transition-colors ${
                  filters.platforms.includes(p)
                    ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Audience + Country + Search */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label className="text-xs text-zinc-500">Min Audience</Label>
            <Input
              type="number"
              value={filters.audience_min}
              onChange={(e) => setFilters((prev) => ({ ...prev, audience_min: e.target.value }))}
              placeholder="1000"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-500">Max Audience</Label>
            <Input
              type="number"
              value={filters.audience_max}
              onChange={(e) => setFilters((prev) => ({ ...prev, audience_max: e.target.value }))}
              placeholder="500000"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-500">Country</Label>
            <Input
              value={filters.country}
              onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value }))}
              placeholder="US, CA..."
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-500">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1.5 h-4 w-4 text-zinc-500" />
              <Input
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="email or name"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Match count + select all */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-zinc-500" />
          {loading ? (
            <span className="text-zinc-500">Searching...</span>
          ) : (
            <span className="text-zinc-300">
              <span className="font-semibold text-white">{matchCount}</span> influencers match
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">
            {selectedIds.length} selected
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="h-7 text-xs"
          >
            {selectAll ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
      </div>

      {/* Influencer list */}
      <div className="max-h-[400px] overflow-y-auto rounded-lg border border-zinc-800">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <WolfLoader variant="spinner" size={20} mode="amber" />
          </div>
        ) : influencers.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">
            No influencers match your filters
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-900 text-xs text-zinc-500">
              <tr>
                <th className="w-8 p-2"></th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Platform</th>
                <th className="p-2 text-left">Niche</th>
                <th className="p-2 text-right">Audience</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {influencers.map((inf) => {
                const isSelected = selectedIds.includes(inf.id)
                return (
                  <tr
                    key={inf.id}
                    onClick={() => toggleInfluencer(inf.id)}
                    className={`cursor-pointer border-t border-zinc-800/50 transition-colors ${
                      isSelected ? 'bg-amber-500/10' : 'hover:bg-zinc-800/50'
                    }`}
                  >
                    <td className="p-2 text-center">
                      <div
                        className={`mx-auto flex h-4 w-4 items-center justify-center rounded border ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500'
                            : 'border-zinc-600'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </td>
                    <td className="p-2 text-zinc-300 truncate max-w-[200px]">{inf.email}</td>
                    <td className="p-2 text-zinc-400 truncate max-w-[150px]">
                      {inf.display_name || inf.first_name || '-'}
                    </td>
                    <td className="p-2">
                      {inf.primary_platform && (
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs capitalize text-zinc-400">
                          {inf.primary_platform}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-xs text-zinc-500">{inf.niche || '-'}</td>
                    <td className="p-2 text-right text-zinc-400">
                      {inf.audience_size ? inf.audience_size.toLocaleString() : '-'}
                    </td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        inf.status === 'cold' ? 'bg-zinc-800 text-zinc-400' :
                        inf.status === 'contacted' ? 'bg-yellow-500/20 text-yellow-400' :
                        inf.status === 'replied' ? 'bg-green-500/20 text-green-400' :
                        inf.status === 'interested' ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {inf.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
