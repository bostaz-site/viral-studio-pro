/**
 * PATCH /api/distribution/bank/[clipId] — remove or restore a clip from the bank.
 *
 * Body: { action: 'remove' | 'restore' }
 * - remove: sets removed_from_bank_at = now() + cancels any scheduled_publications for this clip
 * - restore: sets removed_from_bank_at = NULL
 */

import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  action: z.enum(['remove', 'restore']),
})

export const PATCH = withAuth(async (req, user) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const clipId = segments[segments.length - 1]
  if (!clipId) return errorResponse('clipId is required')

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const admin = createAdminClient()
  const { action } = parsed.data

  if (action === 'remove') {
    // Mark clip as removed from bank
    const { error } = await admin
      .from('render_jobs')
      .update({ removed_from_bank_at: new Date().toISOString() } as never)
      .eq('clip_id', clipId)
      .eq('user_id', user.id)
      .eq('status', 'done')

    if (error) return errorResponse(error.message, 500)

    // Cancel any scheduled posts for this clip
    await admin
      .from('scheduled_publications')
      .update({ status: 'canceled', updated_at: new Date().toISOString() } as never)
      .eq('user_id', user.id)
      .eq('clip_id', clipId)
      .eq('status', 'scheduled')

    return jsonResponse({ removed: true, clip_id: clipId })
  }

  // Restore
  const { error } = await admin
    .from('render_jobs')
    .update({ removed_from_bank_at: null } as never)
    .eq('clip_id', clipId)
    .eq('user_id', user.id)
    .eq('status', 'done')

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ restored: true, clip_id: clipId })
})
