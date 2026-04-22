'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PLATFORM_META: Record<string, { name: string; color: string; bgColor: string }> = {
  tiktok: { name: 'TikTok', color: 'text-white', bgColor: 'bg-zinc-800' },
  youtube: { name: 'YouTube', color: 'text-red-400', bgColor: 'bg-red-500/10' },
  instagram: { name: 'Instagram', color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
}

interface PlatformStatsProps {
  stats: Record<string, { published: number; scheduled: number; failed: number }>
}

export function PlatformStats({ stats }: PlatformStatsProps) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <h3 className="text-sm font-semibold text-foreground">Performance by Platform</h3>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.entries(PLATFORM_META).map(([key, meta]) => {
            const s = stats[key] ?? { published: 0, scheduled: 0, failed: 0 }
            const total = s.published + s.scheduled + s.failed
            const comingSoon = key === 'tiktok' || key === 'instagram'

            return (
              <div
                key={key}
                className={`rounded-xl border border-border p-4 ${meta.bgColor}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-semibold ${meta.color}`}>{meta.name}</span>
                  {comingSoon && (
                    <Badge className="text-[8px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                      Coming Soon
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-lg font-bold text-foreground">{s.published}</p>
                    <p className="text-[10px] text-muted-foreground">Published</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{s.scheduled}</p>
                    <p className="text-[10px] text-muted-foreground">Scheduled</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{s.failed}</p>
                    <p className="text-[10px] text-muted-foreground">Failed</p>
                  </div>
                </div>

                {total > 0 && (
                  <div className="mt-3 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(s.published / total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
