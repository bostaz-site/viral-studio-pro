import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCampaignPerformance } from '@/lib/admin/analytics/aggregators'

export const GET = withAdmin(async () => {
  const admin = createAdminClient()
  const campaigns = await getCampaignPerformance(admin)
  return jsonResponse(campaigns)
})
