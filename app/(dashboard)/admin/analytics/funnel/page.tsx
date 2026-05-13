'use client'

import { useEffect, useState } from 'react'
import { Loader2, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FunnelChart } from '../../_components/analytics/funnel-chart'

interface FunnelStage { stage: string; count: number; pct: number }

export default function FunnelPage() {
  const [data, setData] = useState<FunnelStage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/analytics/funnel')
      .then(r => r.json())
      .then(j => setData(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
  }

  // KPI cards from funnel data
  const total = data[0]?.count ?? 0
  const replied = data.find(d => d.stage === 'replied')?.count ?? 0
  const paying = data.find(d => d.stage === 'paying')?.count ?? 0

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Filter className="h-5 w-5 text-amber-400" />
        <h1 className="text-xl font-bold text-zinc-100">Acquisition Funnel</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-zinc-100">{total.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">Total Leads</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-green-400">{replied.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">Replied+</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-amber-400">{paying}</p>
          <p className="text-xs text-zinc-500">Paying</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Emails → MRR Pipeline</CardTitle></CardHeader>
        <CardContent>
          <FunnelChart data={data} />
        </CardContent>
      </Card>
    </div>
  )
}
