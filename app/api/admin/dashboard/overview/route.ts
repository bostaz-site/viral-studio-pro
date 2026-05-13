import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { aggregateDashboard } from '@/lib/admin/dashboard/aggregator'

// GET — single aggregated dashboard payload
export const GET = withAdmin(async () => {
  try {
    const data = await aggregateDashboard()
    return jsonResponse(data)
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to load dashboard', 500)
  }
})
