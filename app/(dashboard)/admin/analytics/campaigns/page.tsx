'use client'

import { useEffect, useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CampaignTable } from '../../_components/analytics/campaign-table'

export default function CampaignsAnalyticsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/analytics/campaigns')
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
        <Mail className="h-5 w-5 text-blue-400" />
        <h1 className="text-xl font-bold text-zinc-100">Campaign Performance</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>All Campaigns</CardTitle></CardHeader>
        <CardContent>
          <CampaignTable data={data} />
        </CardContent>
      </Card>
    </div>
  )
}
