import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/withAuth'

/**
 * POST /api/paywall/save — one-time free save (lifetime, first wall only)
 * Grants +1 bonus_video and sets paywall_save_used=true
 */
export const POST = withAuth(async (_req, user) => {
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('paywall_save_used, bonus_videos')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ data: null, error: 'Profile not found', message: 'Profile not found' }, { status: 404 })
  }

  if (profile.paywall_save_used) {
    return NextResponse.json({ data: null, error: 'Already used', message: 'One-time save already used' }, { status: 409 })
  }

  await admin
    .from('profiles')
    .update({
      paywall_save_used: true,
      bonus_videos: (profile.bonus_videos ?? 0) + 1,
    } as never)
    .eq('id', user.id)

  return NextResponse.json({ data: { granted: 1 }, error: null, message: 'One free clip granted' })
})
