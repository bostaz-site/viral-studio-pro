'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2, ArrowLeft, Pause, Play, RefreshCw, Mail, Send, Reply, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ReputationGauge } from '../_components/reputation-gauge'
import { HealthChart } from '../_components/health-chart'

interface MailboxDetail {
  mailbox: {
    id: string; email: string; domain: string; status: string; provider: string | null
    reputation_score: number | null; bounce_rate_pct: number | null; complaint_rate_pct: number | null
    daily_send_limit: number | null; emails_sent_today: number | null; total_emails_sent: number | null
    spf_valid: boolean | null; dkim_valid: boolean | null; dmarc_valid: boolean | null
    instantly_account_id: string | null; updated_at: string
  }
  daily_stats: Array<{
    stat_date: string; emails_sent: number | null; emails_delivered: number | null
    emails_opened: number | null; emails_replied: number | null; emails_bounced: number | null
    emails_complained: number | null; reputation_score: number | null; warmup_emails: number | null
  }>
  alerts: Array<{ id: string; severity: string; title: string; description: string | null; detected_at: string }>
  domain: { domain: string; spf_configured: boolean | null; dkim_configured: boolean | null; dmarc_configured: boolean | null; warmup_started_at: string | null; status: string | null } | null
}

type Tab = 'overview' | 'health' | 'stats' | 'domain'

export default function MailboxDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [data, setData] = useState<MailboxDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me').then(r => r.json()).then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true); setAuthLoading(false)
      }).catch(() => router.push('/dashboard'))
    })
  }, [router])

  useEffect(() => {
    if (!authorized || !id) return
    fetch(`/api/admin/mailboxes/${id}`)
      .then(r => r.json())
      .then(json => { if (json.data) setData(json.data) })
      .finally(() => setLoading(false))
  }, [authorized, id])

  const handleAction = async (action: 'pause' | 'resume' | 'sync') => {
    setActionLoading(action)
    const endpoint = action === 'sync' ? `/api/admin/mailboxes/${id}/sync` : `/api/admin/mailboxes/${id}/${action}`
    await fetch(endpoint, { method: 'POST' }).catch(() => {})
    // Refetch
    const res = await fetch(`/api/admin/mailboxes/${id}`)
    const json = await res.json()
    if (json.data) setData(json.data)
    setActionLoading(null)
  }

  if (authLoading || !authorized || loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
        <p className="text-sm text-red-400">Mailbox not found</p>
      </div>
    )
  }

  const { mailbox: mb, daily_stats, alerts, domain } = data
  const stats30d = daily_stats.reduce((acc, d) => ({
    sent: acc.sent + (d.emails_sent ?? 0),
    opened: acc.opened + (d.emails_opened ?? 0),
    replied: acc.replied + (d.emails_replied ?? 0),
    bounced: acc.bounced + (d.emails_bounced ?? 0),
  }), { sent: 0, opened: 0, replied: 0, bounced: 0 })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'health', label: 'Health Charts' },
    { key: 'stats', label: 'Daily Stats' },
    { key: 'domain', label: 'Domain' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <ReputationGauge score={mb.reputation_score} />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground font-mono">{mb.email}</h1>
          <p className="text-xs text-muted-foreground">{mb.provider ?? mb.domain} &middot; Updated {new Date(mb.updated_at).toLocaleString()}</p>
        </div>
        <Badge variant="outline" className={`text-xs ${mb.status === 'active' ? 'text-green-400 border-green-400/40' : mb.status === 'paused' ? 'text-zinc-400' : 'text-amber-400 border-amber-400/40'}`}>
          {mb.status}
        </Badge>
        <div className="flex gap-1">
          {mb.status === 'active' ? (
            <Button variant="outline" size="sm" className="gap-1 text-amber-400" onClick={() => handleAction('pause')} disabled={!!actionLoading}>
              {actionLoading === 'pause' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />} Pause
            </Button>
          ) : mb.status === 'paused' ? (
            <Button variant="outline" size="sm" className="gap-1 text-green-400" onClick={() => handleAction('resume')} disabled={!!actionLoading}>
              {actionLoading === 'resume' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Resume
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => handleAction('sync')} disabled={!!actionLoading}>
            {actionLoading === 'sync' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sync
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1">
          {alerts.map(a => (
            <div key={a.id} className={`text-xs px-3 py-2 rounded-lg border ${a.severity === 'critical' ? 'bg-red-500/5 border-red-500/20 text-red-400' : 'bg-amber-500/5 border-amber-500/20 text-amber-400'}`}>
              <AlertTriangle className="h-3 w-3 inline mr-1" />{a.title}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="30d Sent" value={stats30d.sent} icon={<Send className="h-4 w-4" />} color="text-cyan-400" />
            <KPI label="30d Opened" value={stats30d.opened} icon={<Mail className="h-4 w-4" />} color="text-green-400" />
            <KPI label="30d Replied" value={stats30d.replied} icon={<Reply className="h-4 w-4" />} color="text-amber-400" />
            <KPI label="30d Bounced" value={stats30d.bounced} icon={<AlertTriangle className="h-4 w-4" />} color="text-red-400" />
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <Card className="border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-2">Bounce Rate</p><p className={`text-2xl font-bold ${(mb.bounce_rate_pct ?? 0) > 5 ? 'text-red-400' : 'text-foreground'}`}>{(mb.bounce_rate_pct ?? 0).toFixed(1)}%</p></CardContent></Card>
            <Card className="border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-2">Complaint Rate</p><p className="text-2xl font-bold text-foreground">{(mb.complaint_rate_pct ?? 0).toFixed(2)}%</p></CardContent></Card>
            <Card className="border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-2">Today</p><p className="text-2xl font-bold text-foreground">{mb.emails_sent_today ?? 0} / {mb.daily_send_limit ?? 30}</p></CardContent></Card>
          </div>
        </div>
      )}

      {tab === 'health' && (
        <div className="space-y-4">
          <Card className="border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-3">Reputation Score (30d)</p><HealthChart data={daily_stats} metric="reputation" /></CardContent></Card>
          <Card className="border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-3">Bounce Rate % (30d)</p><HealthChart data={daily_stats} metric="bounce" /></CardContent></Card>
          <Card className="border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-3">Volume (30d)</p><HealthChart data={daily_stats} metric="volume" /></CardContent></Card>
        </div>
      )}

      {tab === 'stats' && (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Sent</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Delivered</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Opened</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Replied</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Bounced</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Rep</th>
                  </tr>
                </thead>
                <tbody>
                  {daily_stats.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No data yet</td></tr>
                  ) : daily_stats.map(d => (
                    <tr key={d.stat_date} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 text-xs text-muted-foreground">{d.stat_date}</td>
                      <td className="px-4 py-2 text-xs text-right">{d.emails_sent ?? 0}</td>
                      <td className="px-4 py-2 text-xs text-right">{d.emails_delivered ?? 0}</td>
                      <td className="px-4 py-2 text-xs text-right">{d.emails_opened ?? 0}</td>
                      <td className="px-4 py-2 text-xs text-right">{d.emails_replied ?? 0}</td>
                      <td className="px-4 py-2 text-xs text-right">{d.emails_bounced ?? 0}</td>
                      <td className="px-4 py-2 text-xs text-right">{d.reputation_score ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'domain' && (
        <div className="space-y-3">
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{mb.domain}</h3>
              <div className="grid grid-cols-3 gap-3">
                <DnsCheck label="SPF" valid={domain?.spf_configured ?? mb.spf_valid} />
                <DnsCheck label="DKIM" valid={domain?.dkim_configured ?? mb.dkim_valid} />
                <DnsCheck label="DMARC" valid={domain?.dmarc_configured ?? mb.dmarc_valid} />
              </div>
              {domain && (
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                  {domain.status && <p>Domain status: <Badge variant="outline" className="text-[10px]">{domain.status}</Badge></p>}
                  {domain.warmup_started_at && <p>Warmup started: {new Date(domain.warmup_started_at).toLocaleDateString()}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function KPI({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2"><div className={color}>{icon}</div><span className="text-xs text-muted-foreground">{label}</span></div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

function DnsCheck({ label, valid }: { label: string; valid: boolean | null }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${valid ? 'border-green-500/30 bg-green-500/5' : valid === false ? 'border-red-500/30 bg-red-500/5' : 'border-border'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${valid ? 'text-green-400' : valid === false ? 'text-red-400' : 'text-muted-foreground'}`}>
        {valid ? 'Valid' : valid === false ? 'Invalid' : 'Unknown'}
      </p>
    </div>
  )
}
