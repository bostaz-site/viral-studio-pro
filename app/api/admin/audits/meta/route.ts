import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export const GET = withAdmin(async (req: NextRequest) => {
  const admin = createAdminClient() as AnyClient
  const url = req.nextUrl
  const agent = url.searchParams.get('agent')

  let query = admin
    .from('meta_agent_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (agent) query = query.eq('agent_evaluated', agent)

  const { data, error } = await query

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
