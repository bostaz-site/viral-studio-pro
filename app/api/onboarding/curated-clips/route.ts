import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Minimum clips required to show the onboarding overlay.
// If fewer are available (e.g. scraper outage), we silently skip onboarding.
const MIN_CLIPS_REQUIRED = 3
const CLIPS_TO_FETCH = 6  // fetch a few extra, return top 5 diverse ones

export interface CuratedClip {
  id: string
  title: string | null
  thumbnail_url: string | null
  author_name: string | null
  view_count: number | null
  duration_seconds: number | null
  niche: string | null
  velocity_score: number | null
}

/**
 * GET /api/onboarding/curated-clips
 *
 * Returns up to 5 pre-curated clips for the onboarding overlay.
 * Kill switch: if fewer than MIN_CLIPS_REQUIRED qualify, returns { sufficient: false }
 * so the caller can silently skip onboarding rather than show broken content.
 *
 * Selection criteria:
 * - duration 15-45s (optimal short-form)
 * - has a thumbnail_url
 * - top velocity_score
 * - 2-3 diverse niches (FPS, IRL, reaction spread)
 */
export const GET = withAuth(async (_request, user) => {
  const admin = createAdminClient()

  // Check if user has already completed onboarding — fast exit
  const { data: profile } = await admin
    .from('profiles')
    .select('has_completed_first_clip')
    .eq('id', user.id)
    .single()

  if (profile?.has_completed_first_clip) {
    return NextResponse.json({
      data: { clips: [], sufficient: false, reason: 'already_completed' },
      error: null,
    })
  }

  // Fetch top clips in the 15-45s range with thumbnails
  const { data: rows, error } = await admin
    .from('trending_clips')
    .select('id, title, thumbnail_url, author_name, view_count, duration_seconds, niche, velocity_score')
    .gte('duration_seconds', 15)
    .lte('duration_seconds', 45)
    .not('thumbnail_url', 'is', null)
    .not('thumbnail_url', 'eq', '')
    .order('velocity_score', { ascending: false })
    .limit(CLIPS_TO_FETCH)

  if (error || !rows) {
    return NextResponse.json(
      { data: null, error: 'Failed to fetch clips', message: error?.message ?? 'DB error' },
      { status: 500 },
    )
  }

  // Kill switch: not enough clips available (scraper outage, DMCA purge, etc.)
  if (rows.length < MIN_CLIPS_REQUIRED) {
    return NextResponse.json({
      data: { clips: [], sufficient: false, reason: 'insufficient_clips' },
      error: null,
    })
  }

  // Diversify by niche — pick up to 2 clips per niche, max 5 total
  const selected: CuratedClip[] = []
  const nicheCounts: Record<string, number> = {}

  for (const row of rows) {
    if (selected.length >= 5) break
    const niche = row.niche ?? 'other'
    if ((nicheCounts[niche] ?? 0) >= 2) continue
    nicheCounts[niche] = (nicheCounts[niche] ?? 0) + 1
    selected.push(row as CuratedClip)
  }

  // If diversity filter left us with fewer than min — top up without niche restriction
  if (selected.length < MIN_CLIPS_REQUIRED) {
    for (const row of rows) {
      if (selected.length >= MIN_CLIPS_REQUIRED) break
      if (selected.find(s => s.id === row.id)) continue
      selected.push(row as CuratedClip)
    }
  }

  if (selected.length < MIN_CLIPS_REQUIRED) {
    return NextResponse.json({
      data: { clips: [], sufficient: false, reason: 'insufficient_after_filter' },
      error: null,
    })
  }

  return NextResponse.json({
    data: { clips: selected, sufficient: true },
    error: null,
  })
})
