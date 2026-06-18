import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (req: NextRequest) => {
  const admin = createAdminClient()
  const status = req.nextUrl.searchParams.get('status') || 'identified'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('root_cause_clusters')
    .select('*')
    .order('findings_count', { ascending: false })
    .limit(50)

  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
