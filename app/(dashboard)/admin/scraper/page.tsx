'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Radar, Search, Users, Mail, TrendingUp, AlertCircle } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { QuotaPanel } from './_components/quota-panel'
import { YouTubeScraperForm } from './_components/youtube-scraper-form'
import { DiscoveryResultsTable } from './_components/discovery-results-table'

interface SavedSearch {
  id: string
  name: string
  query: string
  source: string
}

interface QuotaData {
  youtube: { used: number; limit: number; remaining: number }
}

export default function ScraperPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [quota, setQuota] = useState<QuotaData | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [lastRunStats, setLastRunStats] = useState<{ total: number; newLeads: number; quotaUsed: number } | null>(null)
  const [tab, setTab] = useState<'youtube' | 'tiktok' | 'google' | 'instagram'>('youtube')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [requireEmail, setRequireEmail] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me').then(r => r.json()).then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
        setAuthLoading(false)
      }).catch(() => router.push('/dashboard'))
    })
  }, [router])

  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scraper/quota')
      const json = await res.json()
      if (json.data) setQuota(json.data)
    } catch { /* ignore */ }
  }, [])

  const fetchSavedSearches = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scraper/saved-searches')
      const json = await res.json()
      if (json.data) setSavedSearches(json.data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (authorized) {
      fetchQuota()
      fetchSavedSearches()
    }
  }, [authorized, fetchQuota, fetchSavedSearches])

  const handleSearch = async (params: { query: string; maxResults: number; language?: string; requireEmail?: boolean }) => {
    setSearchLoading(true)
    setResults([])
    setSearchError(null)
    if (params.requireEmail !== undefined) setRequireEmail(params.requireEmail)
    try {
      const res = await fetch('/api/admin/scraper/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: params.query,
          maxResults: params.maxResults,
          language: params.language,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Search failed')

      setLastRunStats({ total: json.data.total, newLeads: json.data.new_leads, quotaUsed: json.data.quota_used })

      // Fetch full results
      if (json.data.run_id) {
        const hasEmailParam = params.requireEmail ? '&has_email=true' : ''
        const resultsRes = await fetch(`/api/admin/scraper/youtube?run_id=${json.data.run_id}${hasEmailParam}`)
        const resultsJson = await resultsRes.json()
        if (resultsJson.data) setResults(resultsJson.data)
      }

      fetchQuota()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed'
      setSearchError(msg)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSaveSearch = async (name: string, query: string) => {
    await fetch('/api/admin/scraper/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, source: 'youtube_api', query }),
    })
    fetchSavedSearches()
  }

  const handleImport = async (ids: string[]) => {
    setImportLoading(true)
    try {
      const res = await fetch('/api/admin/scraper/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result_ids: ids }),
      })
      const json = await res.json()
      if (json.data) {
        // Refresh results to show updated statuses
        if (results[0]?.run_id) {
          const hasEmailParam = requireEmail ? '&has_email=true' : ''
          const resultsRes = await fetch(`/api/admin/scraper/youtube?run_id=${results[0].run_id}${hasEmailParam}`)
          const resultsJson = await resultsRes.json()
          if (resultsJson.data) setResults(resultsJson.data)
        }
      }
    } catch { /* ignore */ }
    setImportLoading(false)
  }

  if (authLoading || !authorized) {
    return <div className="flex items-center justify-center py-20"><WolfLoader variant="spinner" size={24} mode="amber" /></div>
  }

  const withEmail = results.filter(r => r.has_email).length
  const highScore = results.filter(r => r.keyword_score >= 50).length

  const tabs = [
    { key: 'youtube' as const, label: 'YouTube', active: true },
    { key: 'tiktok' as const, label: 'TikTok', active: false },
    { key: 'google' as const, label: 'Google Search', active: false },
    { key: 'instagram' as const, label: 'Instagram', active: false },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg"><Radar className="h-5 w-5 text-purple-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Scraper</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Discover high-intent app distributors</p>
          </div>
        </div>
        {quota && <QuotaPanel used={quota.youtube.used} limit={quota.youtube.limit} />}
      </div>

      {/* Error banner */}
      {searchError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Stats */}
      {lastRunStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Found" value={lastRunStats.total} icon={<Search className="h-4 w-4" />} color="text-cyan-400" />
          <StatCard label="New Leads" value={lastRunStats.newLeads} icon={<Users className="h-4 w-4" />} color="text-green-400" />
          <StatCard label="With Email" value={withEmail} icon={<Mail className="h-4 w-4" />} color="text-amber-400" />
          <StatCard label="Score 50+" value={highScore} icon={<TrendingUp className="h-4 w-4" />} color="text-purple-400" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => t.active && setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : t.active
                  ? 'border-transparent text-muted-foreground hover:text-foreground'
                  : 'border-transparent text-muted-foreground/40 cursor-not-allowed'
            }`}
          >
            {t.label}
            {!t.active && <span className="text-[10px] ml-1 opacity-50">Soon</span>}
          </button>
        ))}
      </div>

      {/* YouTube tab */}
      {tab === 'youtube' && (
        <div className="space-y-4">
          <YouTubeScraperForm
            onSearch={handleSearch}
            onSaveSearch={handleSaveSearch}
            loading={searchLoading}
            savedSearches={savedSearches.filter(s => s.source === 'youtube_api')}
          />

          <DiscoveryResultsTable
            results={results}
            onImport={handleImport}
            importing={importLoading}
            requireEmail={requireEmail}
          />
        </div>
      )}

      {tab !== 'youtube' && (
        <Card className="border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Coming soon. YouTube is active -- start there.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2"><div className={color}>{icon}</div><span className="text-xs text-muted-foreground">{label}</span></div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
