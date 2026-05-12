import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/watchdog/dismiss — dismiss one or many alerts
export const POST = withAdmin(async (req: NextRequest, user) => {
  const { alertIds } = await req.json() as { alertIds: string[] }

  if (!alertIds?.length) return errorResponse('alertIds required')

  const admin = createAdminClient()

  const { error } = await admin
    .from('agent_alerts')
    .update({
      dismissed_at: new Date().toISOString(),
      dismissed_by: user.id,
    })
    .in('id', alertIds)

  if (error) return errorResponse('Failed to dismiss alerts', 500)

  return jsonResponse({ ok: true, dismissed: alertIds.length })
})
