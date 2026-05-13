import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { getScraperDb } from '@/lib/admin/scraper/db'

// GET — list discovery runs
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const source = url.searchParams.get('source')

  const supabase = getScraperDb()
  let query = supabase
    .from('lead_discovery_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  if (source) query = query.eq('source', source)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
