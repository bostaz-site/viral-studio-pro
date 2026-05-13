import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse } from '@/lib/api/withAuth'
import { getRemainingQuota } from '@/lib/admin/scraper/quota-tracker'

// GET — current quota usage
export const GET = withAdmin(async () => {
  const youtube = await getRemainingQuota('youtube_api')
  return jsonResponse({ youtube })
})
