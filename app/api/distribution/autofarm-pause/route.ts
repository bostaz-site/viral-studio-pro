import { NextRequest, NextResponse } from 'next/server'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

/**
 * POST /api/distribution/autofarm-pause
 *
 * Pauses the autofarm for a specified number of hours by canceling all
 * pending scheduled_publications and setting a pause_until timestamp
 * in distribution_settings.
 */

const schema = z.object({
  hours: z.number().min(1).max(168).default(72), // 1h to 7 days
})

export const POST = withAuth(async (req: NextRequest, user) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 400)
  }

  const { hours } = parsed.data
  const admin = createAdminClient()
  const pauseUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

  // Cancel all pending scheduled publications for this user
  const { error: cancelErr } = await admin
    .from('scheduled_publications')
    .update({
      status: 'canceled',
      error_message: `autofarm paused ${hours}h (flagged account protocol)`,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('user_id', user.id)
    .eq('status', 'scheduled')

  if (cancelErr) {
    return errorResponse(`Failed to cancel scheduled posts: ${cancelErr.message}`, 500)
  }

  // Set pause_until in distribution_settings (upsert)
  const { error: settingsErr } = await admin
    .from('distribution_settings')
    .upsert({
      user_id: user.id,
      autofarm_paused_until: pauseUntil,
      updated_at: new Date().toISOString(),
    } as never, { onConflict: 'user_id' })

  if (settingsErr) {
    return errorResponse(`Failed to update settings: ${settingsErr.message}`, 500)
  }

  return jsonResponse({
    paused: true,
    pause_until: pauseUntil,
    canceled_count: 'all pending',
  })
})
