import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreAccount } from '@/lib/scoring/account-scorer'
import { getValidToken } from '@/lib/distribution/token-manager'

/**
 * POST /api/account/sync
 *
 * Syncs YouTube channel stats, computes creator score, and stores snapshot.
 * Rate limited: 1 sync per 24 hours per account.
 */
export const POST = withAuth(async (_req, user) => {
  const admin = createAdminClient()

  // Find the user's YouTube account
  const { data: account, error: accErr } = await admin
    .from('social_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'youtube')
    .single()

  if (accErr || !account) {
    return errorResponse('No YouTube account connected. Connect your channel in Settings first.', 404)
  }

  // Rate limit: 1 sync per 24h
  const today = new Date().toISOString().slice(0, 10)
  if (account.last_sync_date === today && (account.sync_count_today ?? 0) >= 1) {
    return errorResponse('Already synced today. Next sync available tomorrow.', 429)
  }

  // Get valid OAuth token (auto-refresh if expired)
  let accessToken: string
  try {
    const tokenSet = await getValidToken(user.id, 'youtube')
    if (!tokenSet) return errorResponse('YouTube token expired. Please reconnect your account.', 401)
    accessToken = tokenSet.accessToken
  } catch {
    return errorResponse('YouTube token expired. Please reconnect your account.', 401)
  }

  try {
    // 1. Fetch channel stats (1 quota unit)
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!channelRes.ok) {
      return errorResponse(`YouTube API error: ${channelRes.status}`, 502)
    }
    const channelData = await channelRes.json()
    const channel = channelData.items?.[0]
    if (!channel) return errorResponse('No YouTube channel found', 404)

    const stats = channel.statistics
    const followers = parseInt(stats.subscriberCount ?? '0')
    const totalViews = parseInt(stats.viewCount ?? '0')
    const videoCount = parseInt(stats.videoCount ?? '0')

    // 2. Fetch 20 most recent videos (100 quota units)
    const now = new Date()
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 3600 * 1000).toISOString()
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?forMine=true&type=video&order=date&maxResults=20&publishedAfter=${encodeURIComponent(threeMonthsAgo)}&part=id`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    let videoIds: string[] = []
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      videoIds = (searchData.items ?? [])
        .map((item: { id?: { videoId?: string } }) => item.id?.videoId)
        .filter(Boolean) as string[]
    }

    // 3. Fetch per-video stats (1 quota unit)
    let medianViews = 0
    let engagementRate = 0
    let daysSinceLastPost = 365
    let shortsRatio = 0
    let avgViews = 0

    if (videoIds.length > 0) {
      const videosRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.join(',')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (videosRes.ok) {
        const videosData = await videosRes.json()
        const videos = videosData.items ?? []

        // Parse per-video metrics
        const viewCounts: number[] = []
        const engagementRates: number[] = []
        let shortsCount = 0

        for (const v of videos) {
          const views = parseInt(v.statistics?.viewCount ?? '0')
          const likes = parseInt(v.statistics?.likeCount ?? '0')
          const comments = parseInt(v.statistics?.commentCount ?? '0')
          viewCounts.push(views)

          if (views > 0) {
            engagementRates.push((likes + comments) / views)
          }

          // Detect Shorts: duration < 61s (ISO 8601 duration)
          const dur = v.contentDetails?.duration ?? ''
          const totalSecs = parseDuration(dur)
          if (totalSecs > 0 && totalSecs <= 60) shortsCount++
        }

        // Most recent video date
        if (videos.length > 0 && videos[0].snippet?.publishedAt) {
          const lastPostDate = new Date(videos[0].snippet.publishedAt)
          daysSinceLastPost = Math.max(0, (now.getTime() - lastPostDate.getTime()) / (24 * 3600 * 1000))
        }

        // Median views
        viewCounts.sort((a, b) => a - b)
        medianViews = viewCounts.length > 0
          ? viewCounts[Math.floor(viewCounts.length / 2)]
          : 0

        // Avg views
        avgViews = viewCounts.length > 0
          ? viewCounts.reduce((s, v) => s + v, 0) / viewCounts.length
          : 0

        // Median engagement rate
        engagementRates.sort((a, b) => a - b)
        engagementRate = engagementRates.length > 0
          ? engagementRates[Math.floor(engagementRates.length / 2)]
          : 0

        shortsRatio = videos.length > 0 ? shortsCount / videos.length : 0
      }
    }

    // 4. Growth: compare to 30-day-old snapshot
    let growthPercent30d: number | null = null
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()
    const { data: oldSnapshot } = await admin
      .from('account_snapshots')
      .select('followers')
      .eq('account_id', account.id)
      .lte('captured_at', thirtyDaysAgo)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const snapFollowers = oldSnapshot?.followers as number | null | undefined
    if (snapFollowers && snapFollowers > 0) {
      growthPercent30d = ((followers - snapFollowers) / snapFollowers) * 100
    }

    // 5. Score
    const scores = scoreAccount({
      followers,
      total_views: totalViews,
      video_count: videoCount,
      median_views_per_video: medianViews,
      engagement_rate: engagementRate,
      growth_percent_30d: growthPercent30d,
      days_since_last_post: daysSinceLastPost,
      shorts_ratio: shortsRatio,
    })

    // 6. Update social_accounts
    await admin
      .from('social_accounts')
      .update({
        followers,
        total_views: totalViews,
        video_count: videoCount,
        avg_views_per_video: avgViews,
        median_views_per_video: medianViews,
        engagement_rate: engagementRate,
        creator_score: scores.creator_score,
        creator_rank: scores.creator_rank,
        last_synced_at: now.toISOString(),
        sync_count_today: today === account.last_sync_date ? (account.sync_count_today ?? 0) + 1 : 1,
        last_sync_date: today,
      })
      .eq('id', account.id)

    // 7. Insert snapshot (weekly if last weekly > 7d, else daily)
    const { data: lastWeekly } = await admin
      .from('account_snapshots')
      .select('captured_at')
      .eq('account_id', account.id)
      .eq('snapshot_type', 'weekly')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
    const snapshotType = !lastWeekly || new Date(lastWeekly.captured_at) < weekAgo ? 'weekly' : 'daily'

    await admin
      .from('account_snapshots')
      .insert({
        account_id: account.id,
        platform: 'youtube',
        followers,
        total_views: totalViews,
        video_count: videoCount,
        avg_views_per_video: avgViews,
        median_views_per_video: medianViews,
        engagement_rate: engagementRate,
        creator_score: scores.creator_score,
        creator_rank: scores.creator_rank,
        snapshot_type: snapshotType,
      })

    return jsonResponse({
      ...scores,
      followers,
      total_views: totalViews,
      video_count: videoCount,
      median_views_per_video: medianViews,
      engagement_rate: engagementRate,
      growth_percent_30d: growthPercent30d,
      shorts_ratio: shortsRatio,
      days_since_last_post: Math.round(daysSinceLastPost),
      snapshot_type: snapshotType,
      synced_at: now.toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[account/sync] ${msg}`)
    return errorResponse(`Sync failed: ${msg}`, 500)
  }
})

/** Parse ISO 8601 duration (PT1M30S) to seconds */
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  return (parseInt(match[1] ?? '0') * 3600) +
         (parseInt(match[2] ?? '0') * 60) +
         parseInt(match[3] ?? '0')
}
