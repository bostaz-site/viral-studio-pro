'use client'

import { useEffect, useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CohortTable } from '../../_components/analytics/cohort-table'

export default function CohortsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/analytics/cohorts')
      .then(r => r.json())
      .then(j => setData(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-purple-400" />
        <h1 className="text-xl font-bold text-zinc-100">Cohort Retention</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Cohorts — Retention</CardTitle>
        </CardHeader>
        <CardContent>
          <CohortTable data={data} />
        </CardContent>
      </Card>

      <p className="text-xs text-zinc-600">
        M+N = % of cohort still active N months after prospection. Color: green &gt;60%, amber 30-60%, red &lt;30%.
      </p>
    </div>
  )
}
