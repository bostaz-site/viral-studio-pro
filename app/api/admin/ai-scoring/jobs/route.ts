import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { getScraperDb } from '@/lib/admin/scraper/db'
import { processAiScoringBatch } from '@/lib/admin/ai-scoring/batch-processor'

// GET — list AI scoring jobs
export const GET = withAdmin(async () => {
  const db = getScraperDb()

  const { data, error } = await db
    .from('ai_scoring_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

// POST — manually trigger a batch scoring run
export const POST = withAdmin(async () => {
  try {
    const result = await processAiScoringBatch()
    return jsonResponse(result)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 500)
  }
})
