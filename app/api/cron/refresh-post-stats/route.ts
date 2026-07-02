import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { getValidToken } from '@/lib/distribution/token-manager'
import { logAiCall } from '@/lib/ai/call-logger'
import { fetchPostStats as fetchYouTubeStats } from '@/lib/analytics/trackers/youtube'
import { fetchPostStats as fetchTikTokStats } from '@/lib/analytics/trackers/tiktok'
import { fetchPostStats as fetchMetaStats } from '@/lib/analytics/trackers/meta'
import type { Platform } from '@/lib/distribution/platforms'

/**
 * POST /api/cron/refresh-post-stats
 *
 * Cron job (every 6h) that polls platform APIs for post performance metrics.
 * Updates views/likes/comments/shares on published_posts rows.
 *
 * - Selects up to 100 posts where views IS NULL or updated_at is older than 6h
 * - For each: resolves the social_account, gets a valid token, calls the platform tracker
 * - Skips posts where the platform API is not yet approved (graceful)
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
  // Posts where: no views yet, OR updated more than 6h ago AND have a platform_post_id
  const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString()

  const { data: posts, error: fetchError } = await (admin as ReturnType<typeof createAdminClient>)
    .from('published_posts' as 'profiles')
    .select('id, user_id, platform, account_id, platform_post_id, views, updated_at' as '*')
    .not('platform_post_id', 'is', null)
    .or(`views.is.null,updated_at.lt.${sixHoursAgo}`)
    .limit(100) as { data: PublishedPostRow[] | null; error: unknown }

  if (fetchError || !posts || posts.length === 0) {
    return NextResponse.json({
      data: { processed: 0, updated: 0, skipped: 0, errors: 0 },
      error: null,
      message: posts?.length === 0 ? 'No posts to refresh' : 'Failed to fetch posts',
    })
  }

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const post of posts) {
    const attemptStart = Date.now()

    try {
      // Get a valid token for this user+platform
      const platform = post.platform as Platform
      const tokenSet = await getValidToken(post.user_id, platform)

      if (!tokenSet) {
        skipped++
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
          continue
      }

      if (!stats) { skipped++; continue }

      // Update the post with fresh metrics
      await (admin as ReturnType<typeof createAdminClient>)
        .from('published_posts' as 'profiles')
        .update({
          views: stats.views,
          likes: stats.likes,
          comments: stats.comments,
          shares: stats.shares,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id' as never, post.id as never)

      updated++

      // Log success
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

      // Skip gracefully if API not approved
      if (msg.includes('not yet approved')) {
        skipped++
        continue
      }

      // Retry once on transient errors
      try {
        const platform = post.platform as Platform
        const tokenSet = await getValidToken(post.user_id, platform)
        if (!tokenSet) { skipped++; continue }

        let stats: { views: number; likes: number; comments: number; shares: number } | null = null
        switch (platform) {
          case 'youtube': stats = await fetchYouTubeStats(tokenSet.accessToken, post.platform_post_id!); break
          case 'tiktok': stats = await fetchTikTokStats(tokenSet.accessToken, post.platform_post_id!); break
          case 'instagram': stats = await fetchMetaStats(tokenSet.accessToken, post.platform_post_id!); break
          default: skipped++; continue
        }
        if (!stats) { skipped++; continue }

        await (admin as ReturnType<typeof createAdminClient>)
          .from('published_posts' as 'profiles')
          .update({
            views: stats.views,
            likes: stats.likes,
            comments: stats.comments,
            shares: stats.shares,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id' as never, post.id as never)

        updated++
      } catch (retryErr) {
        errors++
        void logAiCall({
          userId: post.user_id,
          model: `${post.platform}-api`,
          feature: 'post_stats_tracker',
          latencyMs: Date.now() - attemptStart,
          success: false,
          error: retryErr instanceof Error ? retryErr.message : String(retryErr),
          metadata: { postId: post.id, platform: post.platform, attempt: 'retry' },
        })
      }
    }
  }

  const totalMs = Date.now() - startTime

  return NextResponse.json({
    data: { processed: posts.length, updated, skipped, errors, durationMs: totalMs },
    error: null,
    message: `Refreshed ${updated}/${posts.length} posts in ${totalMs}ms`,
  })
}

// ── Internal type for the query result ──

interface PublishedPostRow {
  id: string
  user_id: string
  platform: string
  account_id: string | null
  platform_post_id: string | null
  views: number | null
  updated_at: string
}
