import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'

export const metadata: Metadata = {
  title: 'Analytics | Viral Animal',
  description: 'Learning Engine — what works, what doesn\'t, and how distribution adapts',
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="animate-pulse space-y-6 p-6">
        <div className="h-64 bg-zinc-800/50 rounded-xl" />
        <div className="h-20 bg-zinc-800/50 rounded-xl" />
        <div className="h-40 bg-zinc-800/50 rounded-xl" />
      </div>
    }>
      <AnalyticsDashboard />
    </Suspense>
  )
}
