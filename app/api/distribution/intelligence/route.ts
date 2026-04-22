import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  detectPhase,
  analyzePerformances,
  classifyPerformance,
  getPublishRecommendation,
  type PublicationPerformance,
  type AccountIntelligence,
} from '@/lib/distribution/smart-publisher'

const analyzeSchema = z.object({
  platform: z.enum(['tiktok', 'youtube', 'instagram']),
})

// GET: Fetch account intelligence + recommendation
export const GET = withAuth(async (req, user) => {
  const supabase = createAdminClient()
  const url = new URL(req.url)
  const platform = url.searchParams.get('platform') ?? 'tiktok'

  // Fetch intelligence record
  const { data: intelligence } = await supabase
    .from('account_intelligence')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', platform)
    .single()

  // Fetch recent performances for recommendation
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data: performances } = await supabase
    .from('publication_performance')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', platform)
    .gte('posted_at', since.toISOString())
    .order('posted_at', { ascending: false })
    .limit(100)

  const recommendation = getPublishRecommendation(
    intelligence as AccountIntelligence | null,
    (performances ?? []) as PublicationPerformance[],
    platform
  )

  return jsonResponse({
    intelligence: intelligence ?? null,
    recommendation,
  })
})

// POST: Trigger full analysis — recalculate patterns and update intelligence
export const POST = withAuth(async (req, user) => {
  const body = await req.json()
  const parsed = analyzeSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { platform } = parsed.data
  const supabase = createAdminClient()

  // Fetch all performances for this platform
  const { data: performances, error: perfErr } = await supabase
    .from('publication_performance')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', platform)
    .order('posted_at', { ascending: false })
    .limit(200)

  if (perfErr) return errorResponse(perfErr.message, 500)

  const perfs = (performances ?? []) as PublicationPerformance[]
  const totalPosts = perfs.length
  const phase = detectPhase(totalPosts)
  const analysis = analyzePerformances(perfs, platform)

  // Determine last post performance
  let lastPostPerformance: string | null = null
  let lastPostAt: string | null = null
  let consecutiveFlops = 0
  let consecutiveHits = 0

  if (perfs.length > 0) {
    lastPostAt = perfs[0].posted_at

    // Fetch or create existing intelligence to get thresholds
    const { data: existingIntel } = await supabase
      .from('account_intelligence')
      .select('hot_threshold, viral_threshold, flop_threshold')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .single()

    const thresholds = {
      hot_threshold: analysis.adjustedHotThreshold || existingIntel?.hot_threshold || 75,
      viral_threshold: existingIntel?.viral_threshold || 90,
      flop_threshold: analysis.adjustedFlopThreshold || existingIntel?.flop_threshold || 25,
    }

    if (perfs[0].performance_score != null) {
      lastPostPerformance = classifyPerformance(perfs[0].performance_score, {
        ...thresholds,
      } as AccountIntelligence)
    }

    // Count consecutive flops/hits from most recent
    for (const p of perfs) {
      if (p.performance_score == null) break
      if (p.performance_score < thresholds.flop_threshold) {
        if (consecutiveHits === 0) consecutiveFlops++
        else break
      } else if (p.performance_score >= thresholds.hot_threshold) {
        if (consecutiveFlops === 0) consecutiveHits++
        else break
      } else {
        break
      }
    }
  }

  // Upsert intelligence record
  const intelligenceData = {
    user_id: user.id,
    platform,
    phase,
    total_posts: totalPosts,
    best_hours: JSON.parse(JSON.stringify(analysis.bestHours)),
    worst_hours: JSON.parse(JSON.stringify(analysis.worstHours)),
    optimal_posts_per_day: analysis.optimalPostsPerDay,
    optimal_min_hours_between: null as number | null,
    best_clip_duration_range: analysis.bestDurationRange ? JSON.parse(JSON.stringify(analysis.bestDurationRange)) : null,
    captions_boost_percent: analysis.captionsBoost,
    split_screen_boost_percent: analysis.splitScreenBoost,
    last_post_performance: lastPostPerformance,
    last_post_at: lastPostAt,
    consecutive_flops: consecutiveFlops,
    consecutive_hits: consecutiveHits,
    current_momentum: analysis.momentum,
    hot_threshold: analysis.adjustedHotThreshold || 75,
    viral_threshold: 90,
    flop_threshold: analysis.adjustedFlopThreshold || 25,
    updated_at: new Date().toISOString(),
  }

  const { data: intel, error: upsertErr } = await supabase
    .from('account_intelligence')
    .upsert(intelligenceData, { onConflict: 'user_id' })
    .select()
    .single()

  if (upsertErr) return errorResponse(upsertErr.message, 500)

  // Generate recommendation with fresh intelligence
  const recommendation = getPublishRecommendation(
    intel as unknown as AccountIntelligence,
    perfs,
    platform
  )

  return jsonResponse({
    intelligence: intel,
    recommendation,
    analysis: {
      totalAnalyzed: totalPosts,
      phase,
      momentum: analysis.momentum,
      bestHours: analysis.bestHours,
      captionsBoost: analysis.captionsBoost,
      splitScreenBoost: analysis.splitScreenBoost,
      bestDurationRange: analysis.bestDurationRange,
    },
  })
})
