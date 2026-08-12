import { withAuth, jsonResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/clips/my-status
 *
 * Returns clip IDs the user has banked (rendered & still in bank)
 * and published (has a published_posts row).
 * Two lightweight selects — no N+1.
 */
export const GET = withAuth(async (_req, user) => {
  const admin = createAdminClient()

  const [bankedResult, publishedResult] = await Promise.allSettled([
    admin
      .from('render_jobs')
      .select('clip_id')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .is('removed_from_bank_at', null)
      .not('clip_id', 'is', null),

    admin
      .from('published_posts')
      .select('clip_id')
      .eq('user_id', user.id)
      .not('clip_id', 'is', null),
  ])

  const banked = bankedResult.status === 'fulfilled'
    ? [...new Set((bankedResult.value.data ?? []).map((r: { clip_id: string }) => r.clip_id).filter(Boolean))]
    : []

  const published = publishedResult.status === 'fulfilled'
    ? [...new Set((publishedResult.value.data ?? []).map((r: { clip_id: string }) => r.clip_id).filter(Boolean))]
    : []

  return jsonResponse({ banked, published })
})
