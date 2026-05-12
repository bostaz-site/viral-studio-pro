'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Inbox, AlertCircle } from 'lucide-react'
import { InboxFilters, type InboxFilter } from './_components/inbox-filters'
import { ThreadList } from './_components/thread-list'
import { ThreadDetail } from './_components/thread-detail'

interface ThreadItem {
  influencer: {
    id: string
    email: string
    display_name: string | null
    first_name: string | null
    last_name: string | null
    status: string
    lead_score: number
    tags: string[]
    primary_platform: string | null
    platform_handle: string | null
  }
  lastMessage: {
    id: string
    direction: string
    subject: string | null
    preview: string
    sent_at: string | null
    created_at: string
    is_read: boolean
    is_starred: boolean
    is_archived: boolean
  }
  unreadCount: number
  messageCount: number
}

export default function AdminInboxPage() {
  const router = useRouter()
  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [totalUnread, setTotalUnread] = useState(0)

  const loadThreads = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ filter })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/inbox?${params}`, { cache: 'no-store' })
      const json = await res.json()

      if (res.status === 403 || res.status === 401) {
        router.push('/dashboard')
        return
      }

      if (json.data) {
        setThreads(json.data.threads || [])
        setTotalUnread(json.data.totalUnread || 0)
      } else {
        setError(json.error || 'Failed to load inbox')
      }
    } catch {
      setError('Failed to load inbox')
    } finally {
      setLoading(false)
    }
  }, [filter, search, router])

  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  // Debounced search
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null)
  const handleSearchChange = (s: string) => {
    setSearch(s)
    if (searchTimer) clearTimeout(searchTimer)
    setSearchTimer(setTimeout(loadThreads, 300))
  }

  const handleAction = async (messageIds: string[], action: string) => {
    try {
      await fetch('/api/admin/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds, action }),
      })
      // Reload threads
      await loadThreads()
    } catch {
      // silent fail
    }
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Inbox className="h-5 w-5 text-amber-400" />
          <h1 className="text-lg font-semibold text-zinc-100">Inbox</h1>
          {totalUnread > 0 && (
            <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
              {totalUnread}
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-500">Read-only — Composer coming Week 2</span>
      </div>

      {/* Main content: 2-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: thread list (40%) */}
        <div className="w-[40%] border-r border-zinc-800 flex flex-col min-h-0">
          <InboxFilters
            filter={filter}
            onFilterChange={f => { setFilter(f); setSelectedId(null) }}
            search={search}
            onSearchChange={handleSearchChange}
            totalUnread={totalUnread}
          />
          <ThreadList
            threads={threads}
            selectedId={selectedId}
            onSelect={id => setSelectedId(id)}
            loading={loading}
          />
        </div>

        {/* Right: thread detail (60%) */}
        <div className="w-[60%] flex min-h-0">
          <ThreadDetail
            influencerId={selectedId}
            onAction={handleAction}
          />
        </div>
      </div>
    </div>
  )
}
