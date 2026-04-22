import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z.object({
  max_posts_per_day: z.number().int().min(1).max(20).optional(),
  min_hours_between_posts: z.number().min(0.5).max(24).optional(),
  default_hashtags: z.array(z.string()).max(30).optional(),
  caption_template: z.string().max(2200).nullable().optional(),
  niche: z.string().max(50).nullable().optional(),
  optimal_hours: z.record(z.string(), z.array(z.number())).optional(),
  ai_optimized: z.boolean().optional(),
})

export const GET = withAuth(async (_req, user) => {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('distribution_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code === 'PGRST116') {
    // No settings yet — return defaults
    return jsonResponse({
      user_id: user.id,
      max_posts_per_day: 3,
      min_hours_between_posts: 3,
      default_hashtags: [],
      caption_template: null,
      niche: null,
      optimal_hours: {},
      ai_optimized: false,
    })
  }

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

export const PUT = withAuth(async (req, user) => {
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('distribution_settings')
    .upsert(
      {
        user_id: user.id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
