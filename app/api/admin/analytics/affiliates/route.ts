import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAffiliateLeaderboard } from '@/lib/admin/analytics/aggregators'

export const GET = withAdmin(async () => {
  const admin = createAdminClient()
  const leaderboard = await getAffiliateLeaderboard(admin)
  return jsonResponse(leaderboard)
})
