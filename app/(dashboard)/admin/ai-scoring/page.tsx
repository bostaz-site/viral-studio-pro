'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Brain, Play, DollarSign, Target, CheckCircle, XCircle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Job {
  id: string
  job_type: string
  status: string
  total_leads: number | null
  processed_leads: number
  failed_leads: number
  cost_cents: number
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-400 border-green-400/40' },
  processing: { icon: Loader2, color: 'text-amber-400 border-amber-400/40' },
  queued: { icon: Clock, color: 'text-cyan-400 border-cyan-400/40' },
  failed: { icon: XCircle, color: 'text-red-400 border-red-400/40' },
}

export default function AiScoringPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)

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

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ai-scoring/jobs')
      const json = await res.json()
      if (json.data) setJobs(json.data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authorized) fetchJobs()
  }, [authorized, fetchJobs])

  const handleRunBatch = async () => {
    setRunning(true)
    try {
      await fetch('/api/admin/ai-scoring/jobs', { method: 'POST' })
      await fetchJobs()
    } catch { /* ignore */ }
    setRunning(false)
  }

  if (authLoading || !authorized) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  const totalProcessed = jobs.reduce((s, j) => s + j.processed_leads, 0)
  const totalCost = jobs.reduce((s, j) => s + (j.cost_cents ?? 0), 0) / 100
  const completedJobs = jobs.filter(j => j.status === 'completed').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg"><Brain className="h-5 w-5 text-purple-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Scoring</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Claude Haiku scores top 3% leads</p>
          </div>
        </div>
        <Button onClick={handleRunBatch} disabled={running} className="gap-1.5">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Batch Now
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Jobs Run" value={completedJobs} icon={<Target className="h-4 w-4" />} color="text-cyan-400" />
        <StatCard label="Leads Scored" value={totalProcessed} icon={<Brain className="h-4 w-4" />} color="text-purple-400" />
        <StatCard label="Total Cost" value={`$${totalCost.toFixed(2)}`} icon={<DollarSign className="h-4 w-4" />} color="text-amber-400" />
        <StatCard label="Avg Cost/Lead" value={totalProcessed > 0 ? `$${(totalCost / totalProcessed).toFixed(3)}` : '$0'} icon={<DollarSign className="h-4 w-4" />} color="text-green-400" />
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold text-foreground">Scoring Jobs</h3>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Processed</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Failed</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Cost</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Started</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Duration</th>
                </tr>
              </thead>
              <tbody>
                {loading && jobs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : jobs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No jobs yet. Click "Run Batch Now" to start.</td></tr>
                ) : (
                  jobs.map(j => {
                    const config = STATUS_CONFIG[j.status] ?? STATUS_CONFIG.queued
                    const Icon = config.icon
                    const duration = j.started_at && j.completed_at
                      ? `${Math.round((new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000)}s`
                      : '—'

                    return (
                      <tr key={j.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] gap-1 ${config.color}`}>
                            <Icon className={`h-3 w-3 ${j.status === 'processing' ? 'animate-spin' : ''}`} />
                            {j.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{j.job_type}</td>
                        <td className="px-4 py-3 text-right text-xs">{j.processed_leads}/{j.total_leads ?? '?'}</td>
                        <td className="px-4 py-3 text-right text-xs text-red-400">{j.failed_leads || '—'}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono">${((j.cost_cents ?? 0) / 100).toFixed(4)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {j.started_at ? new Date(j.started_at).toLocaleString('fr-CA', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{duration}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2"><div className={color}>{icon}</div><span className="text-xs text-muted-foreground">{label}</span></div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
