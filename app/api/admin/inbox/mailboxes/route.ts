import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/inbox/mailboxes — list active mailboxes for reply composer
export const GET = withAdmin(async () => {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('mailboxes')
    .select('email, status, display_name')
    .in('status', ['active', 'warming'])
    .order('email')

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data ?? [])
})
