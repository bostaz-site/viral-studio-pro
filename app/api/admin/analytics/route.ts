import { NextResponse, type NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The dashboard aggregates these event families into named funnels the
// admin page can render without doing math in the browser.
const DEMO_FUNNEL = [
  'demo_view',
  'demo_clip_switch',
  'demo_caption_switch',
  'demo_split_toggle',
  'demo_cta_click',
] as const

const EXIT_INTENT_FUNNEL = [
  'exit_intent_shown',
  'exit_intent_submitted',
  'exit_intent_dismissed',
] as const

const CTA_EVENTS = [
  'cta_hero_click',
  'cta_pricing_click',
  'cta_signup_click',
] as const

const PAGE_VIEW_EVENTS = [
  'page_view',
  'demo_view',
  'pricing_view',
  'changelog_view',
] as const

interface AnalyticsRow {
  id: number
  session_id: string
  event_name: string
  page_path: string | null
  metadata: Record<string, string | number | boolean> | null
  created_at: string
}

interface FunnelStep {
  name: string
  count: number
  uniqueSessions: number
}

interface TopMetadataValue {
  value: string
  count: number
}

interface AnalyticsResponse {
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

function buildSteps(
  rows: AnalyticsRow[],
  events: readonly string[],
): FunnelStep[] {
  return events.map((name) => {
    const matching = rows.filter((r) => r.event_name === name)
    const uniqueSessions = new Set(matching.map((r) => r.session_id)).size
    return { name, count: matching.length, uniqueSessions }
  })
}

function topValues(
  rows: AnalyticsRow[],
  eventName: string,
  metadataKey: string,
  limit = 5,
): TopMetadataValue[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (r.event_name !== eventName) continue
    const v = r.metadata?.[metadataKey]
    if (v === undefined || v === null) continue
    const key = String(v)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }))
}

export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const windowDaysRaw = Number(url.searchParams.get('days') ?? '14')
  const windowDays = Number.isFinite(windowDaysRaw)
    ? Math.min(Math.max(Math.round(windowDaysRaw), 1), 90)
    : 14

  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  const admin = createAdminClient()

  // Pull up to 5000 recent rows — enough for meaningful funnel math at this
  // scale without paginating. If volume grows we'll move to materialized views.
  const { data, error } = await (admin.from('analytics_events' as never) as unknown as {
    select: (cols: string) => {
      gte: (col: string, v: string) => {
        order: (col: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{
            data: AnalyticsRow[] | null
            error: { message: string } | null
          }>
        }
      }
    }
  })
    .select('id, session_id, event_name, page_path, metadata, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message, message: 'Query failed' },
      { status: 500 },
    )
  }

  const rows = data ?? []
  const uniqueSessions = new Set(rows.map((r) => r.session_id)).size

  const response: AnalyticsResponse = {
    windowDays,
    totalEvents: rows.length,
    uniqueSessions,
    demoFunnel: buildSteps(rows, DEMO_FUNNEL),
    exitIntentFunnel: buildSteps(rows, EXIT_INTENT_FUNNEL),
    ctaClicks: buildSteps(rows, CTA_EVENTS),
    pageViews: buildSteps(rows, PAGE_VIEW_EVENTS),
    topDemoClips: topValues(rows, 'demo_clip_switch', 'clip_id'),
    topCaptionStyles: topValues(rows, 'demo_caption_switch', 'style'),
    recent: rows.slice(0, 30).map((r) => ({
      id: r.id,
      event_name: r.event_name,
      page_path: r.page_path,
      created_at: r.created_at,
    })),
  }

  return NextResponse.json({ data: response, error: null, message: 'ok' })
})
