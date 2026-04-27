'use client'

import { memo, useState } from 'react'
import { Download, RefreshCw, CheckCircle, Loader2, XCircle, Clock, SplitSquareHorizontal, TimerOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/trending/utils'
import { RemixProgress } from '@/components/trending/remix-progress'
import { BeforeAfterPlayer } from '@/components/video/before-after-player'

export interface RemixJob {
  id: string
  clip_id: string
  source: string
  status: string
  storage_path: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  downloadUrl: string | null
  can_download: boolean
  clip: {
    title: string | null
    thumbnail_url: string | null
    platform: string
    velocity_score: number | null
    author_handle: string | null
  } | null
}

const STATUS_CONFIG: Record<string, {
  icon: typeof CheckCircle
  label: string
  color: string
  animate?: boolean
}> = {
  done: { icon: CheckCircle, label: 'Done', color: 'text-green-400' },
  rendering: { icon: Loader2, label: 'Rendering...', color: 'text-amber-400', animate: true },
  pending: { icon: Clock, label: 'In queue', color: 'text-muted-foreground', animate: false },
  error: { icon: XCircle, label: 'Failed', color: 'text-red-400' },
  expired: { icon: TimerOff, label: 'Expired', color: 'text-muted-foreground' },
}

export const RemixCard = memo(function RemixCard({ remix }: { remix: RemixJob }) {
  const isExpired = remix.status === 'expired'
  const statusConfig = STATUS_CONFIG[remix.status] ?? STATUS_CONFIG.pending
  const StatusIcon = statusConfig.icon
  const isInProgress = remix.status === 'pending' || remix.status === 'rendering'
  const [showProgress, setShowProgress] = useState(isInProgress)
  const [showCompare, setShowCompare] = useState(false)

  return (
    <article className="group rounded-xl border bg-card overflow-hidden transition-colors hover:border-primary/20">
      {/* Thumbnail or Before/After compare */}
      <div className="aspect-video bg-muted relative overflow-hidden">
        {showCompare && remix.downloadUrl ? (
          <BeforeAfterPlayer
            originalUrl={remix.downloadUrl}
            renderedUrl={remix.downloadUrl}
            thumbnailUrl={remix.clip?.thumbnail_url}
          />
        ) : remix.clip?.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={remix.clip.thumbnail_url}
            alt={remix.clip.title ?? 'Clip'}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-xs">
            No thumbnail
          </div>
        )}
        {/* Status badge */}
        {!showCompare && (
          <span className={cn(
            'absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm flex items-center gap-1',
            statusConfig.color
          )}>
            <StatusIcon className={cn('h-3 w-3', statusConfig.animate && 'animate-spin')} /> {statusConfig.label}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium leading-tight line-clamp-2">
          {remix.clip?.title ?? 'Clip'}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {remix.clip?.author_handle && (
            <span>@{remix.clip.author_handle}</span>
          )}
          <span>{timeAgo(remix.created_at)}</span>
        </div>

        {isExpired ? (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Free clips expire after 7 days &middot; Upgrade to Pro for 30 days
            </p>
            <a
              href={`/dashboard/enhance/${remix.clip_id}?source=${remix.source}`}
              className="w-full h-8 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Remix Again
            </a>
          </div>
        ) : (
          <div className="flex gap-2">
            {remix.can_download && remix.downloadUrl && (
              <a
                href={remix.downloadUrl}
                download
                className="flex-1 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-3 w-3" /> Download
              </a>
            )}
            {remix.can_download && remix.downloadUrl && (
              <button
                onClick={() => setShowCompare(!showCompare)}
                className={cn(
                  'h-8 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors',
                  showCompare ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                )}
              >
                <SplitSquareHorizontal className="h-3 w-3" /> Compare
              </button>
            )}
            <a
              href={`/dashboard/enhance/${remix.clip_id}?source=trending`}
              className="flex-1 h-8 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Re-edit
            </a>
          </div>
        )}
      </div>

      {/* Remix progress overlay for in-progress jobs */}
      {isInProgress && (
        <RemixProgress
          active={showProgress}
          clipTitle={remix.clip?.title ?? 'Clip'}
          onClose={() => setShowProgress(false)}
          error={remix.status === 'error' ? remix.error_message : null}
        />
      )}
    </article>
  )
})
