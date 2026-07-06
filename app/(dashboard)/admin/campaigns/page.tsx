'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pause, Play, Archive } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface Campaign {
  id: string
  name: string
  status: string
  created_at: string
  total_recipients: number
  total_sent: number
  total_replied: number
  total_opened: number
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-700 text-zinc-300',
  scheduled: 'bg-cyan-500/20 text-cyan-400',
  running: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-amber-500/20 text-amber-400',
  archived: 'bg-zinc-800 text-zinc-500',
}

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
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
          fetchCampaigns()
        })
        .catch(() => router.push('/dashboard'))
    })
  }, [router])

  const fetchCampaigns = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/campaigns')
    const json = await res.json()
    setCampaigns(json.data || [])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchCampaigns()
  }

  if (!authorized || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <WolfLoader variant="spinner" size={24} mode="amber" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-sm text-zinc-500">Manage cold email campaigns and export to Instantly</p>
        </div>
        <Button onClick={() => router.push('/admin/campaigns/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <p className="text-zinc-500">No campaigns yet</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/admin/campaigns/new')}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create your first campaign
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-xs text-zinc-500">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Recipients</th>
                <th className="p-3 text-right">Sent</th>
                <th className="p-3 text-right">Open Rate</th>
                <th className="p-3 text-right">Reply Rate</th>
                <th className="p-3 text-left">Created</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const openRate = c.total_sent > 0
                  ? ((c.total_opened / c.total_sent) * 100).toFixed(1)
                  : '-'
                const replyRate = c.total_sent > 0
                  ? ((c.total_replied / c.total_sent) * 100).toFixed(1)
                  : '-'

                return (
                  <tr
                    key={c.id}
                    className="border-t border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/admin/campaigns/${c.id}`)}
                  >
                    <td className="p-3 font-medium text-zinc-200">{c.name}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[c.status] || STATUS_COLORS.draft}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 text-right text-zinc-400">{c.total_recipients}</td>
                    <td className="p-3 text-right text-zinc-400">{c.total_sent}</td>
                    <td className="p-3 text-right text-zinc-400">{openRate}%</td>
                    <td className="p-3 text-right text-zinc-400">{replyRate}%</td>
                    <td className="p-3 text-zinc-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {c.status === 'running' && (
                          <button
                            onClick={() => updateStatus(c.id, 'paused')}
                            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-yellow-400"
                            title="Pause"
                          >
                            <Pause className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {c.status === 'paused' && (
                          <button
                            onClick={() => updateStatus(c.id, 'running')}
                            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-green-400"
                            title="Resume"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {c.status !== 'archived' && (
                          <button
                            onClick={() => updateStatus(c.id, 'archived')}
                            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                            title="Archive"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
