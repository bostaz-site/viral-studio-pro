import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAuth(
  async (_req, user) => {
    const admin = createAdminClient()

    const { data: accounts, error } = await admin
      .from('social_accounts')
      .select('id, platform, platform_user_id, username, connected_at, followers, total_views, video_count, avg_views_per_video, median_views_per_video, engagement_rate, creator_score, creator_rank, last_synced_at, sync_count_today, last_sync_date')
      .eq('user_id', user.id)
      .order('connected_at', { ascending: false })

    if (error) {
      return errorResponse(`Failed to fetch social accounts: ${error.message}`, 500)
    }

    return jsonResponse(accounts ?? [])
  }
)
