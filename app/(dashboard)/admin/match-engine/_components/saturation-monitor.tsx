'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SatEntry { videoId: string; title: string; niche: string[]; assignmentsLast7d: number; saturated: boolean; remaining: number }

export function SaturationMonitor() {
  const [data, setData] = useState<SatEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/match-engine/saturation')
      .then(r => r.json()).then(j => setData(j.data ?? []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-8"><WolfLoader variant="spinner" size={20} mode="amber" /></div>

  return (
    <Card>
      <CardHeader><CardTitle>Video Saturation (7-day window)</CardTitle></CardHeader>
      <CardContent>
        {!data.length ? <p className="text-sm text-zinc-500">No active videos</p> : (
          <div className="space-y-3">
            {data.map(v => (
              <div key={v.videoId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{v.title}</p>
                  <p className="text-xs text-zinc-500">{(v.niche ?? []).join(', ') || 'generic'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {v.saturated && <AlertTriangle className="h-4 w-4 text-red-400" />}
                  <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${v.saturated ? 'bg-red-500' : v.assignmentsLast7d > 70 ? 'bg-orange-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, v.assignmentsLast7d)}%` }} />
                  </div>
                  <span className={`text-xs font-mono ${v.saturated ? 'text-red-400' : 'text-zinc-400'}`}>{v.assignmentsLast7d}/100</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
