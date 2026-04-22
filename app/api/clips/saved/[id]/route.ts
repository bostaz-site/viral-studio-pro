import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE: Unsave a clip
export const DELETE = withAuth(async (req, user) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const clipId = segments[segments.length - 1]
  if (!clipId) return errorResponse('clip_id is required')

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('saved_clips')
    .delete()
    .eq('clip_id', clipId)
    .eq('user_id', user.id)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ deleted: true })
})
