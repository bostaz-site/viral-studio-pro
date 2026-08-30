import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/withAuth'

/**
 * POST /api/paywall/save — one-time free save (lifetime, first wall only)
 * Grants +1 bonus_video and sets paywall_save_used=true
 */
export const POST = withAuth(async (_req, user) => {
  const admin = createAdminClient()

  // Atomic: only succeeds if paywall_save_used is not already true
  const { data: granted, error: grantErr } = await admin.rpc('grant_paywall_save' as never, { p_user_id: user.id } as never)

  if (grantErr) {
    return NextResponse.json({ data: null, error: 'Grant failed', message: 'Could not grant free clip' }, { status: 500 })
  }

  if (!granted) {
    return NextResponse.json({ data: null, error: 'Already used', message: 'One-time save already used' }, { status: 409 })
  }

  return NextResponse.json({ data: { granted: 1 }, error: null, message: 'One free clip granted' })
})
