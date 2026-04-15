'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  MousePointerClick,
  Eye,
  LogOut,
  Loader2,
  AlertCircle,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FunnelStep {
  name: string
  count: number
  uniqueSessions: number
}

interface TopMetadataValue {
  value: string
  count: number
}

interface AnalyticsData {
  windowDays: number
  totalEvents: number
  uniqueSessions: number
  demoFunnel: FunnelStep[]
  exitIntentFunnel: FunnelStep[]
  ctaClicks: FunnelStep[]
  pageViews: FunnelStep[]
  topDemoClips: TopMetadataValue[]
  topCaptionStyles: TopMetadataValue[]
  recent: Array<{
    id: number
    event_name: string
    page_path: string | null
    created_at: string
  }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))
  if (diffSec < 60) return `il y a ${diffSec}s`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.round(diffH / 24)
  return `il y a ${diffD} j`
}

function conversionRate(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  const pct = (numerator / denominator) * 100
  return `${pct.toFixed(1)}%`
}

// Map raw event names to shorter human-friendly labels.
const LABELS: Record<string, string> = {
  demo_view: 'Demo view',
  demo_clip_switch: 'Switch clip',
  demo_caption_switch: 'Switch caption style',
  demo_split_toggle: 'Toggle split-screen',
  demo_cta_click: 'Demo CTA clicked',
  exit_intent_shown: 'Popup shown',
  exit_intent_submitted: 'Email submitted',
  exit_intent_dismissed: 'Popup dismissed',
  cta_hero_click: 'CTA hero',
  cta_pricing_click: 'CTA pricing',
  cta_signup_click: 'CTA signup',
  page_view: 'Page view',
  pricing_view: 'View /pricing',
  changelog_view: 'View /changelog',
}

function label(name: string): string {
  return LABELS[name] ?? name
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [windowDays, setWindowDays] = useState(14)

  const load = useCallback(async (days: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/analytics?days=${days}`, {
        cache: 'no-store',
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (res.status === 403) {
        setError("Access denied. This page is for admins only.")
        return
      }
      const json = (await res.json()) as {
        data: AnalyticsData | null
        error: string | null
      }
      if (!res.ok || !json.data) {
        setError(json.error ?? 'Erreur de chargement')
        return
      }
      setData(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load(windowDays)
  }, [load, windowDays])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-2">
                <Activity className="h-3 w-3" />
                Admin
              </div>
              <h1 className="text-3xl font-black tracking-tight">Analytics</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Funnel de conversion sur les {windowDays} derniers jours — lecture seule.
              </p>
            </div>

            {/* Window selector */}
            <div className="flex items-center gap-2">
              {[7, 14, 30, 90].map((d) => (
                <Button
                  key={d}
                  variant={d === windowDays ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setWindowDays(d)}
                  disabled={loading}
                >
                  {d}j
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {loading && !data && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading metrics…
          </div>
        )}

        {error && (
          <Card className="border-rose-500/30 bg-rose-500/5">
            <CardContent className="flex items-start gap-3 p-5">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Error</p>
                <p className="text-sm text-muted-foreground mt-0.5">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* KPI strip */}
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                icon={<Activity className="h-4 w-4" />}
                label="Total events"
                value={data.totalEvents.toLocaleString('en-US')}
              />
              <KpiCard
                icon={<Eye className="h-4 w-4" />}
                label="Unique sessions"
                value={data.uniqueSessions.toLocaleString('en-US')}
              />
              <KpiCard
                icon={<MousePointerClick className="h-4 w-4" />}
                label="Events / session"
                value={
                  data.uniqueSessions > 0
                    ? (data.totalEvents / data.uniqueSessions).toFixed(1)
                    : '—'
                }
              />
            </div>

            {/* Page views */}
            <Section title="Vues de page" icon={<Eye className="h-4 w-4" />}>
              <StepTable steps={data.pageViews} showSessions />
            </Section>

            {/* Demo funnel */}
            <Section
              title="Interactive demo funnel"
              icon={<Sparkles className="h-4 w-4" />}
              subtitle="From /demo load to CTA click"
            >
              <StepTable steps={data.demoFunnel} showSessions />
              {data.demoFunnel[0] && (
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                  Demo → CTA conversion:{' '}
                  <span className="font-bold text-foreground">
                    {conversionRate(
                      data.demoFunnel.find((s) => s.name === 'demo_cta_click')?.uniqueSessions ?? 0,
                      data.demoFunnel.find((s) => s.name === 'demo_view')?.uniqueSessions ?? 0,
                    )}
                  </span>
                </div>
              )}
            </Section>

            {/* Exit intent funnel */}
            <Section
              title="Exit-intent funnel"
              icon={<LogOut className="h-4 w-4" />}
              subtitle="Lead magnet popup on landing"
            >
              <StepTable steps={data.exitIntentFunnel} showSessions />
              {data.exitIntentFunnel[0] && (
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                  Submission rate:{' '}
                  <span className="font-bold text-foreground">
                    {conversionRate(
                      data.exitIntentFunnel.find((s) => s.name === 'exit_intent_submitted')
                        ?.uniqueSessions ?? 0,
                      data.exitIntentFunnel.find((s) => s.name === 'exit_intent_shown')
                        ?.uniqueSessions ?? 0,
                    )}
                  </span>
                </div>
              )}
            </Section>

            {/* CTA clicks */}
            <Section title="CTA clicks" icon={<MousePointerClick className="h-4 w-4" />}>
              <StepTable steps={data.ctaClicks} showSessions />
            </Section>

            {/* Top demo interactions */}
            <div className="grid gap-6 md:grid-cols-2">
              <Section title="Top demo clips" icon={<TrendingUp className="h-4 w-4" />}>
                <TopList items={data.topDemoClips} />
              </Section>
              <Section title="Top caption styles" icon={<TrendingUp className="h-4 w-4" />}>
                <TopList items={data.topCaptionStyles} />
              </Section>
            </div>

            {/* Recent activity */}
            <Section title="Recent activity" icon={<Activity className="h-4 w-4" />}>
              <div className="divide-y divide-border">
                {data.recent.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No events in this window.
                  </p>
                )}
                {data.recent.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{label(row.event_name)}</p>
                      {row.page_path && (
                        <p className="text-xs text-muted-foreground truncate">
                          {row.page_path}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelative(row.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card className="border-border bg-card/40">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <span className="text-primary">{icon}</span>
          <span className="uppercase tracking-wider font-semibold">{label}</span>
        </div>
        <p className="text-3xl font-black">{value}</p>
      </CardContent>
    </Card>
  )
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string
  subtitle?: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="border-border bg-card/40">
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
          <div>
            <p className="text-sm font-bold">{title}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function StepTable({
  steps,
  showSessions,
}: {
  steps: FunnelStep[]
  showSessions?: boolean
}) {
  const maxCount = Math.max(1, ...steps.map((s) => s.count))
  return (
    <div className="space-y-2">
      {steps.map((s) => {
        const pct = (s.count / maxCount) * 100
        return (
          <div key={s.name}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="font-semibold">{label(s.name)}</span>
              <span className="tabular-nums text-muted-foreground">
                {s.count.toLocaleString('fr-FR')}
                {showSessions && (
                  <span className="ml-1 text-[10px]">
                    ({s.uniqueSessions} sess.)
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TopList({ items }: { items: TopMetadataValue[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No data yet.
      </p>
    )
  }
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = (item.count / max) * 100
        return (
          <div key={item.value}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="font-semibold truncate">{item.value}</span>
              <span className="tabular-nums text-muted-foreground">{item.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
