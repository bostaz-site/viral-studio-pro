import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { isAuditMode } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/is-admin'
import { logger } from '@/lib/logger'

/**
 * GET /api/trending/counts — Lightweight endpoint returning clip counts per tab.
 * Used by browse page for tab badges, radar, and "remaining" counts.
 */
export async function GET(req: NextRequest) {
  if (isAuditMode) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admin = user ? await isAdminUser(supabase, user.id) : false
    if (!admin) {
      return NextResponse.json({ data: null, error: 'Unavailable' }, { status: 403 })
    }
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`browse-counts:${ip}`, RATE_LIMITS.browse.limit, RATE_LIMITS.browse.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ data: null, error: 'Rate limited' }, { status: 429 })
  }

  try {
    const admin = createAdminClient()

    // Run all count queries in parallel
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [explodingRes, provenRes, freshRes, allRes, legendaryRes] = await Promise.all([
      // Exploding Now = early_gem + hot_now
      admin.from('trending_clips').select('id', { count: 'exact', head: true })
        .in('feed_category', ['early_gem', 'hot_now']),
      // Proven Winners
      admin.from('trending_clips').select('id', { count: 'exact', head: true })
        .eq('feed_category', 'proven'),
      // Fresh Drops = clip_created_at within 24h
      admin.from('trending_clips').select('id', { count: 'exact', head: true })
        .gte('clip_created_at', twentyFourHoursAgo),
      // All
      admin.from('trending_clips').select('id', { count: 'exact', head: true }),
      // Legendary (velocity_score >= 80)
      admin.from('trending_clips').select('id', { count: 'exact', head: true })
        .gte('velocity_score', 80),
    ])

    return NextResponse.json({
      data: {
        exploding: explodingRes.count ?? 0,
        proven: provenRes.count ?? 0,
        fresh: freshRes.count ?? 0,
        all: allRes.count ?? 0,
        legendary: legendaryRes.count ?? 0,
      },
      error: null,
    })
  } catch (err) {
    logger.error('[Trending Counts] Error:', err)
    return NextResponse.json({ data: null, error: 'Failed to fetch counts' }, { status: 500 })
  }
}
