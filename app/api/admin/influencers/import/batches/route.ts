import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — list all import batches
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const batchId = url.searchParams.get('id')
  const supabase = createAdminClient()

  // Single batch by id
  if (batchId) {
    const { data, error } = await supabase
      .from('import_batches')
      .select('*')
      .eq('id', batchId)
      .single()

    if (error) return errorResponse(error.message, 404)
    return jsonResponse(data)
  }

  // List all batches
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
