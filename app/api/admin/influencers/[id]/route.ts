import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClientUntyped } from '@/lib/supabase/admin-untyped'

const UPDATABLE_FIELDS = new Set([
  'status', 'tags', 'notes', 'next_follow_up_at', 'reply_reviewed',
  'niche', 'country', 'language', 'first_name', 'last_name', 'display_name',
])

// PATCH — update single influencer fields
export const PATCH = withAdmin(async (req, _user) => {
  const id = req.nextUrl.pathname.split('/').at(-1)
  if (!id) return errorResponse('Missing id', 400)

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(body)) {
    if (UPDATABLE_FIELDS.has(key)) {
      updates[key] = value
    }
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse('No valid fields to update', 400)
  }

  const admin = createAdminClientUntyped()
  const { error } = await admin
    .from('influencers')
    .update(updates)
    .eq('id', id)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ updated: true })
})
