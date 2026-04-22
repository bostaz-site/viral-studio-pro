'use client'

import { useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useScheduleStore } from '@/stores/schedule-store'
import { PlatformStats } from './platform-stats'
import { TopClips } from './top-clips'
import { ViralScore } from '@/components/distribution/viral-score'
import { PublicationsChart } from './publications-chart'

export function AnalyticsDashboard() {
  const { analytics, analyticsLoading, fetchAnalytics } = useScheduleStore()

  useEffect(() => {
    fetchAnalytics(30)
  }, [fetchAnalytics])

  if (analyticsLoading && !analytics) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const data = analytics

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your distribution performance across platforms
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Published"
          value={data?.totalPublished ?? 0}
          icon={<TrendingUp className="h-4 w-4" />}
          color="text-green-400"
        />
        <StatCard
          label="Scheduled"
          value={data?.totalScheduled ?? 0}
          icon={<Calendar className="h-4 w-4" />}
          color="text-blue-400"
        />
        <StatCard
          label="This Week"
          value={data?.thisWeekPubs ?? 0}
          icon={<BarChart3 className="h-4 w-4" />}
          color="text-amber-400"
        />
        <StatCard
          label="Failed"
          value={data?.totalFailed ?? 0}
          icon={<AlertCircle className="h-4 w-4" />}
          color="text-red-400"
        />
      </div>

      {/* Chart + Viral Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <PublicationsChart data={data?.dailyStats ?? []} />
        </div>
        <ViralScore score={data?.viralScore ?? 0} />
      </div>

      {/* Platform stats */}
      <PlatformStats stats={data?.platformStats ?? {}} />

      {/* Top clips */}
      <TopClips clips={data?.topClips ?? []} />
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={color}>{icon}</div>
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
