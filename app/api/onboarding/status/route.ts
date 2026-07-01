import { withAuth, jsonResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/onboarding/status
 *
 * Returns whether the current user has completed their first viral clip.
 */
export const GET = withAuth(async (req, user) => {
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('profiles')
    .select('has_completed_first_clip')
    .eq('id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jsonResponse({ hasCompleted: (data as any)?.has_completed_first_clip ?? false })
})
