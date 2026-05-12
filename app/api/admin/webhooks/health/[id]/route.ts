import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/webhooks/health/[id] — get single webhook detail with full payload
export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const id = segments[segments.length - 1]

  if (!id) return errorResponse('id required')

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('webhook_events')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return errorResponse('Webhook not found', 404)

  return jsonResponse(data)
})
