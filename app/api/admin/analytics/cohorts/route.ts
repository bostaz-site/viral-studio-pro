import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCohorts } from '@/lib/admin/analytics/aggregators'

export const GET = withAdmin(async () => {
  const admin = createAdminClient()
  const cohorts = await getCohorts(admin)
  return jsonResponse(cohorts)
})
