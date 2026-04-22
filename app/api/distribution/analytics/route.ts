import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAuth(async (req, user) => {
  const supabase = createAdminClient()
  const url = new URL(req.url)
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '30'), 90)

  const since = new Date()
  since.setDate(since.getDate() - days)

  // Get user's social account IDs first
  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('id')
    .eq('user_id', user.id)

  const accountIds = (accounts ?? []).map(a => a.id)

  // Fetch publications through social accounts
  let allPubs: { id: string; clip_id: string | null; platform: string; status: string | null; published_at: string | null; created_at: string | null; tracking_url: string | null }[] = []

  if (accountIds.length > 0) {
    const { data: publications } = await supabase
      .from('publications')
      .select('id, clip_id, platform, status, published_at, created_at, tracking_url')
      .in('social_account_id', accountIds)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })

    allPubs = publications ?? []
  }

  // Also fetch scheduled_publications
  const { data: scheduled } = await supabase
    .from('scheduled_publications')
    .select('id, clip_id, platform, status, scheduled_at, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })

  const allScheduled = scheduled ?? []

  // Stats calculation
  const totalPublished = allPubs.filter(p => p.status === 'published').length
  const totalScheduled = allScheduled.filter(s => s.status === 'scheduled').length
  const totalFailed = allPubs.filter(p => p.status === 'failed').length +
    allScheduled.filter(s => s.status === 'failed').length

  // Publications per day (last 7 days)
  const dailyStats: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dailyStats[d.toISOString().slice(0, 10)] = 0
  }
  for (const pub of allPubs) {
    if (pub.published_at) {
      const day = pub.published_at.slice(0, 10)
      if (day in dailyStats) dailyStats[day]++
    }
  }

  // Per-platform breakdown
  const platformStats: Record<string, { published: number; scheduled: number; failed: number }> = {}
  for (const platform of ['tiktok', 'youtube', 'instagram']) {
    platformStats[platform] = {
      published: allPubs.filter(p => p.platform === platform && p.status === 'published').length,
      scheduled: allScheduled.filter(s => s.platform === platform && s.status === 'scheduled').length,
      failed: allPubs.filter(p => p.platform === platform && p.status === 'failed').length +
        allScheduled.filter(s => s.platform === platform && s.status === 'failed').length,
    }
  }

  // Top clips (by number of platforms published)
  const clipPlatforms: Record<string, Set<string>> = {}
  for (const pub of allPubs.filter(p => p.status === 'published')) {
    if (!pub.clip_id) continue
    if (!clipPlatforms[pub.clip_id]) clipPlatforms[pub.clip_id] = new Set()
    clipPlatforms[pub.clip_id].add(pub.platform)
  }
  const topClips = Object.entries(clipPlatforms)
    .map(([clip_id, platforms]) => ({ clip_id, platforms: Array.from(platforms), count: platforms.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Viral account score (0-100)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const thisWeekPubs = allPubs.filter(p =>
    p.status === 'published' && p.published_at && new Date(p.published_at) >= weekAgo
  ).length

  const platformDiversity = Object.values(platformStats).filter(p => p.published > 0).length
  const regularityScore = Math.min(thisWeekPubs * 10, 40)
  const diversityScore = platformDiversity * 15
  const volumeScore = Math.min(totalPublished * 2, 15)
  const viralScore = Math.min(regularityScore + diversityScore + volumeScore, 100)

  return jsonResponse({
    totalPublished,
    totalScheduled,
    totalFailed,
    thisWeekPubs,
    viralScore,
    dailyStats: Object.entries(dailyStats).map(([date, count]) => ({ date, count })),
    platformStats,
    topClips,
  })
})
