import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

/**
 * POST /api/account/delete
 *
 * GDPR-compliant account deletion.
 *
 * The user must confirm by typing their email exactly (case-insensitive).
 * Once confirmed, we delete the auth.users row, which cascades through
 * profiles → all user-scoped tables (clips, render_jobs, published_posts,
 * social_accounts → account_snapshots, distribution_captions, etc).
 *
 * Tables with ON DELETE SET NULL (ai_calls, analytics_events, affiliates)
 * keep aggregate rows but anonymize the user_id.
 *
 * After deletion the client should call supabase.auth.signOut() and redirect
 * to the landing page.
 */

const bodySchema = z.object({
  emailConfirmation: z.string().min(1, 'Email confirmation is required').max(320),
})

export const POST = withAuth(async (req, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid request body', 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Invalid input — emailConfirmation required', 400)
  }

  const provided = parsed.data.emailConfirmation.trim().toLowerCase()
  const actual = (user.email ?? '').trim().toLowerCase()

  if (!actual) {
    logger.warn({ userId: user.id }, 'account-delete: user has no email')
    return errorResponse('Account is missing an email address — please contact support', 400)
  }

  if (provided !== actual) {
    return errorResponse('Email confirmation did not match', 400)
  }

  // Use admin client to delete the auth row. This cascades through:
  //   auth.users → profiles → clips, render_jobs, published_posts, etc.
  // Tables with ON DELETE SET NULL keep their rows with user_id NULL (analytics).
  const admin = createAdminClient()

  // Snapshot how much data we're deleting (for audit log + analytics)
  const userId = user.id
  let deletedDataSnapshot: Record<string, number> = {}
  try {
    const counts = await Promise.all([
      admin.from('clips').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      admin.from('render_jobs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      admin.from('published_posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      admin.from('social_accounts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      admin.from('videos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])
    deletedDataSnapshot = {
      clips: counts[0].count ?? 0,
      renderJobs: counts[1].count ?? 0,
      publishedPosts: counts[2].count ?? 0,
      socialAccounts: counts[3].count ?? 0,
      videos: counts[4].count ?? 0,
    }
  } catch {
    // Snapshot is best-effort — don't block deletion if it fails
    deletedDataSnapshot = {}
  }

  // Delete the auth user — cascades through all FKs
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId)

  if (deleteErr) {
    logger.error(
      { userId, error: deleteErr.message },
      'account-delete: failed to delete auth user',
    )
    return errorResponse('Failed to delete account. Please contact support.', 500)
  }

  logger.info(
    { userId, deletedDataSnapshot, deletedAt: new Date().toISOString() },
    'account-delete: success',
  )

  return NextResponse.json({
    success: true,
    message: 'Your account and all associated data have been permanently deleted.',
    deleted: deletedDataSnapshot,
  })
})
