import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/onboarding/complete
 *
 * Marks the user's first-clip onboarding as complete.
 * Called when the user sees the rendered result (the aha moment).
 * Idempotent — safe to call multiple times.
 */
export const POST = withAuth(async (_request, user) => {
  const admin = createAdminClient()

  const { error } = await admin
    .from('profiles')
    .update({ has_completed_first_clip: true })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json(
      { data: null, error: 'Failed to update profile', message: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: { completed: true }, error: null })
})
