'use client'

import { useEffect, useState } from 'react'
import {
  Clock,
  Trash2,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Calendar,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useScheduleStore, type ScheduledPublication } from '@/stores/schedule-store'
import { useSmartPublishingStore } from '@/stores/smart-publishing-store'
import { evaluateTimingQuality, type TimingQuality } from '@/lib/distribution/smart-publisher'

const PLATFORM_LABELS: Record<string, { name: string; color: string }> = {
  tiktok: { name: 'TikTok', color: 'bg-zinc-800 text-white' },
  youtube: { name: 'YouTube', color: 'bg-red-500/20 text-red-400' },
  instagram: { name: 'Instagram', color: 'bg-pink-500/20 text-pink-400' },
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  scheduled: {
    icon: <Clock className="h-3.5 w-3.5" />,
    color: 'text-blue-400 border-blue-400/40',
    label: 'Scheduled',
  },
  publishing: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: 'text-amber-400 border-amber-400/40',
    label: 'Publishing...',
  },
  published: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'text-green-400 border-green-400/40',
    label: 'Published',
  },
  failed: {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    color: 'text-red-400 border-red-400/40',
    label: 'Failed',
  },
  cancelled: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: 'text-muted-foreground border-border',
    label: 'Cancelled',
  },
}

const TIMING_CONFIG: Record<TimingQuality, { color: string; label: string }> = {
  great: { color: 'text-green-400', label: 'Great timing' },
  ok: { color: 'text-amber-400', label: 'OK timing' },
  poor: { color: 'text-red-400', label: 'Poor timing' },
}

interface ScheduleQueueProps {
  onAddClick?: () => void
}

export function ScheduleQueue({ onAddClick }: ScheduleQueueProps) {
  const { queue, queueLoading, queueError, fetchQueue, cancelScheduled, deleteScheduled } = useScheduleStore()
  const { intelligence, recommendation } = useSmartPublishingStore()
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'published' | 'failed'>('all')

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const filtered = filter === 'all'
    ? queue
    : queue.filter(item => item.status === filter)

  // Momentum alerts
  const lastPerf = intelligence?.last_post_performance
  const showViralAlert = lastPerf === 'viral' || lastPerf === 'hot'
  const showFlopAlert = (intelligence?.consecutive_flops ?? 0) >= 3

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Publication Queue</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Smart scheduling with anti-shadowban protection
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={onAddClick}>
            <Plus className="h-4 w-4" />
            Schedule
          </Button>
        </div>

        {/* Momentum Alerts */}
        {showViralAlert && recommendation && !recommendation.should_post_now && (
          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/20">
            <AlertTriangle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-green-400 font-medium">
                Your last clip is performing well!
              </p>
              <p className="text-[10px] text-green-400/70 mt-0.5">
                {recommendation.reason}
                {recommendation.wait_hours > 0 && (
                  <> — wait ~{Math.ceil(recommendation.wait_hours)}h</>
                )}
              </p>
            </div>
          </div>
        )}

        {showFlopAlert && (
          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
            <TrendingDown className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-red-400 font-medium">
                Account momentum is declining
              </p>
              <p className="text-[10px] text-red-400/70 mt-0.5">
                Your last {intelligence?.consecutive_flops} posts underperformed. Quality &gt; quantity right now.
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mt-3">
          {(['all', 'scheduled', 'published', 'failed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <span className="ml-1 opacity-60">
                  ({queue.filter(i => i.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {queueLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : queueError ? (
          <div className="flex items-center gap-2 py-4 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" />
            {queueError}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No scheduled publications</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Schedule your first clip to get started
            </p>
          </div>
        ) : (
          filtered.map(item => (
            <QueueItem
              key={item.id}
              item={item}
              intelligence={intelligence}
              onCancel={() => cancelScheduled(item.id)}
              onDelete={() => deleteScheduled(item.id)}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

function QueueItem({
  item,
  intelligence,
  onCancel,
  onDelete,
}: {
  item: ScheduledPublication
  intelligence: ReturnType<typeof useSmartPublishingStore.getState>['intelligence']
  onCancel: () => void
  onDelete: () => void
}) {
  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.scheduled
  const platformCfg = PLATFORM_LABELS[item.platform]

  // Evaluate timing quality
  const scheduledHour = new Date(item.scheduled_at).getHours()
  const timingQuality = item.status === 'scheduled'
    ? evaluateTimingQuality(scheduledHour, intelligence, item.platform)
    : null
  const timingCfg = timingQuality ? TIMING_CONFIG[timingQuality] : null

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50 hover:bg-muted/30 transition-colors">
      {/* Timing indicator */}
      {timingCfg && (
        <div className={`shrink-0 w-1.5 h-8 rounded-full ${
          timingQuality === 'great' ? 'bg-green-400' :
          timingQuality === 'ok' ? 'bg-amber-400' : 'bg-red-400'
        }`} title={timingCfg.label} />
      )}

      {/* Platform badge */}
      <Badge className={`shrink-0 text-[10px] ${platformCfg?.color ?? ''}`}>
        {platformCfg?.name ?? item.platform}
      </Badge>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {item.caption?.slice(0, 60) || `Clip ${item.clip_id.slice(0, 8)}...`}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground">
            <Clock className="h-3 w-3 inline mr-1" />
            {new Date(item.scheduled_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}{' '}
            at{' '}
            {new Date(item.scheduled_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {timingCfg && (
            <span className={`text-[10px] ${timingCfg.color}`}>{timingCfg.label}</span>
          )}
        </div>
      </div>

      {/* Status */}
      <Badge variant="outline" className={`shrink-0 text-[10px] gap-1 ${statusCfg.color}`}>
        {statusCfg.icon}
        {statusCfg.label}
      </Badge>

      {/* Actions */}
      {item.status === 'scheduled' && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-amber-400"
          onClick={onCancel}
          title="Cancel"
        >
          <XCircle className="h-3.5 w-3.5" />
        </Button>
      )}
      {(item.status === 'cancelled' || item.status === 'failed') && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-red-400"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
