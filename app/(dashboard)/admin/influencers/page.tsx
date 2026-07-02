'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Loader2, Search, ChevronLeft, ChevronRight, Users, X,
  MessageSquareReply, Clock, Star, MailWarning, AlertTriangle, Download,
  Check, Tag, ShieldBan, Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { InfluencerDrawer } from './_components/influencer-drawer'

// ── Types ────────────────────────────────────────────────────────────────────

interface Influencer {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  display_name: string | null
  primary_platform: string | null
  platform_handle: string | null
  platform_url: string | null
  audience_size: number | null
  niche: string | null
  country: string | null
  language: string | null
  status: string
  status_changed_at: string | null
  lead_score: number
  lead_score_reasons: unknown[] | null
  tags: string[]
  notes: string | null
  source: string | null
  has_opened: boolean
  has_clicked: boolean
  has_replied: boolean
  has_bounced: boolean
  has_unsubscribed: boolean
  last_sent_at: string | null
  last_opened_at: string | null
  last_replied_at: string | null
  last_contacted_at: string | null
  next_follow_up_at: string | null
  reply_reviewed: boolean
  total_emails_sent: number
  total_emails_opened: number
  total_emails_replied: number
  ai_affiliate_score: number | null
  ai_recommendation: string | null
  affiliate_code: string | null
  unsubscribed: boolean
  created_at: string
  updated_at: string
}

type ViewId = 'all' | 'replied_unreviewed' | 'interested_followup' | 'top_cold' | 'contacted_stale' | 'high_intent_no_email' | 'recent_imports'

interface ViewDef {
  id: ViewId
  label: string
  icon: typeof MessageSquareReply
  color: string
}

const VIEWS: ViewDef[] = [
  { id: 'replied_unreviewed', label: 'Replied — a traiter', icon: MessageSquareReply, color: 'text-red-400' },
  { id: 'interested_followup', label: 'Interested — follow-up du', icon: Clock, color: 'text-amber-400' },
  { id: 'top_cold', label: 'Top leads non contactes', icon: Star, color: 'text-blue-400' },
  { id: 'contacted_stale', label: 'Sans reponse 5j+', icon: MailWarning, color: 'text-orange-400' },
  { id: 'high_intent_no_email', label: 'High intent sans email', icon: AlertTriangle, color: 'text-purple-400' },
  { id: 'recent_imports', label: 'Importes 24h', icon: Download, color: 'text-green-400' },
]

const STATUSES = [
  'unqualified', 'cold', 'queued', 'contacted', 'opened', 'replied',
  'interested', 'demo_sent', 'evaluating', 'onboarded', 'active',
  'paying', 'dormant', 'declined', 'blocked',
]

const STATUS_COLORS: Record<string, string> = {
  unqualified: 'bg-zinc-700 text-zinc-300',
  cold: 'bg-blue-900/60 text-blue-300',
  queued: 'bg-cyan-900/60 text-cyan-300',
  contacted: 'bg-sky-900/60 text-sky-300',
  opened: 'bg-indigo-900/60 text-indigo-300',
  replied: 'bg-yellow-900/60 text-yellow-300',
  interested: 'bg-amber-900/60 text-amber-300',
  demo_sent: 'bg-orange-900/60 text-orange-300',
  evaluating: 'bg-fuchsia-900/60 text-fuchsia-300',
  onboarded: 'bg-emerald-900/60 text-emerald-300',
  active: 'bg-green-900/60 text-green-300',
  paying: 'bg-lime-900/60 text-lime-200',
  dormant: 'bg-stone-800 text-stone-400',
  declined: 'bg-red-900/60 text-red-300',
  blocked: 'bg-red-950 text-red-400',
}

const PLATFORMS = ['twitch', 'kick', 'youtube', 'tiktok', 'instagram', 'podcast', 'other']

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InfluencersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <InfluencersPageInner />
    </Suspense>
  )
}

function InfluencersPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Auth
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  // Data
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  // Filters
  const [activeView, setActiveView] = useState<ViewId>((searchParams.get('view') as ViewId) || 'all')
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [searchDebounced, setSearchDebounced] = useState(search)
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || '')
  const [filterPlatform, setFilterPlatform] = useState<string>(searchParams.get('platform') || '')
  const [filterHasEmail, setFilterHasEmail] = useState<string>(searchParams.get('has_email') || '')
  const [filterSource, setFilterSource] = useState<string>(searchParams.get('source') || '')
  const [filterScoreMin, setFilterScoreMin] = useState<string>(searchParams.get('score_min') || '')
  const [showFilters, setShowFilters] = useState(false)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Drawer
  const [drawerInfluencer, setDrawerInfluencer] = useState<Influencer | null>(null)

  // ── Auth check ──
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
        setAuthLoading(false)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  // ── Debounce search ──
  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!authorized) return
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('per_page', '50')
    if (activeView !== 'all') params.set('view', activeView)
    if (searchDebounced) params.set('search', searchDebounced)
    if (activeView === 'all') {
      if (filterStatus) params.set('statuses', filterStatus)
      if (filterPlatform) params.set('platforms', filterPlatform)
      if (filterHasEmail) params.set('has_email', filterHasEmail)
      if (filterSource) params.set('source', filterSource)
      if (filterScoreMin) params.set('score_min', filterScoreMin)
    }
    try {
      const res = await fetch(`/api/admin/influencers/list?${params}`)
      const json = await res.json()
      if (json.data) {
        setInfluencers(json.data.influencers)
        setTotal(json.data.total)
        setTotalPages(json.data.total_pages)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [authorized, page, activeView, searchDebounced, filterStatus, filterPlatform, filterHasEmail, filterSource, filterScoreMin])

  useEffect(() => { fetchData() }, [fetchData])

  // ── View switch ──
  const switchView = (v: ViewId) => {
    setActiveView(v)
    setPage(1)
    setSelectedIds(new Set())
  }

  // ── Selection ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (selectedIds.size === influencers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(influencers.map(i => i.id)))
    }
  }

  // ── Bulk actions ──
  const bulkAction = async (action: string, value?: string) => {
    if (selectedIds.size === 0) return
    try {
      await fetch('/api/admin/influencers/list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], action, value }),
      })
      setSelectedIds(new Set())
      fetchData()
    } catch { /* ignore */ }
  }

  // ── Refresh single influencer after drawer edit ──
  const onDrawerUpdate = useCallback(() => {
    fetchData()
    // Also refresh drawer data
    if (drawerInfluencer) {
      const updated = influencers.find(i => i.id === drawerInfluencer.id)
      if (updated) setDrawerInfluencer(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, drawerInfluencer?.id])

  // ── Active filter count ──
  const activeFilterCount = useMemo(() => {
    let c = 0
    if (filterStatus) c++
    if (filterPlatform) c++
    if (filterHasEmail) c++
    if (filterSource) c++
    if (filterScoreMin) c++
    return c
  }, [filterStatus, filterPlatform, filterHasEmail, filterSource, filterScoreMin])

  if (authLoading || !authorized) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-400" />
            Influencers
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total.toLocaleString()} leads in pipeline
          </p>
        </div>
      </div>

      {/* Predefined views */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeView === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => switchView('all')}
          className="text-xs"
        >
          All
        </Button>
        {VIEWS.map(v => (
          <Button
            key={v.id}
            variant={activeView === v.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => switchView(v.id)}
            className="text-xs gap-1.5"
          >
            <v.icon className={`h-3.5 w-3.5 ${activeView === v.id ? '' : v.color}`} />
            {v.label}
          </Button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, handle, email..."
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        {activeView === 'all' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5 text-xs"
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {/* Filter bar */}
      {showFilters && activeView === 'all' && (
        <div className="flex flex-wrap gap-3 p-3 rounded-lg border border-border bg-card/50">
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground"
          >
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterPlatform}
            onChange={e => { setFilterPlatform(e.target.value); setPage(1) }}
            className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground"
          >
            <option value="">All platforms</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filterHasEmail}
            onChange={e => { setFilterHasEmail(e.target.value); setPage(1) }}
            className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground"
          >
            <option value="">Email: any</option>
            <option value="true">Has email</option>
            <option value="false">No email</option>
          </select>
          <Input
            value={filterSource}
            onChange={e => { setFilterSource(e.target.value); setPage(1) }}
            placeholder="Source..."
            className="h-8 w-28 text-xs"
          />
          <Input
            type="number"
            value={filterScoreMin}
            onChange={e => { setFilterScoreMin(e.target.value); setPage(1) }}
            placeholder="Score min"
            className="h-8 w-24 text-xs"
            min={0}
            max={100}
          />
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterStatus(''); setFilterPlatform(''); setFilterHasEmail('')
                setFilterSource(''); setFilterScoreMin(''); setPage(1)
              }}
              className="text-xs text-muted-foreground"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <span className="text-xs font-medium text-amber-400 mr-2">
            {selectedIds.size} selected
          </span>
          <select
            defaultValue=""
            onChange={e => {
              if (e.target.value) bulkAction('set_status', e.target.value)
              e.target.value = ''
            }}
            className="h-7 px-2 text-xs rounded border border-border bg-background text-foreground"
          >
            <option value="" disabled>Set status...</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
            const tag = prompt('Tag to add:')
            if (tag) bulkAction('add_tag', tag)
          }}>
            <Tag className="h-3 w-3" /> Add tag
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => bulkAction('mark_reviewed')}>
            <Check className="h-3 w-3" /> Mark reviewed
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-400 hover:text-red-300" onClick={() => {
            if (confirm(`Block ${selectedIds.size} leads and add to suppression list?`)) bulkAction('block')
          }}>
            <ShieldBan className="h-3 w-3" /> Block
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border text-left">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === influencers.length && influencers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                  />
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Name / Handle</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Email</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Platform</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-right">Audience</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Niche</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-right">Score</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Last contact</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Last reply</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Source</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && influencers.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && influencers.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground">
                    No leads match this view
                  </td>
                </tr>
              )}
              {influencers.map(inf => (
                <tr
                  key={inf.id}
                  className={`hover:bg-muted/20 cursor-pointer transition-colors ${selectedIds.has(inf.id) ? 'bg-amber-500/5' : ''}`}
                  onClick={() => setDrawerInfluencer(inf)}
                >
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(inf.id)}
                      onChange={() => toggleSelect(inf.id)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground truncate max-w-[180px]">
                      {inf.display_name || `${inf.first_name || ''} ${inf.last_name || ''}`.trim() || '—'}
                    </div>
                    {inf.platform_handle && (
                      <div className="text-xs text-muted-foreground truncate">@{inf.platform_handle}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {inf.email ? (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px] block">{inf.email}</span>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">No email</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {inf.primary_platform ? (
                      <span className="text-xs capitalize text-muted-foreground">{inf.primary_platform}</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {inf.audience_size ? formatNumber(inf.audience_size) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-muted-foreground">{inf.niche || '—'}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[inf.status] || 'bg-zinc-800 text-zinc-400'}`}>
                      {inf.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ScoreBadge score={inf.lead_score} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {inf.last_contacted_at ? relativeTime(inf.last_contacted_at) : inf.last_sent_at ? relativeTime(inf.last_sent_at) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {inf.last_replied_at ? relativeTime(inf.last_replied_at) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[100px]">
                    {inf.source || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap max-w-[120px]">
                      {(inf.tags || []).slice(0, 2).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">{tag}</span>
                      ))}
                      {(inf.tags || []).length > 2 && (
                        <span className="text-[10px] text-zinc-500">+{inf.tags.length - 2}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} ({total.toLocaleString()} total)
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {drawerInfluencer && (
        <InfluencerDrawer
          influencer={drawerInfluencer}
          onClose={() => setDrawerInfluencer(null)}
          onUpdate={onDrawerUpdate}
        />
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-amber-400' : score >= 40 ? 'text-yellow-500' : 'text-zinc-500'
  return <span className={`text-xs font-bold tabular-nums ${color}`}>{score}</span>
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
