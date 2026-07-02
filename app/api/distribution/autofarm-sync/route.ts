/**
 * Autofarm Queue → DB sync.
 * Called when aiAutoDistribute toggles ON or when queue regenerates while ON.
 *
 * POST: sync queue posts to scheduled_publications (upsert, cancel stale)
 * DELETE: pause all future 'scheduled' autofarm rows (toggle OFF)
 */

import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const syncSchema = z.object({
  posts: z.array(z.object({
    clip_id: z.string().min(1),
    platform: z.enum(['tiktok']), // launch scope: TikTok only
    scheduled_at: z.string().datetime(),
    caption: z.string().max(2200).default(''),
    hashtags: z.array(z.string()).max(30).default([]),
  })).max(6),
  tiktok_defaults: z.object({
    privacy_level: z.enum([
      'PUBLIC_TO_EVERYONE',
      'MUTUAL_FOLLOW_FRIENDS',
      'FOLLOWER_OF_CREATOR',
      'SELF_ONLY',
    ]),
    disable_comment: z.boolean(),
    disable_duet: z.boolean(),
    disable_stitch: z.boolean(),
    brand_content_toggle: z.boolean().optional(),
    brand_organic_toggle: z.boolean().optional(),
  }),
})

export const POST = withAuth(async (req, user) => {
  const body = await req.json()
  const parsed = syncSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { posts, tiktok_defaults } = parsed.data
  const admin = createAdminClient()

  // 1. Cancel all existing 'scheduled' autofarm rows for this user (clean slate)
  await admin
    .from('scheduled_publications')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() } as never)
    .eq('user_id', user.id)
    .eq('source' as never, 'autofarm')
    .eq('status', 'scheduled')

  // 2. Insert new queue posts
  if (posts.length === 0) {
    return jsonResponse({ synced: 0 })
  }

  const rows = posts.map(p => ({
    user_id: user.id,
    clip_id: p.clip_id,
    platform: p.platform,
    caption: p.caption,
    hashtags: p.hashtags,
    scheduled_at: p.scheduled_at,
    status: 'scheduled',
    source: 'autofarm',
    tiktok_options: tiktok_defaults,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('scheduled_publications')
    .insert(rows)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ synced: rows.length })
})

// DELETE: pause all future autofarm-scheduled posts (toggle OFF)
export const DELETE = withAuth(async (_req, user) => {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('scheduled_publications')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() } as never)
    .eq('user_id', user.id)
    .eq('source' as never, 'autofarm')
    .eq('status', 'scheduled')
    .select('id')

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ paused: data?.length ?? 0 })
})
