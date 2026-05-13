'use client'

import { useEffect, useState } from 'react'
import { Loader2, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LeaderboardTable } from '../../_components/analytics/leaderboard-table'

export default function AffiliatesAnalyticsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/analytics/affiliates')
      .then(r => r.json())
      .then(j => setData(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
  }

  const gold = data.filter((a: { tier: string }) => a.tier === 'gold').length
  const silver = data.filter((a: { tier: string }) => a.tier === 'silver').length
  const bronze = data.filter((a: { tier: string }) => a.tier === 'bronze').length

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Trophy className="h-5 w-5 text-amber-400" />
        <h1 className="text-xl font-bold text-zinc-100">Affiliate Leaderboard</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-yellow-400">🥇 {gold}</p>
          <p className="text-xs text-zinc-500">Gold (21+)</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-zinc-300">🥈 {silver}</p>
          <p className="text-xs text-zinc-500">Silver (6-20)</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-2xl font-bold text-amber-600">🥉 {bronze}</p>
          <p className="text-xs text-zinc-500">Bronze (1-5)</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Top 20 Affiliates</CardTitle></CardHeader>
        <CardContent>
          <LeaderboardTable data={data} />
        </CardContent>
      </Card>
    </div>
  )
}
