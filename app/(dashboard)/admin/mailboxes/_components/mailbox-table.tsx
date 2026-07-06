'use client'

import { useState } from 'react'
import { Eye, Pause, Play, RefreshCw } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReputationGauge } from './reputation-gauge'

export interface MailboxRow {
  id: string
  email: string
  domain: string
  provider: string | null
  status: string
  reputation_score: number | null
  bounce_rate_pct: number | null
  daily_send_limit: number | null
  emails_sent_today: number | null
  updated_at: string
  week_bounce_rate: number
  week_reply_rate: number
  instantly_account_id: string | null
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 border-green-400/40',
  warming: 'text-amber-400 border-amber-400/40',
  paused: 'text-zinc-400 border-zinc-400/40',
  blocked: 'text-red-400 border-red-400/40',
}

interface Props {
  mailboxes: MailboxRow[]
  onViewDetail: (id: string) => void
  onAction: (id: string, action: 'pause' | 'resume' | 'sync') => Promise<void>
  statusFilter: string
  onStatusFilter: (s: string) => void
}

export function MailboxTable({ mailboxes, onViewDetail, onAction, statusFilter, onStatusFilter }: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const handleAction = async (id: string, action: 'pause' | 'resume' | 'sync') => {
    setLoadingAction(`${id}-${action}`)
    await onAction(id, action)
    setLoadingAction(null)
  }

  const statuses = ['', 'active', 'warming', 'paused', 'blocked']

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">All Mailboxes</h3>
          <div className="flex gap-1 ml-auto">
            {statuses.map(s => (
              <button
                key={s}
                onClick={() => onStatusFilter(s)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                  statusFilter === s
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Rep</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Today</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">7d Bounce</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">7d Reply</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Last Sync</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mailboxes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No mailboxes found</td>
                </tr>
              ) : (
                mailboxes.map(mb => {
                  const sent = mb.emails_sent_today ?? 0
                  const limit = mb.daily_send_limit ?? 30
                  const pct = Math.min(100, Math.round((sent / limit) * 100))
                  const isLoading = (a: string) => loadingAction === `${mb.id}-${a}`

                  return (
                    <tr key={mb.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-foreground">{mb.email}</p>
                        <p className="text-[10px] text-muted-foreground">{mb.provider ?? mb.domain}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[mb.status] ?? ''}`}>
                          {mb.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3"><ReputationGauge score={mb.reputation_score} size="sm" /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground">{sent}/{limit}</span>
                          <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-green-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right text-xs ${mb.week_bounce_rate > 5 ? 'text-red-400' : mb.week_bounce_rate > 3 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                        {mb.week_bounce_rate.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {mb.week_reply_rate.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {timeAgo(mb.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onViewDetail(mb.id)} title="Details">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {mb.status === 'active' ? (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-400" onClick={() => handleAction(mb.id, 'pause')} disabled={isLoading('pause')} title="Pause">
                              {isLoading('pause') ? <WolfLoader variant="spinner" size={14} mode="amber" /> : <Pause className="h-3.5 w-3.5" />}
                            </Button>
                          ) : mb.status === 'paused' ? (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-400" onClick={() => handleAction(mb.id, 'resume')} disabled={isLoading('resume')} title="Resume">
                              {isLoading('resume') ? <WolfLoader variant="spinner" size={14} mode="amber" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleAction(mb.id, 'sync')} disabled={isLoading('sync')} title="Sync">
                            {isLoading('sync') ? <WolfLoader variant="spinner" size={14} mode="amber" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
