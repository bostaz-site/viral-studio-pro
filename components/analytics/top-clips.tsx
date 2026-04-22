'use client'

import { Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: 'bg-zinc-800 text-white',
  youtube: 'bg-red-500/20 text-red-400',
  instagram: 'bg-pink-500/20 text-pink-400',
}

interface TopClipsProps {
  clips: { clip_id: string; platforms: string[]; count: number }[]
}

export function TopClips({ clips }: TopClipsProps) {
  if (clips.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            Top Clips
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No published clips yet. Start distributing!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          Top Clips
        </h3>
        <p className="text-xs text-muted-foreground">By number of platforms published</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {clips.map((clip, i) => (
          <div
            key={clip.clip_id}
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50"
          >
            <span className={`text-sm font-bold w-6 text-center ${
              i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-orange-600' : 'text-muted-foreground'
            }`}>
              #{i + 1}
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {clip.clip_id.slice(0, 12)}...
              </p>
            </div>

            <div className="flex gap-1">
              {clip.platforms.map(p => (
                <Badge key={p} className={`text-[9px] px-1.5 ${PLATFORM_COLORS[p] ?? ''}`}>
                  {p}
                </Badge>
              ))}
            </div>

            <span className="text-xs text-muted-foreground font-medium">
              {clip.count} platform{clip.count > 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
