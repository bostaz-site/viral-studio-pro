import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isTikTokReviewMode } from '@/lib/audit/tiktok-review-mode'

export const POST = withAdmin(async (req: NextRequest) => {
  if (isTikTokReviewMode()) {
    return errorResponse('TIKTOK_REVIEW_MODE is still active. Set it to false first.', 400)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Fetch all blocked findings that were accepted
  const { data: blockedFindings } = await admin
    .from('audit_findings')
    .select('id, title, severity')
    .eq('tiktok_review_blocked', true)
    .not('accepted_at', 'is', null)

  // Fetch all blocked clusters that were accepted
  const { data: blockedClusters } = await admin
    .from('root_cause_clusters')
    .select('id, cluster_name')
    .eq('tiktok_review_blocked', true)
    .not('accepted_at', 'is', null)

  const findingsToResume = blockedFindings ?? []
  const clustersToResume = blockedClusters ?? []

  // Trigger GitHub Actions for each queued accept
  const githubToken = process.env.GITHUB_TOKEN
  let dispatched = 0

  if (githubToken) {
    for (const cluster of clustersToResume) {
      try {
        const res = await fetch('https://api.github.com/repos/bostaz-site/viral-studio-pro/dispatches', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            event_type: 'auto-fix-launch',
            client_payload: {
              prompt_id: `resume-cluster-${cluster.id}`,
              accepted_by: 'tiktok-resume',
            },
          }),
        })
        if (res.ok) dispatched++
      } catch {
        // continue with other dispatches
      }
    }
  }

  // Clear blocked flags
  if (findingsToResume.length > 0) {
    await admin
      .from('audit_findings')
      .update({ tiktok_review_blocked: false })
      .eq('tiktok_review_blocked', true)
  }

  if (clustersToResume.length > 0) {
    await admin
      .from('root_cause_clusters')
      .update({ tiktok_review_blocked: false })
      .eq('tiktok_review_blocked', true)
  }

  return jsonResponse({
    resumed_findings: findingsToResume.length,
    resumed_clusters: clustersToResume.length,
    dispatched,
  })
})
