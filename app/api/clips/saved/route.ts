import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const saveSchema = z.object({
  clip_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
})

// GET: List saved clips
export const GET = withAuth(async (_req, user) => {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('saved_clips')
    .select('id, clip_id, notes, created_at, trending_clips(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

// POST: Save a clip
export const POST = withAuth(async (req, user) => {
  const body = await req.json()
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('saved_clips')
    .upsert(
      {
        user_id: user.id,
        clip_id: parsed.data.clip_id,
        notes: parsed.data.notes ?? null,
      },
      { onConflict: 'user_id,clip_id' }
    )
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
