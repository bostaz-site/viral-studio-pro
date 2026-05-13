'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface SyncStatusCardProps {
  lastSyncAt: string | null
  nextSyncAt: string | null
  isSyncing: boolean
  success: boolean | null
}

export function SyncStatusCard({
  lastSyncAt,
  nextSyncAt,
  isSyncing,
  success,
}: SyncStatusCardProps) {
  const [now, setNow] = useState(Date.now())

  // Tick every 10s to update relative times
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(interval)
  }, [])

  const lastSyncRelative = lastSyncAt ? formatRelative(lastSyncAt, now) : null
  const nextSyncRelative = nextSyncAt ? formatRelative(nextSyncAt, now) : null

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Last Sync */}
          <div className="flex items-center gap-3">
            {isSyncing ? (
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            ) : success === true ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : success === false ? (
              <XCircle className="h-5 w-5 text-yellow-500" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <div className="font-medium">
                {isSyncing
                  ? 'Syncing...'
                  : lastSyncRelative
                    ? `Last sync: ${lastSyncRelative}`
                    : 'Never synced'}
              </div>
              {lastSyncAt && (
                <div className="text-xs text-muted-foreground">
                  {new Date(lastSyncAt).toLocaleString('fr-CA')}
                </div>
              )}
            </div>
          </div>

          {/* Next Sync */}
          {nextSyncAt && !isSyncing && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Next sync: {nextSyncRelative}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function formatRelative(iso: string, now: number): string {
  const target = new Date(iso).getTime()
  const diffSec = Math.round((target - now) / 1000)
  const absSec = Math.abs(diffSec)

  let label: string
  if (absSec < 60) {
    label = `${absSec}s`
  } else if (absSec < 3600) {
    label = `${Math.round(absSec / 60)} min`
  } else {
    label = `${Math.round(absSec / 3600)}h`
  }

  if (diffSec < 0) return `${label} ago`
  return `in ${label}`
}
