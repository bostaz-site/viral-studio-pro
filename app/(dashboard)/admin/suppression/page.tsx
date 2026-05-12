'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldBan, Plus, ListPlus, BarChart3, Calendar, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/ui/dialog'
import {
  SuppressionTable,
  type SuppressionEntry,
} from './_components/suppression-table'
import { BulkAddDialog } from './_components/bulk-add-dialog'

const REASONS = [
  { value: 'manual_block', label: 'Manual Block' },
  { value: 'unsubscribe', label: 'Unsubscribe' },
  { value: 'hard_bounce', label: 'Hard Bounce' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'gdpr_request', label: 'GDPR Request' },
  { value: 'fraud_flag', label: 'Fraud Flag' },
]

interface Stats {
  total: number
  this_week: number
  top_reasons: { reason: string; count: number }[]
}

export default function SuppressionPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  // Data
  const [entries, setEntries] = useState<SuppressionEntry[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [page, setPage] = useState(1)
  const [reason, setReason] = useState('')
  const [search, setSearch] = useState('')

  // Dialogs
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addReason, setAddReason] = useState('manual_block')
  const [addLoading, setAddLoading] = useState(false)

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((d) => {
          if (!d.isAdmin) { router.push('/dashboard'); return }
          setAuthorized(true)
          setAuthLoading(false)
        })
        .catch(() => router.push('/dashboard'))
    })
  }, [router])

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (reason) params.set('reason', reason)
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/suppression?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to fetch')

      setEntries(json.data.entries)
      setTotal(json.data.total)
      if (json.data.stats) setStats(json.data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [page, reason, search])

  useEffect(() => {
    if (authorized) fetchData()
  }, [authorized, fetchData])

  // Add single entry
  const handleAddSingle = async () => {
    if (!addEmail.trim()) return
    setAddLoading(true)
    try {
      const res = await fetch('/api/admin/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: [{ email: addEmail.trim().toLowerCase(), reason: addReason }],
        }),
      })
      if (!res.ok) throw new Error('Failed to add')

      setAddOpen(false)
      setAddEmail('')
      fetchData()
    } catch {
      setError('Failed to add entry')
    } finally {
      setAddLoading(false)
    }
  }

  // Remove entry
  const handleRemove = async (id: string) => {
    try {
      const res = await fetch('/api/admin/suppression', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed to remove')
      fetchData()
    } catch {
      setError('Failed to remove entry')
    }
  }

  if (authLoading || !authorized) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg">
            <ShieldBan className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Suppression List</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              CAN-SPAM / CASL / GDPR compliance — blocked emails & domains
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => setBulkOpen(true)}>
            <ListPlus className="h-4 w-4" />
            Bulk Add
          </Button>
          <Button className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Suppressed"
          value={stats?.total ?? total}
          icon={<ShieldBan className="h-4 w-4" />}
          color="text-red-400"
        />
        <StatCard
          label="This Week"
          value={stats?.this_week ?? 0}
          icon={<Calendar className="h-4 w-4" />}
          color="text-blue-400"
        />
        <StatCard
          label="Top Reason"
          value={stats?.top_reasons?.[0]?.reason ?? '—'}
          icon={<TrendingUp className="h-4 w-4" />}
          color="text-amber-400"
        />
        <StatCard
          label="Top Count"
          value={stats?.top_reasons?.[0]?.count ?? 0}
          icon={<BarChart3 className="h-4 w-4" />}
          color="text-green-400"
        />
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Table */}
      <SuppressionTable
        entries={entries}
        total={total}
        page={page}
        limit={50}
        loading={loading}
        onPageChange={setPage}
        onFilterChange={(f) => {
          if (f.reason !== undefined) setReason(f.reason ?? '')
          if (f.search !== undefined) setSearch(f.search ?? '')
          setPage(1)
        }}
        onRemove={handleRemove}
        currentReason={reason}
        currentSearch={search}
      />

      {/* Add single dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add to Suppression List">
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Email</Label>
            <Input
              placeholder="spammer@example.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
              className="font-mono text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Reason</Label>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setAddReason(r.value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    addReason === r.value
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSingle} disabled={addLoading || !addEmail.trim()} className="gap-1.5">
              {addLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Bulk add dialog */}
      <BulkAddDialog open={bulkOpen} onClose={() => setBulkOpen(false)} onSuccess={fetchData} />
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={color}>{icon}</div>
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
