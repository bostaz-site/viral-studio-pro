import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAcquisitionFunnel } from '@/lib/admin/analytics/aggregators'

export const GET = withAdmin(async () => {
  const admin = createAdminClient()
  const funnel = await buildAcquisitionFunnel(admin)
  return jsonResponse(funnel)
})
