'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2, ArrowLeft, Download, Pause, Play, Archive, Users, Mail, Eye, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface CampaignDetail {
  id: string
  name: string
  description: string | null
  status: string
  target_segment: { niches?: string[]; platforms?: string[]; mailbox_id?: string } | null
  sequence_steps: { step_index: number; subject?: string; body?: string }[]
  total_recipients: number
  total_sent: number
  total_opened: number
  total_replied: number
  total_bounced: number
  total_unsubscribed: number
  created_at: string
  updated_at: string
  recipients: Recipient[]
  export_files: ExportFile[]
}

interface Recipient {
  id: string
  influencer_id: string
  status: string
  sent_at: string | null
  last_event_at: string | null
}

interface ExportFile {
  name: string
  created_at: string
  size: number | null
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-700 text-zinc-300',
  scheduled: 'bg-cyan-500/20 text-cyan-400',
  running: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-amber-500/20 text-amber-400',
  archived: 'bg-zinc-800 text-zinc-500',
}

const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  queued: 'bg-zinc-700 text-zinc-300',
  scheduled: 'bg-cyan-500/20 text-cyan-400',
  sent: 'bg-green-500/20 text-green-400',
  opened: 'bg-cyan-500/20 text-cyan-400',
  clicked: 'bg-teal-500/20 text-teal-400',
  replied: 'bg-emerald-500/20 text-emerald-400',
  bounced: 'bg-red-500/20 text-red-400',
  unsubscribed: 'bg-orange-500/20 text-orange-400',
  failed: 'bg-red-500/20 text-red-400',
  skipped: 'bg-zinc-800 text-zinc-500',
}

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((d) => {
          if (!d.isAdmin) { router.push('/dashboard'); return }
          setAuthorized(true)
          fetchCampaign()
        })
        .catch(() => router.push('/dashboard'))
    })
  }, [router, campaignId])

  const fetchCampaign = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/campaigns/${campaignId}`)
    const json = await res.json()
    if (json.data) setCampaign(json.data)
    setLoading(false)
  }

  const updateStatus = async (status: string) => {
    await fetch(`/api/admin/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchCampaign()
  }

  const downloadExport = async (fileName: string) => {
    const supabase = createClient()
    const { data } = await supabase.storage
      .from('campaign-exports')
      .createSignedUrl(`${campaignId}/${fileName}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (!authorized || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="py-20 text-center text-zinc-500">Campaign not found</div>
    )
  }

  const openRate = campaign.total_sent > 0
    ? ((campaign.total_opened / campaign.total_sent) * 100).toFixed(1)
    : '0'
  const replyRate = campaign.total_sent > 0
    ? ((campaign.total_replied / campaign.total_sent) * 100).toFixed(1)
    : '0'
  const bounceRate = campaign.total_sent > 0
    ? ((campaign.total_bounced / campaign.total_sent) * 100).toFixed(1)
    : '0'

  // Recipient status breakdown
  const recipientStats = campaign.recipients.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/campaigns')}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
            {campaign.description && (
              <p className="text-sm text-zinc-500">{campaign.description}</p>
            )}
          </div>
          <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs ${STATUS_COLORS[campaign.status]}`}>
            {campaign.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === 'draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/campaigns/new`)}
            >
              Edit
            </Button>
          )}
          {campaign.status === 'running' && (
            <Button variant="outline" size="sm" onClick={() => updateStatus('paused')}>
              <Pause className="mr-1 h-3.5 w-3.5" />
              Pause
            </Button>
          )}
          {campaign.status === 'paused' && (
            <Button variant="outline" size="sm" onClick={() => updateStatus('running')}>
              <Play className="mr-1 h-3.5 w-3.5" />
              Resume
            </Button>
          )}
          {campaign.status !== 'archived' && (
            <Button variant="outline" size="sm" onClick={() => updateStatus('archived')}>
              <Archive className="mr-1 h-3.5 w-3.5" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={Users} label="Recipients" value={campaign.total_recipients} />
        <MetricCard icon={Mail} label="Sent" value={campaign.total_sent} />
        <MetricCard icon={Eye} label="Open Rate" value={`${openRate}%`} />
        <MetricCard icon={MessageSquare} label="Reply Rate" value={`${replyRate}%`} />
      </div>

      {/* Detailed stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Recipient status breakdown */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">Recipient Status Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(recipientStats).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs ${RECIPIENT_STATUS_COLORS[status] || RECIPIENT_STATUS_COLORS.queued}`}>
                  {status}
                </span>
                <span className="text-sm text-zinc-400">{count}</span>
              </div>
            ))}
            {Object.keys(recipientStats).length === 0 && (
              <p className="text-sm text-zinc-500">No recipients yet</p>
            )}
          </div>
        </div>

        {/* Rates */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">Performance</h3>
          <div className="space-y-2">
            <RateBar label="Open Rate" value={parseFloat(openRate)} color="bg-cyan-500" />
            <RateBar label="Reply Rate" value={parseFloat(replyRate)} color="bg-green-500" />
            <RateBar label="Bounce Rate" value={parseFloat(bounceRate)} color="bg-red-500" />
          </div>
        </div>
      </div>

      {/* Target info */}
      {campaign.target_segment && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
          <h3 className="text-sm font-medium text-zinc-300">Target Segment</h3>
          <div className="flex flex-wrap gap-2">
            {(campaign.target_segment.niches || []).map((n) => (
              <span key={n} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-400">
                {n}
              </span>
            ))}
            {(campaign.target_segment.platforms || []).map((p) => (
              <span key={p} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs capitalize text-amber-400">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Export logs */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Export History</h3>
        {campaign.export_files.length === 0 ? (
          <p className="text-sm text-zinc-500">No exports yet</p>
        ) : (
          <div className="space-y-2">
            {campaign.export_files.map((f) => (
              <div
                key={f.name}
                className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 p-2"
              >
                <div>
                  <span className="text-sm text-zinc-300">{f.name}</span>
                  {f.size && (
                    <span className="ml-2 text-xs text-zinc-600">
                      {(f.size / 1024).toFixed(1)}KB
                    </span>
                  )}
                </div>
                <button
                  onClick={() => downloadExport(f.name)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <Download className="h-3 w-3" />
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recipients table */}
      {campaign.recipients.length > 0 && (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-900 px-4 py-2">
            <h3 className="text-sm font-medium text-zinc-300">
              Recipients ({campaign.recipients.length})
            </h3>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900 text-xs text-zinc-500">
                <tr>
                  <th className="p-2 text-left">Influencer ID</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Sent At</th>
                  <th className="p-2 text-left">Last Event</th>
                </tr>
              </thead>
              <tbody>
                {campaign.recipients.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-800/50">
                    <td className="p-2 font-mono text-xs text-zinc-400">
                      {r.influencer_id.slice(0, 8)}...
                    </td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${RECIPIENT_STATUS_COLORS[r.status] || RECIPIENT_STATUS_COLORS.queued}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-zinc-500">
                      {r.sent_at ? new Date(r.sent_at).toLocaleString() : '-'}
                    </td>
                    <td className="p-2 text-xs text-zinc-500">
                      {r.last_event_at ? new Date(r.last_event_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-white">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  )
}

function RateBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-300">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}
