import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (req: NextRequest) => {
  const admin = createAdminClient()
  const status = req.nextUrl.searchParams.get('status') || 'new'
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('production_errors')
    .select('*')
    .order('occurrence_count', { ascending: false })
    .limit(limit)

  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)

  // Also fetch summary stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: totalNew } = await (admin as any)
    .from('production_errors')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: totalAll } = await (admin as any)
    .from('production_errors')
    .select('id', { count: 'exact', head: true })

  return jsonResponse({ errors: data, stats: { totalNew, totalAll } })
})

export const PATCH = withAdmin(async (req: NextRequest) => {
  const admin = createAdminClient()
  const body = await req.json()
  const { id, status } = body

  if (!id || !status) return errorResponse('id and status required', 400)

  const validStatuses = ['new', 'investigated', 'fixed', 'ignored', 'expected']
  if (!validStatuses.includes(status)) return errorResponse('Invalid status', 400)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('production_errors')
    .update({ status })
    .eq('id', id)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ updated: true })
})
