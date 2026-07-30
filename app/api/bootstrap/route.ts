import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { resolveEffectivePlan } from '@/lib/plans'

/**
 * GET /api/bootstrap
 *
 * Returns all data needed for the initial dashboard load in a single call:
 * - saved_clip_ids: clip IDs the user has bookmarked
 * - recent_remixes: last 5 render jobs with basic metadata
 * - profile: plan, monthly usage, bonus videos
 *
 * Replaces 3 separate fetches (saved, remixes, profile) on page load.
 * Individual endpoints remain available for manual refresh.
 */
export const GET = withAuth(async (req, user) => {
  const rl = await rateLimit(`bootstrap:${user.id}`, RATE_LIMITS.browse.limit, RATE_LIMITS.browse.windowMs)
  if (!rl.allowed) return errorResponse('Rate limited', 429)

  const admin = createAdminClient()

  const [savedResult, remixResult, profileResult, usedClipsResult] = await Promise.allSettled([
    admin
      .from('saved_clips')
      .select('clip_id')
      .eq('user_id', user.id),

    admin
      .from('render_jobs')
      .select('id, clip_id, source, status, storage_path, error_message, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),

    (admin
      .from('profiles')
      .select('plan, monthly_videos_used, bonus_videos, is_comp')
      .eq('id', user.id)
      .single() as unknown as Promise<{ data: { plan: string | null; monthly_videos_used: number; bonus_videos: number; is_comp: boolean | null } | null }>),

    // All clip IDs this user has ever rendered (for Top Pick exclusion)
    admin
      .from('render_jobs')
      .select('clip_id')
      .eq('user_id', user.id)
      .not('clip_id', 'is', null),
  ])

  const savedClipIds = savedResult.status === 'fulfilled'
    ? (savedResult.value.data ?? []).map((s: { clip_id: string | null }) => s.clip_id).filter(Boolean)
    : []

  const recentRemixes = remixResult.status === 'fulfilled'
    ? (remixResult.value.data ?? [])
    : []

  const rawProfile = (profileResult.status === 'fulfilled'
    ? profileResult.value.data
    : null) as { plan: string | null; monthly_videos_used: number; bonus_videos: number; is_comp: boolean | null } | null
  const profile = rawProfile
    ? { ...rawProfile, plan: resolveEffectivePlan(rawProfile) }
    : null

  const usedClipIds = usedClipsResult.status === 'fulfilled'
    ? [...new Set((usedClipsResult.value.data ?? []).map((r: { clip_id: string }) => r.clip_id).filter(Boolean))]
    : []

  return jsonResponse({
    saved_clip_ids: savedClipIds as string[],
    used_clip_ids: usedClipIds as string[],
    recent_remixes: recentRemixes as Array<{
      id: string
      clip_id: string
      source: string
      status: string
      storage_path: string | null
      error_message: string | null
      created_at: string
      updated_at: string
    }>,
    profile: profile as { plan: string; monthly_videos_used: number; bonus_videos: number } | null,
  })
})
