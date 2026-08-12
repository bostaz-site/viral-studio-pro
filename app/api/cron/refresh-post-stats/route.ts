import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { getValidToken } from '@/lib/distribution/token-manager'
import { logAiCall } from '@/lib/ai/call-logger'
import { fetchPostStats as fetchYouTubeStats } from '@/lib/analytics/trackers/youtube'
import { fetchPostStats as fetchTikTokStats } from '@/lib/analytics/trackers/tiktok'
import { fetchPostStats as fetchMetaStats } from '@/lib/analytics/trackers/meta'
import type { Platform } from '@/lib/distribution/platforms'
import { logger } from '@/lib/logger'

/**
 * POST /api/cron/refresh-post-stats
 *
 * Cron job (every 6h) that polls platform APIs for post performance metrics.
 * Updates views/likes/comments/shares on published_posts rows.
 *
 * - Selects up to 100 posts where views IS NULL or last_checked_at is older than 6h
 * - For each: resolves the social_account, gets a valid token, calls the platform tracker
 * - Skips posts where the platform API is not yet approved (graceful)
 * - Always updates last_checked_at + check_count even on failure (distinguishes "never tried" from "tried and failed")
 * - Logs each attempt to ai_calls table for cost tracking
 */
export async function POST(req: NextRequest) {
  // ── Auth: CRON_SECRET ──
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  if (!apiKey || !cronSecret) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'API key missing' },
      { status: 401 },
    )
  }

  if (!timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Invalid API key' },
      { status: 401 },
    )
  }

  const admin = createAdminClient()
  const startTime = Date.now()

  // ── Fetch posts needing refresh ──
  // Posts where: no views yet, OR last_checked_at is older than 6h, AND have a platform_post_id
  const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString()

  const { data: posts, error: fetchError } = await (admin as ReturnType<typeof createAdminClient>)
    .from('published_posts' as 'profiles')
    .select('id, user_id, platform, account_id, platform_post_id, views, last_checked_at, check_count' as '*')
    .not('platform_post_id', 'is', null)
    .or(`views.is.null,last_checked_at.is.null,last_checked_at.lt.${sixHoursAgo}`)
    .limit(100) as { data: PublishedPostRow[] | null; error: unknown }

  if (fetchError || !posts || posts.length === 0) {
    const msg = posts?.length === 0
      ? 'No posts to refresh'
      : `Failed to fetch posts: ${fetchError instanceof Error ? fetchError.message : String(fetchError ?? 'unknown')}`
    logger.info(`[refresh-post-stats] ${msg}`)
    return NextResponse.json({
      data: { processed: 0, updated: 0, skipped: 0, errors: 0 },
      error: null,
      message: msg,
    })
  }

  // Per-platform counters for clear logging
  const platformStats: Record<string, { checked: number; updated: number; skipped: number; errors: number }> = {}
  const ensurePlatform = (p: string) => {
    if (!platformStats[p]) platformStats[p] = { checked: 0, updated: 0, skipped: 0, errors: 0 }
  }

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const post of posts) {
    const attemptStart = Date.now()
    const platform = post.platform as Platform
    ensurePlatform(platform)
    platformStats[platform].checked++

    try {
      // Get a valid token for this user+platform
      const tokenSet = await getValidToken(post.user_id, platform)

      if (!tokenSet) {
        skipped++
        platformStats[platform].skipped++
        // Still mark as checked so we don't retry immediately
        await markChecked(admin, post.id, post.check_count)
        continue
      }

      // Call the platform tracker
      let stats: { views: number; likes: number; comments: number; shares: number } | null = null

      switch (platform) {
        case 'youtube':
          stats = await fetchYouTubeStats(tokenSet.accessToken, post.platform_post_id!)
          break
        case 'tiktok':
          stats = await fetchTikTokStats(tokenSet.accessToken, post.platform_post_id!)
          break
        case 'instagram':
          stats = await fetchMetaStats(tokenSet.accessToken, post.platform_post_id!)
          break
        default:
          skipped++
          platformStats[platform].skipped++
          await markChecked(admin, post.id, post.check_count)
          continue
      }

      if (!stats) {
        // Tracker returned null — scope not approved or video not found
        skipped++
        platformStats[platform].skipped++
        await markChecked(admin, post.id, post.check_count)

        // Log explicit message when TikTok video.list scope is missing
        if (platform === 'tiktok' && process.env.TIKTOK_VIDEO_LIST_APPROVED !== 'true') {
          logger.info(`[refresh-post-stats] TikTok video.list scope not approved — skipping stats for post ${post.id}`)
        }
        continue
      }

      // Update the post with fresh metrics + mark checked
      await (admin as ReturnType<typeof createAdminClient>)
        .from('published_posts' as 'profiles')
        .update({
          views: stats.views,
          likes: stats.likes,
          comments: stats.comments,
          shares: stats.shares,
          last_checked_at: new Date().toISOString(),
          check_count: (post.check_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id' as never, post.id as never)

      updated++
      platformStats[platform].updated++

      void logAiCall({
        userId: post.user_id,
        model: `${platform}-api`,
        feature: 'post_stats_tracker',
        latencyMs: Date.now() - attemptStart,
        success: true,
        metadata: { postId: post.id, platform, views: stats.views },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors++
      platformStats[platform].errors++

      // Always update last_checked_at + check_count even on failure
      // so we can distinguish "never attempted" from "attempted and failed"
      await markChecked(admin, post.id, post.check_count)

      logger.error(`[refresh-post-stats] ${platform} error for post ${post.id}: ${msg}`)

      void logAiCall({
        userId: post.user_id,
        model: `${platform}-api`,
        feature: 'post_stats_tracker',
        latencyMs: Date.now() - attemptStart,
        success: false,
        error: msg,
        metadata: { postId: post.id, platform },
      })
    }
  }

  const totalMs = Date.now() - startTime

  // Clear per-platform summary log
  const platformSummary = Object.entries(platformStats)
    .map(([p, s]) => `${p}: ${s.checked} checked, ${s.updated} updated, ${s.skipped} skipped, ${s.errors} errors`)
    .join(' | ')

  logger.info(`[refresh-post-stats] Done in ${totalMs}ms — ${posts.length} posts processed, ${updated} updated, ${skipped} skipped, ${errors} errors | ${platformSummary}`)

  return NextResponse.json({
    data: {
      processed: posts.length,
      updated,
      skipped,
      errors,
      durationMs: totalMs,
      byPlatform: platformStats,
    },
    error: null,
    message: `Refreshed ${updated}/${posts.length} posts in ${totalMs}ms`,
  })
}

// ── Helpers ──

/** Update last_checked_at + increment check_count without touching metrics */
async function markChecked(
  admin: ReturnType<typeof createAdminClient>,
  postId: string,
  currentCheckCount: number | null,
) {
  await (admin as ReturnType<typeof createAdminClient>)
    .from('published_posts' as 'profiles')
    .update({
      last_checked_at: new Date().toISOString(),
      check_count: (currentCheckCount ?? 0) + 1,
    } as never)
    .eq('id' as never, postId as never)
}

// ── Internal type for the query result ──

interface PublishedPostRow {
  id: string
  user_id: string
  platform: string
  account_id: string | null
  platform_post_id: string | null
  views: number | null
  last_checked_at: string | null
  check_count: number | null
}
