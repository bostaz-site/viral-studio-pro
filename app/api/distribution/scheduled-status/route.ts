import { withAuth, jsonResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/distribution/scheduled-status
 *
 * Returns the current state of the user's scheduled_publications.
 * The distribution hub polls this every 60s to detect gate cancellations
 * and update the queue UI in real time.
 *
 * Returns: { publications: [{id, clip_id, status, error_message, scheduled_at}] }
 */
export const GET = withAuth(async (_req, user) => {
  const admin = createAdminClient()

  const { data } = await admin
    .from('scheduled_publications')
    .select('id, clip_id, platform, status, error_message, scheduled_at' as '*')
    .eq('user_id', user.id)
    .eq('source' as never, 'autofarm')
    .in('status', ['scheduled', 'publishing', 'published', 'canceled', 'failed'])
    .order('scheduled_at', { ascending: true })
    .limit(20)

  return jsonResponse({
    publications: (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      clip_id: r.clip_id,
      platform: r.platform,
      status: r.status,
      error_message: r.error_message ?? null,
      scheduled_at: r.scheduled_at,
    })),
  })
})
