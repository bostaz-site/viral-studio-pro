import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { getScraperDb } from '@/lib/admin/scraper/db'

function extractId(req: NextRequest): string {
  return req.nextUrl.pathname.split('/').at(-1) ?? ''
}

// GET — job detail with scored leads
export const GET = withAdmin(async (req) => {
  const id = extractId(req)
  const db = getScraperDb()

  const [jobRes, snapshotsRes] = await Promise.all([
    db.from('ai_scoring_jobs').select('*').eq('id', id).single(),
    db.from('affiliate_signal_snapshots')
      .select('id, discovery_result_id, keyword_score, confidence, strengths, concerns, ai_recommendation, ai_reasoning, cost_cents, scored_at')
      .eq('ai_job_id', id)
      .order('confidence', { ascending: false }),
  ])

  if (jobRes.error) return errorResponse('Job not found', 404)

  return jsonResponse({
    job: jobRes.data,
    snapshots: snapshotsRes.data ?? [],
  })
})
