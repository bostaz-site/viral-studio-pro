import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export const GET = withAdmin(async (req) => {
  const admin = createAdminClient() as AnyClient
  const { searchParams } = new URL(req.url)
  const outcome = searchParams.get('outcome')

  let query = admin
    .from('user_session_replays')
    .select('*')
    .order('replayed_at', { ascending: false })
    .limit(100)

  if (outcome && outcome !== 'all') {
    query = query.eq('session_outcome', outcome)
  }

  const { data, error } = await query

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
