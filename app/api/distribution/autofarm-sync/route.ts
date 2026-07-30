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

  // 0. If no posts to sync, just cancel existing and return
  if (posts.length === 0) {
    await admin
      .from('scheduled_publications')
      .update({ status: 'canceled', updated_at: new Date().toISOString() } as never)
      .eq('user_id', user.id)
      .eq('source' as never, 'autofarm')
      .eq('status', 'scheduled')
    return jsonResponse({ synced: 0 })
  }

  // 1. Exclude clips already published (prevent republish loop)
  const clipIds = posts.map(p => p.clip_id)
  const { data: alreadyPublished } = await admin
    .from('published_posts')
    .select('clip_id')
    .eq('user_id', user.id)
    .in('clip_id', clipIds)

  const publishedClipIds = new Set((alreadyPublished ?? []).map(r => r.clip_id))
  const filteredPosts = posts.filter(p => !publishedClipIds.has(p.clip_id))

  if (filteredPosts.length === 0) {
    return jsonResponse({ synced: 0, skipped: posts.length })
  }

  // 2. INSERT new rows FIRST (safe: if this fails, existing queue survives)
  const rows = filteredPosts.map(p => ({
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

  // 3. THEN cancel old autofarm rows (only after insert succeeds)
  //    Exclude the just-inserted IDs by canceling only rows created before now
  await admin
    .from('scheduled_publications')
    .update({ status: 'canceled', updated_at: new Date().toISOString() } as never)
    .eq('user_id', user.id)
    .eq('source' as never, 'autofarm')
    .eq('status', 'scheduled')
    .not('clip_id', 'in', `(${filteredPosts.map(p => p.clip_id).join(',')})`)

  return jsonResponse({ synced: rows.length })
})

// DELETE: pause all future autofarm-scheduled posts (toggle OFF)
export const DELETE = withAuth(async (_req, user) => {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('scheduled_publications')
    .update({ status: 'canceled', updated_at: new Date().toISOString() } as never)
    .eq('user_id', user.id)
    .eq('source' as never, 'autofarm')
    .eq('status', 'scheduled')
    .select('id')

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ paused: data?.length ?? 0 })
})
