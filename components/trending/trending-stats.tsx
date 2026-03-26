"use client"

import { Flame, TrendingUp, BarChart3, Gamepad2, Clock, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { TrendingStats } from '@/stores/trending-store'
import { cn } from '@/lib/utils'

interface TrendingStatsProps {
  stats: TrendingStats
  lastRefreshed: string | null
  loading?: boolean
}

const PLATFORM_LABELS: Record<string, string> = {
  twitch: 'Twitch',
  youtube_gaming: 'YouTube Gaming',
}

const PLATFORM_COLORS: Record<string, string> = {
  twitch: 'bg-purple-500',
  youtube_gaming: 'bg-red-500',
}

const GAME_LABELS: Record<string, string> = {
  fortnite: 'Fortnite',
  valorant: 'Valorant',
  league_of_legends: 'LoL',
  minecraft: 'Minecraft',
  gta: 'GTA',
  just_chatting: 'Just Chatting',
  irl: 'IRL',
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'jamais'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'à l\u2019instant'
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  return `il y a ${Math.floor(diff / 86400)}j`
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  loading,
}: {
  icon: typeof Flame
  label: string
  value: string | number
  sub?: string
  accent: string
  loading?: boolean
}) {
  return (
    <Card className="bg-card/60 border-border hover:border-primary/20 transition-colors">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={cn('p-2 rounded-lg shrink-0', accent)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <div className="h-6 w-16 bg-muted/50 rounded animate-pulse mt-1" />
          ) : (
            <>
              <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
              {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function TrendingStatsPanel({ stats, lastRefreshed, loading }: TrendingStatsProps) {
  // Platform breakdown bar
  const totalPlatforms = Object.values(stats.platforms).reduce((a, b) => a + b, 0)

  const topGameLabel = stats.topGame
    ? (GAME_LABELS[stats.topGame] ?? stats.topGame.charAt(0).toUpperCase() + stats.topGame.slice(1))
    : '--'

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <StatCard
          icon={BarChart3}
          label="Clips suivis"
          value={stats.total}
          accent="bg-blue-500/15 text-blue-400"
          loading={loading}
        />
        <StatCard
          icon={Flame}
          label="Viraux"
          value={stats.viral}
          sub={`Score \u2265 80`}
          accent="bg-orange-500/15 text-orange-400"
          loading={loading}
        />
        <StatCard
          icon={TrendingUp}
          label="Hot"
          value={stats.hot}
          sub={`Score \u2265 50`}
          accent="bg-yellow-500/15 text-yellow-400"
          loading={loading}
        />
        <StatCard
          icon={Zap}
          label="Velocity moy."
          value={stats.avgVelocity}
          accent="bg-indigo-500/15 text-indigo-400"
          loading={loading}
        />
        <StatCard
          icon={Gamepad2}
          label="Top jeu"
          value={topGameLabel}
          sub={stats.topGame ? `${stats.games[stats.topGame] ?? 0} clips` : undefined}
          accent="bg-emerald-500/15 text-emerald-400"
          loading={loading}
        />
        <StatCard
          icon={Clock}
          label="Dernier scan"
          value={formatTimeAgo(lastRefreshed)}
          sub={stats.lastScrapedAt ? `Scrape: ${formatTimeAgo(stats.lastScrapedAt)}` : 'n8n non connecté'}
          accent="bg-slate-500/15 text-slate-400"
          loading={loading}
        />
      </div>

      {/* Platform breakdown bar */}
      {totalPlatforms > 0 && !loading && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted/30 flex">
            {Object.entries(stats.platforms).map(([platform, count]) => {
              const pct = (count / totalPlatforms) * 100
              return (
                <div
                  key={platform}
                  className={cn('h-full transition-all duration-500', PLATFORM_COLORS[platform] ?? 'bg-gray-500')}
                  style={{ width: `${pct}%` }}
                  title={`${PLATFORM_LABELS[platform] ?? platform}: ${count} (${Math.round(pct)}%)`}
                />
              )
            })}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            {Object.entries(stats.platforms).map(([platform, count]) => (
              <span key={platform} className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full', PLATFORM_COLORS[platform] ?? 'bg-gray-500')} />
                {PLATFORM_LABELS[platform] ?? platform} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
