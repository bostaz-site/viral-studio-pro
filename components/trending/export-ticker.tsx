// TODO: Wire this component into app/(dashboard)/dashboard/page.tsx (live export social proof)
'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExportEvent {
  id: string
  score: number | null
  rank: string
  platform: string
  timestamp: string
}

const RANK_LABELS: Record<string, string> = {
  mega_viral: 'Master',
  viral: 'Legendary',
  hot: 'Epic',
  rising: 'Rare',
  normal: '',
  dead: '',
}

function formatEvent(event: ExportEvent): string {
  const rankLabel = RANK_LABELS[event.rank] || ''
  const scoreStr = event.score ? ` (Score ${Math.round(event.score)})` : ''
  const prefix = rankLabel ? `a ${rankLabel} clip` : 'a clip'
  return `A creator just exported ${prefix}${scoreStr}`
}

export function ExportTicker() {
  const [events, setEvents] = useState<ExportEvent[]>([])
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('export-feed')
      .on('broadcast', { event: 'new_export' }, (payload) => {
        const event: ExportEvent = {
          id: crypto.randomUUID(),
          ...payload.payload,
        }

        setEvents(prev => [event, ...prev].slice(0, 5))
        setVisible(true)

        // Auto-hide after 8 seconds
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setVisible(false), 8000)
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const latestEvent = events[0]
  if (!latestEvent) return null

  return (
    <div className={cn(
      'transition-all duration-500 overflow-hidden',
      visible ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0'
    )}>
      <div className="flex items-center justify-center gap-2 py-1.5 px-4 bg-primary/5 border border-primary/10 rounded-lg text-xs text-muted-foreground">
        <Zap className="h-3 w-3 text-primary animate-pulse" />
        <span>{formatEvent(latestEvent)}</span>
        <span className="text-muted-foreground/40">just now</span>
      </div>
    </div>
  )
}
