import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/withAuth'
import { isAdminUser } from '@/lib/admin/is-admin'

/**
 * GET /api/admin/render-contracts
 *
 * Returns feature application rates over the last 7 days from render_jobs.contract.
 * Admin-only. Used by the admin dashboard to spot silently failing features.
 */
export const GET = withAuth(async (_request, user) => {
  const admin = createAdminClient()
  const isAdmin = await isAdminUser(admin, user.id)
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 403 })
  }
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // contract column added by migration 20260824 — not in generated Supabase types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: jobs, error } = await (admin as any)
    .from('render_jobs')
    .select('status, contract')
    .in('status', ['done', 'degraded'])
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  interface ContractEntry {
    feature: string
    requested: boolean
    applied: boolean
  }

  const featureStats: Record<string, { requested: number; applied: number }> = {}
  let totalJobs = 0
  let degradedJobs = 0

  for (const job of (jobs ?? []) as { status: string; contract: ContractEntry[] | null }[]) {
    totalJobs++
    if (job.status === 'degraded') degradedJobs++

    const contract = job.contract
    if (!Array.isArray(contract)) continue

    for (const entry of contract) {
      if (!featureStats[entry.feature]) {
        featureStats[entry.feature] = { requested: 0, applied: 0 }
      }
      if (entry.requested) {
        featureStats[entry.feature].requested++
        if (entry.applied) featureStats[entry.feature].applied++
      }
    }
  }

  const features = Object.entries(featureStats)
    .map(([feature, stats]) => ({
      feature,
      requested: stats.requested,
      applied: stats.applied,
      rate: stats.requested > 0 ? Math.round((stats.applied / stats.requested) * 100) : 100,
    }))
    .sort((a, b) => a.rate - b.rate) // worst first

  return NextResponse.json({
    data: {
      features,
      totalJobs,
      degradedJobs,
      degradedRate: totalJobs > 0 ? Math.round((degradedJobs / totalJobs) * 100) : 0,
      periodDays: 7,
    },
    error: null,
  })
})
