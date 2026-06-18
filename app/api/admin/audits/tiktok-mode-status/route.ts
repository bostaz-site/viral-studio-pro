import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isTikTokReviewMode } from '@/lib/audit/tiktok-review-mode'

export const GET = withAdmin(async () => {
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: queuedFindings } = await (admin as any)
    .from('audit_findings')
    .select('id', { count: 'exact', head: true })
    .eq('tiktok_review_blocked', true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: queuedClusters } = await (admin as any)
    .from('root_cause_clusters')
    .select('id', { count: 'exact', head: true })
    .eq('tiktok_review_blocked', true)

  return jsonResponse({
    mode: isTikTokReviewMode() ? 'active' : 'inactive',
    queued_accepts: (queuedFindings ?? 0) + (queuedClusters ?? 0),
    queued_findings: queuedFindings ?? 0,
    queued_clusters: queuedClusters ?? 0,
  })
})
