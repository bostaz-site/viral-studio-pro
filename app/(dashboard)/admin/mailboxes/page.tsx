'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, ShieldCheck, AlertTriangle, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { MailboxTable, type MailboxRow } from './_components/mailbox-table'

export default function MailboxesPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [mailboxes, setMailboxes] = useState<MailboxRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => {
          if (!d.isAdmin) { router.push('/dashboard'); return }
          setAuthorized(true)
          setAuthLoading(false)
        })
        .catch(() => router.push('/dashboard'))
    })
  }, [router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/mailboxes?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setMailboxes(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (authorized) fetchData()
  }, [authorized, fetchData])

  const handleAction = async (id: string, action: 'pause' | 'resume' | 'sync') => {
    const endpoint = action === 'sync'
      ? `/api/admin/mailboxes/${id}/sync`
      : `/api/admin/mailboxes/${id}/${action}`
    try {
      await fetch(endpoint, { method: 'POST' })
      await fetchData()
    } catch { /* ignore */ }
  }

  if (authLoading || !authorized) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  const active = mailboxes.filter(m => m.status === 'active').length
  const avgRep = mailboxes.length ? Math.round(mailboxes.reduce((s, m) => s + (m.reputation_score ?? 0), 0) / mailboxes.length) : 0
  const problemCount = mailboxes.filter(m => (m.reputation_score ?? 100) < 70 || m.week_bounce_rate > 3).length
  const totalSent = mailboxes.reduce((s, m) => s + (m.emails_sent_today ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/10 rounded-lg">
          <Mail className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mailboxes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Deliverability monitoring & health</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active" value={active} icon={<Mail className="h-4 w-4" />} color="text-green-400" />
        <StatCard label="Avg Reputation" value={avgRep} icon={<ShieldCheck className="h-4 w-4" />} color="text-cyan-400" />
        <StatCard label="Problems" value={problemCount} icon={<AlertTriangle className="h-4 w-4" />} color="text-red-400" />
        <StatCard label="Sent Today" value={totalSent} icon={<TrendingUp className="h-4 w-4" />} color="text-amber-400" />
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
      )}

      <MailboxTable
        mailboxes={mailboxes}
        onViewDetail={(id) => router.push(`/admin/mailboxes/${id}`)}
        onAction={handleAction}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
      />
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
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
