import { withAuth, jsonResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/onboarding/curated-clips
 *
 * Returns 4-5 curated trending clips for the first-clip onboarding overlay.
 * Kill switches:
 *  - Requires duration 15-45s and a real thumbnail
 *  - Returns canShow:false if fewer than 2 clips qualify (scraper outage, DMCA wave, etc.)
 *  - Diversifies niches: picks top clip from each niche before filling
 */
export const GET = withAuth(async (req, user) => {
  const rl = await rateLimit(`onboarding:${user.id}`, RATE_LIMITS.browse.limit, RATE_LIMITS.browse.windowMs)
  if (!rl.allowed) return jsonResponse({ clips: [], canShow: false })

  const admin = createAdminClient()

  // Fetch top candidates: 15-45s, real thumbnail, positive velocity
  const { data: candidates, error } = await admin
    .from('trending_clips')
    .select('id, title, author_name, author_handle, thumbnail_url, view_count, niche, duration_seconds, velocity_score, platform')
    .not('thumbnail_url', 'is', null)
    .gte('duration_seconds', 15)
    .lte('duration_seconds', 45)
    .gt('velocity_score', 0)
    .order('velocity_score', { ascending: false })
    .limit(30)

  // Kill switch 1: scraper outage or DMCA sweep left <2 eligible clips
  if (error || !candidates || candidates.length < 2) {
    return jsonResponse({ clips: [], canShow: false })
  }

  // Diversify niches: pick best clip per niche first, then fill to 5
  const byNiche = new Map<string, typeof candidates[0]>()
  const rest: typeof candidates = []

  for (const clip of candidates) {
    const niche = clip.niche ?? 'other'
    if (!byNiche.has(niche)) {
      byNiche.set(niche, clip)
    } else {
      rest.push(clip)
    }
  }

  const diversified = Array.from(byNiche.values()).slice(0, 5)
  for (const clip of rest) {
    if (diversified.length >= 5) break
    diversified.push(clip)
  }

  // Trim fields — no external_url exposed to client
  const clips = diversified.map(c => ({
    id: c.id,
    title: c.title,
    author_name: c.author_name,
    author_handle: c.author_handle,
    thumbnail_url: c.thumbnail_url,
    view_count: c.view_count,
    niche: c.niche,
    duration_seconds: c.duration_seconds,
    velocity_score: c.velocity_score,
    platform: c.platform,
  }))

  return jsonResponse({ clips, canShow: true })
})
