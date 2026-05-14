'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Zap, RefreshCw, Cpu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SaturationMonitor } from './_components/saturation-monitor'
import { MatchExplorer } from './_components/match-explorer'

export default function MatchEnginePage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [batchResult, setBatchResult] = useState<{ total: number; matched: number; fallbacks: number } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me').then(r => r.json()).then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true); setAuthLoading(false)
      }).catch(() => router.push('/dashboard'))
    })
  }, [router])

  const handleBatch = async () => {
    setComputing(true)
    setBatchResult(null)
    try {
      const supabase = createClient()
      const { data: influencers } = await supabase
        .from('influencers')
        .select('id')
        .gt('lead_score', 0)
        .in('status', ['contacted', 'replied', 'interested', 'demo_sent', 'onboarded', 'active'])
        .limit(100)

      if (influencers?.length) {
        const res = await fetch('/api/admin/match-engine/compute', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ influencerIds: influencers.map(i => i.id) }),
        })
        const json = await res.json()
        if (json.data) setBatchResult({ total: json.data.total, matched: json.data.matched, fallbacks: json.data.fallbacks })
      }
    } catch {} finally { setComputing(false) }
  }

  if (authLoading || !authorized) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-amber-400" />
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Match Engine</h1>
            <p className="text-xs text-zinc-500">Video-Influencer assignment (rule-based V1)</p>
          </div>
        </div>
        <Button onClick={handleBatch} disabled={computing} className="gap-1.5">
          {computing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {computing ? 'Computing...' : 'Batch Compute'}
        </Button>
      </div>

      {batchResult && (
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="text-center py-4">
            <p className="text-2xl font-bold text-zinc-200">{batchResult.total}</p>
            <p className="text-xs text-zinc-500">Processed</p>
          </CardContent></Card>
          <Card><CardContent className="text-center py-4">
            <p className="text-2xl font-bold text-amber-400">{batchResult.matched}</p>
            <p className="text-xs text-zinc-500">Matched</p>
          </CardContent></Card>
          <Card><CardContent className="text-center py-4">
            <p className="text-2xl font-bold text-orange-400">{batchResult.fallbacks}</p>
            <p className="text-xs text-zinc-500">Fallbacks</p>
          </CardContent></Card>
        </div>
      )}

      <SaturationMonitor />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-zinc-500" /> Match Explorer</CardTitle></CardHeader>
        <CardContent><MatchExplorer /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Algorithm V1</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3 text-center">
            {[
              { label: 'Niche', max: 35, color: 'text-emerald-400' },
              { label: 'Audience', max: 25, color: 'text-cyan-400' },
              { label: 'Language', max: 15, color: 'text-blue-400' },
              { label: 'Hook Fit', max: 15, color: 'text-amber-400' },
              { label: 'Lead Boost', max: 10, color: 'text-zinc-300' },
            ].map(f => (
              <div key={f.label} className="py-2">
                <p className={`text-lg font-bold ${f.color}`}>{f.max}</p>
                <p className="text-[10px] text-zinc-500">{f.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 text-center mt-2">Min score: 50 | Below = generic fallback | Saturation: 100/video/week</p>
        </CardContent>
      </Card>
    </div>
  )
}
