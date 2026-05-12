'use client'

import { Search, Inbox, Star, Archive, Mail } from 'lucide-react'

export type InboxFilter = 'all' | 'unread' | 'starred' | 'archived'

interface InboxFiltersProps {
  filter: InboxFilter
  onFilterChange: (f: InboxFilter) => void
  search: string
  onSearchChange: (s: string) => void
  totalUnread: number
}

const FILTERS: { key: InboxFilter; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All', icon: Inbox },
  { key: 'unread', label: 'Unread', icon: Mail },
  { key: 'starred', label: 'Starred', icon: Star },
  { key: 'archived', label: 'Archived', icon: Archive },
]

export function InboxFilters({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  totalUnread,
}: InboxFiltersProps) {
  return (
    <div className="border-b border-zinc-800 p-3 space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search inbox..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-md pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-1">
        {FILTERS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === key
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {key === 'unread' && totalUnread > 0 && (
              <span className="ml-1 bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
