'use client'

import { useEffect, useState } from 'react'
import { DollarSign } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RevenueChart } from '../../_components/analytics/revenue-chart'

interface RevenueMetrics {
  mrr: number
  arr: number
  totalCustomers: number
  planBreakdown: { plan: string; count: number; mrr: number }[]
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/analytics/revenue')
      .then(r => r.json())
      .then(j => setData(j.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return <div className="flex items-center justify-center py-20"><WolfLoader variant="spinner" size={24} mode="amber" /></div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-5 w-5 text-green-400" />
        <h1 className="text-xl font-bold text-zinc-100">Revenue Dashboard</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-green-400">{fmt(data.mrr)}</p>
          <p className="text-xs text-zinc-500">MRR</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-zinc-100">{fmt(data.arr)}</p>
          <p className="text-xs text-zinc-500">ARR Projection</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-amber-400">{data.totalCustomers}</p>
          <p className="text-xs text-zinc-500">Paying Customers</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>MRR by Plan</CardTitle></CardHeader>
        <CardContent>
          <RevenueChart data={data.planBreakdown} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Plan Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.planBreakdown.map(p => (
              <div key={p.plan} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-zinc-300 capitalize">{p.plan}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-zinc-500">{p.count} users</span>
                  <span className="text-sm font-mono text-green-400">{fmt(p.mrr)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
