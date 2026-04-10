'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Film,
  Zap,
  AlertCircle,
  Loader2,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AnalyticsData {
  windowDays: number
  renders: {
    total: number
    done: number
    error: number
    rendering: number
    pending: number
    successRate: number | null
    avgDurationSec: number | null
  }
  usage: {
    plan: string
    videos: number
    videosLimit: number
    bonusVideos: number
    minutes: number
    minutesLimit: number
  }
  recent: Array<{
    id: string
    status: string
    source: string | null
    createdAt: string
    updatedAt: string | null
    errorMessage: string | null
  }>
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
    done: {
      label: 'Terminé',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      Icon: CheckCircle2,
    },
    error: {
      label: 'Erreur',
      className: 'bg-red-500/10 text-red-400 border-red-500/30',
      Icon: XCircle,
    },
    rendering: {
      label: 'En cours',
      className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      Icon: Loader2,
    },
    pending: {
      label: 'En attente',
      className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      Icon: Clock,
    },
  }
  const cfg = map[status] ?? map.pending
  const Icon = cfg.Icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        cfg.className,
      )}
    >
      <Icon className={cn('h-3 w-3', status === 'rendering' && 'animate-spin')} />
      {cfg.label}
    </span>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
}: {
  icon: typeof BarChart3
  label: string
  value: string
  sub?: string
  iconBg: string
  iconColor: string
}) {
  return (
    <Card className="bg-card/60 border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-2 rounded-lg', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>
        <div className="text-2xl font-black tracking-tight text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-1.5 opacity-70">{sub}</div>}
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/analytics', { cache: 'no-store' })
        const json = (await res.json()) as { data: AnalyticsData | null; message: string }
        if (cancelled) return
        if (!res.ok || !json.data) {
          setError(json.message || 'Erreur de chargement')
        } else {
          setData(json.data)
        }
      } catch {
        if (!cancelled) setError('Erreur réseau')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-muted/40 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-7 w-56 rounded bg-muted/40 animate-pulse" />
            <div className="h-4 w-72 rounded bg-muted/30 animate-pulse" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card/40 p-5 h-32 animate-pulse" />
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card/40 h-72 animate-pulse" />
      </div>
    )
  }

  // ── Error state ──
  if (error || !data) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <p className="text-destructive font-medium">{error ?? 'Données indisponibles'}</p>
        <Link href="/dashboard">
          <Button variant="outline">Retour au feed</Button>
        </Link>
      </div>
    )
  }

  const { renders, usage, recent, windowDays } = data
  const videoPct = Math.round((usage.videos / usage.videosLimit) * 100)
  const minutePct = Math.round((usage.minutes / usage.minutesLimit) * 100)

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl ring-1 ring-border">
          <BarChart3 className="h-8 w-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-0.5">
            Ton activité sur les {windowDays} derniers jours.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Film}
          label="Clips rendus"
          value={String(renders.done)}
          sub={`${renders.total} lancés au total`}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Taux de succès"
          value={renders.successRate !== null ? `${renders.successRate}%` : '—'}
          sub={
            renders.error > 0
              ? `${renders.error} erreur${renders.error > 1 ? 's' : ''}`
              : 'aucune erreur'
          }
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-400"
        />
        <StatCard
          icon={Clock}
          label="Temps de rendu médian"
          value={formatDuration(renders.avgDurationSec)}
          sub={renders.done > 0 ? `sur ${renders.done} rendus` : 'pas encore de données'}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-400"
        />
        <StatCard
          icon={Zap}
          label="Plan actuel"
          value={usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1)}
          sub={
            usage.bonusVideos > 0
              ? `${usage.videos}/${usage.videosLimit} + ${usage.bonusVideos} bonus`
              : `${usage.videos}/${usage.videosLimit} vidéos ce mois-ci`
          }
          iconBg="bg-amber-500/10"
          iconColor="text-amber-400"
        />
      </div>

      {/* Usage bars */}
      <Card className="bg-card/60 border-border">
        <CardContent className="p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Vidéos ce mois-ci</span>
              <span className="text-xs font-mono text-muted-foreground">
                {usage.videos}/{usage.videosLimit}
                {usage.bonusVideos > 0 && (
                  <span className="ml-1.5 text-emerald-400">+{usage.bonusVideos} bonus</span>
                )}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  videoPct >= 90
                    ? 'bg-red-500'
                    : videoPct >= 70
                    ? 'bg-amber-500'
                    : 'bg-blue-500',
                )}
                style={{ width: `${Math.min(100, videoPct)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Minutes de rendu</span>
              <span className="text-xs font-mono text-muted-foreground">
                {usage.minutes}/{usage.minutesLimit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  minutePct >= 90
                    ? 'bg-red-500'
                    : minutePct >= 70
                    ? 'bg-amber-500'
                    : 'bg-blue-500',
                )}
                style={{ width: `${Math.min(100, minutePct)}%` }}
              />
            </div>
          </div>
          {usage.plan === 'free' && (videoPct >= 70 || minutePct >= 70) && (
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Tu approches de tes limites. Passe à Pro pour débloquer 50 vidéos/mois.
              </p>
              <Link href="/settings">
                <Button size="sm" className="shrink-0">
                  Passer à Pro
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card className="bg-card/60 border-border">
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Activité récente</h2>
          {recent.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Aucun rendu sur les {windowDays} derniers jours.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recent.map((job) => (
                <div key={job.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground truncate">
                        {job.id.slice(0, 8)}
                      </span>
                      {job.source && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded">
                          {job.source}
                        </span>
                      )}
                    </div>
                    {job.errorMessage && (
                      <p className="text-xs text-red-400/80 mt-0.5 truncate">
                        {job.errorMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(job.createdAt)}
                    </span>
                    <StatusPill status={job.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
