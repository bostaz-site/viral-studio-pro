import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { pushOffersToInstantly } from '@/lib/admin/offer-generator/instantly-pusher'

export const POST = withAdmin(async (req: NextRequest) => {
  const { offerIds } = await req.json()
  if (!offerIds?.length) return errorResponse('offerIds required')
  if (offerIds.length > 200) return errorResponse('Max 200 offers per push')
  const result = await pushOffersToInstantly(offerIds)
  return jsonResponse(result)
})
