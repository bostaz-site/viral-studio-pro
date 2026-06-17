import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async () => {
  const admin = createAdminClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data, error } = await admin
    .from('audit_metrics_snapshots')
    .select('*')
    .gte('snapshot_date', thirtyDaysAgo)
    .order('snapshot_date', { ascending: true })

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
