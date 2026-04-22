import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const createSchema = z.object({
  display_name: z.string().min(1).max(100),
  twitch_login: z.string().max(100).optional(),
  kick_login: z.string().max(100).optional(),
  niche: z.string().max(50).default('irl'),
  priority: z.number().int().min(0).max(10).default(5),
})

// GET: List all streamers
export const GET = withAdmin(async () => {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('streamers')
    .select('*')
    .order('priority', { ascending: false })

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

// POST: Create a new streamer
export const POST = withAdmin(async (req) => {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('streamers')
    .insert({
      display_name: parsed.data.display_name,
      twitch_login: parsed.data.twitch_login ?? null,
      kick_login: parsed.data.kick_login ?? null,
      priority: parsed.data.priority,
      active: true,
    })
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
