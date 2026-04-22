'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  Filter,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ScheduledPublication } from '@/stores/schedule-store'

const PLATFORM_LABELS: Record<string, { name: string; color: string }> = {
  tiktok: { name: 'TikTok', color: 'bg-zinc-800 text-white' },
  youtube: { name: 'YouTube', color: 'bg-red-500/20 text-red-400' },
  instagram: { name: 'Instagram', color: 'bg-pink-500/20 text-pink-400' },
}

interface PublicationHistoryProps {
  queue: ScheduledPublication[]
}

export function PublicationHistory({ queue }: PublicationHistoryProps) {
  const [platformFilter, setPlatformFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  const history = queue.filter(item =>
    ['published', 'failed', 'cancelled'].includes(item.status)
  )

  const filtered = history.filter(item => {
    if (platformFilter && item.platform !== platformFilter) return false
    if (statusFilter && item.status !== statusFilter) return false
    return true
  })

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Publication History</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {history.length} total publications
            </p>
          </div>
          <Filter className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="flex gap-1">
            {['tiktok', 'youtube', 'instagram'].map(p => (
              <button
                key={p}
                onClick={() => setPlatformFilter(platformFilter === p ? null : p)}
                className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                  platformFilter === p
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {PLATFORM_LABELS[p]?.name ?? p}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-border self-center" />
          <div className="flex gap-1">
            {['published', 'failed', 'cancelled'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No publications yet</p>
          </div>
        ) : (
          filtered.map(item => {
            const platformCfg = PLATFORM_LABELS[item.platform]
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50"
              >
                <Badge className={`shrink-0 text-[10px] ${platformCfg?.color ?? ''}`}>
                  {platformCfg?.name ?? item.platform}
                </Badge>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.caption?.slice(0, 60) || `Clip ${item.clip_id.slice(0, 8)}...`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(item.scheduled_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {item.status === 'published' ? (
                  <Badge variant="outline" className="text-[10px] gap-1 text-green-400 border-green-400/40">
                    <CheckCircle2 className="h-3 w-3" />
                    Published
                  </Badge>
                ) : item.status === 'failed' ? (
                  <Badge variant="outline" className="text-[10px] gap-1 text-red-400 border-red-400/40">
                    <AlertCircle className="h-3 w-3" />
                    Failed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground border-border">
                    Cancelled
                  </Badge>
                )}

                {item.publish_result && (item.publish_result as Record<string, string>).trackingUrl && (
                  <a
                    href={(item.publish_result as Record<string, string>).trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
