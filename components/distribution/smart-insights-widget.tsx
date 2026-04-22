'use client'

import { useEffect } from 'react'
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  BarChart3,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useSmartPublishingStore } from '@/stores/smart-publishing-store'

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  testing: { label: 'Testing', color: 'text-blue-400' },
  optimizing: { label: 'Optimizing', color: 'text-amber-400' },
  scaling: { label: 'Scaling', color: 'text-green-400' },
}

const MOMENTUM_ICONS = {
  rising: TrendingUp,
  neutral: Minus,
  declining: TrendingDown,
}

const MOMENTUM_COLORS = {
  rising: 'text-green-400',
  neutral: 'text-muted-foreground',
  declining: 'text-red-400',
}

interface SmartInsightsWidgetProps {
  platform?: string
}

export function SmartInsightsWidget({ platform = 'tiktok' }: SmartInsightsWidgetProps) {
  const {
    intelligence,
    recommendation,
    performances,
    loading,
    fetchIntelligence,
    fetchPerformances,
  } = useSmartPublishingStore()

  useEffect(() => {
    fetchIntelligence(platform)
    fetchPerformances(platform, 7)
  }, [platform, fetchIntelligence, fetchPerformances])

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Smart Publishing</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  const phase = intelligence?.phase ?? 'testing'
  const phaseCfg = PHASE_LABELS[phase]
  const momentum = intelligence?.current_momentum ?? 'neutral'
  const MomentumIcon = MOMENTUM_ICONS[momentum]
  const momentumColor = MOMENTUM_COLORS[momentum]

  // Posts this week
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const thisWeekPosts = performances.filter(
    p => new Date(p.posted_at) >= weekAgo
  ).length

  // Mini sparkline data: last 7 posts scores
  const recentScores = performances
    .slice(0, 7)
    .map(p => p.performance_score ?? 0)
    .reverse()

  const maxScore = Math.max(...recentScores, 1)

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Smart Publishing</h3>
          </div>
          <Badge variant="outline" className={`text-[10px] ${phaseCfg.color}`}>
            {phaseCfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Momentum + weekly count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MomentumIcon className={`h-3.5 w-3.5 ${momentumColor}`} />
            <span className={`text-xs font-medium ${momentumColor}`}>
              {momentum.charAt(0).toUpperCase() + momentum.slice(1)} momentum
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            <BarChart3 className="h-3 w-3 inline mr-1" />
            {thisWeekPosts} posts this week
          </span>
        </div>

        {/* Next recommended post */}
        {recommendation && (
          <div className="p-2 rounded-lg bg-muted/50 border border-border">
            {recommendation.should_post_now ? (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Ready to post</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs text-amber-400">
                  Next post in ~{Math.ceil(recommendation.wait_hours)}h
                </span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
              {recommendation.reason}
            </p>
          </div>
        )}

        {/* Mini sparkline */}
        {recentScores.length > 1 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Last 7 posts performance</p>
            <div className="flex items-end gap-1 h-8">
              {recentScores.map((score, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm transition-all ${
                    score >= 75 ? 'bg-green-400/60' :
                    score >= 50 ? 'bg-amber-400/60' :
                    score >= 25 ? 'bg-orange-400/60' : 'bg-red-400/60'
                  }`}
                  style={{ height: `${Math.max(8, (score / maxScore) * 100)}%` }}
                  title={`Score: ${Math.round(score)}`}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
