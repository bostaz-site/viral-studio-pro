import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (
  req: NextRequest,
  _user,
) => {
  const id = req.nextUrl.pathname.split('/').pop()
  if (!id) return errorResponse('Missing id', 400)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: dive, error } = await admin
    .from('lab_deep_dives')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return errorResponse(error.message, 500)
  if (!dive) return errorResponse('Not found', 404)

  // Fetch council responses
  const { data: council } = await admin
    .from('lab_council_responses')
    .select('*')
    .eq('deep_dive_id', id)
    .order('llm_provider')

  return jsonResponse({ dive, council: council ?? [] })
})
