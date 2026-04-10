import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/analytics — Usage & performance summary for the signed-in user.
 *
 * Returns:
 *   - renders.{total,done,error,rendering}: counts over the last 30 days
 *   - renders.successRate: done / (done + error) as a percentage (or null)
 *   - renders.avgDurationSec: median render wall time (done only), or null
 *   - usage.{videos,videosLimit,minutes,minutesLimit,plan}
 *   - recent: the 10 most recent render_jobs rows (lean shape)
 *
 * All data is already owned by the user via RLS + the user_id column —
 * we double-check with .eq('user_id', user.id) to be safe.
 */

interface RenderJobRow {
  id: string
  status: string
  created_at: string
  updated_at: string | null
  storage_path: string | null
  error_message: string | null
  source: string | null
}

interface ProfileRow {
  plan: string | null
  monthly_videos_used: number | null
  monthly_processing_minutes_used: number | null
}

const PLAN_VIDEO_LIMITS: Record<string, number> = { free: 3, pro: 50, studio: 999 }
const PLAN_MINUTES_LIMITS: Record<string, number> = { free: 30, pro: 500, studio: 5000 }

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export const GET = withAuth(async (_req, user) => {
  const admin = createAdminClient()

  // ── Window: last 30 days ──
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceIso = since.toISOString()

  // ── Fetch render jobs (last 30 days) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: jobsData, error: jobsError } = await (admin as any)
    .from('render_jobs')
    .select('id, status, created_at, updated_at, storage_path, error_message, source')
    .eq('user_id', user.id)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false }) as {
      data: RenderJobRow[] | null
      error: unknown
    }

  if (jobsError) {
    return NextResponse.json(
      { data: null, error: 'Failed to load render jobs', message: 'Impossible de charger l\'historique' },
      { status: 500 },
    )
  }

  const jobs = jobsData ?? []

  // ── Aggregate render stats ──
  const counts = { total: jobs.length, done: 0, error: 0, rendering: 0, pending: 0 }
  const doneDurations: number[] = []

  for (const j of jobs) {
    if (j.status === 'done') {
      counts.done++
      if (j.updated_at) {
        const durMs = new Date(j.updated_at).getTime() - new Date(j.created_at).getTime()
        if (Number.isFinite(durMs) && durMs > 0 && durMs < 30 * 60 * 1000) {
          // Reject >30min outliers (stuck jobs)
          doneDurations.push(durMs / 1000)
        }
      }
    } else if (j.status === 'error') {
      counts.error++
    } else if (j.status === 'rendering') {
      counts.rendering++
    } else {
      counts.pending++
    }
  }

  const completedOrFailed = counts.done + counts.error
  const successRate =
    completedOrFailed > 0 ? Math.round((counts.done / completedOrFailed) * 100) : null
  const avgDurationSec = median(doneDurations)

  // ── Fetch profile for usage + plan ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('plan, monthly_videos_used, monthly_processing_minutes_used')
    .eq('id', user.id)
    .single() as { data: ProfileRow | null }

  const plan = (profile?.plan ?? 'free') as string
  const usage = {
    plan,
    videos: profile?.monthly_videos_used ?? 0,
    videosLimit: PLAN_VIDEO_LIMITS[plan] ?? 3,
    minutes: profile?.monthly_processing_minutes_used ?? 0,
    minutesLimit: PLAN_MINUTES_LIMITS[plan] ?? 30,
  }

  // ── Recent activity (top 10) ──
  const recent = jobs.slice(0, 10).map((j) => ({
    id: j.id,
    status: j.status,
    source: j.source,
    createdAt: j.created_at,
    updatedAt: j.updated_at,
    errorMessage: j.error_message,
  }))

  return NextResponse.json({
    data: {
      windowDays: 30,
      renders: {
        ...counts,
        successRate,
        avgDurationSec,
      },
      usage,
      recent,
    },
    error: null,
    message: 'ok',
  })
})
