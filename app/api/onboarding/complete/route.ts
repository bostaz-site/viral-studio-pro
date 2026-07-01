import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/onboarding/complete
 *
 * Marks the user's first clip as done (has_completed_first_clip = true).
 * Called when the render succeeds and the user sees the result modal.
 * Idempotent — safe to call multiple times.
 */
export const POST = withAuth(async (req, user) => {
  const admin = createAdminClient()

  const { error } = await admin
    .from('profiles')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ has_completed_first_clip: true } as any)
    .eq('id', user.id)

  if (error) return errorResponse('Failed to update profile', 500)

  return jsonResponse({ success: true })
})
