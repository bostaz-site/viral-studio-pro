import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  twitch_login: z.string().max(100).nullable().optional(),
  kick_login: z.string().max(100).nullable().optional(),
  niche: z.string().max(50).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  active: z.boolean().optional(),
  fetch_interval_minutes: z.number().int().min(1).max(60).optional(),
})

// PATCH: Update a streamer
export const PATCH = withAdmin(async (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const id = segments[segments.length - 1]
  if (!id) return errorResponse('id is required')

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('streamers')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

// DELETE: Remove a streamer
export const DELETE = withAdmin(async (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const id = segments[segments.length - 1]
  if (!id) return errorResponse('id is required')

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('streamers')
    .delete()
    .eq('id', id)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ deleted: true })
})
