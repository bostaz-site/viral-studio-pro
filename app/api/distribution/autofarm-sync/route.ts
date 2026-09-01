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
    platform: z.enum(['tiktok', 'youtube', 'instagram', 'facebook']),
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

  // 2. Deduplicate: skip clips that already have an identical scheduled row
  //    (same clip + same scheduled_at) to prevent accumulation on repeated syncs
  const { data: existingRows } = await admin
    .from('scheduled_publications')
    .select('clip_id, scheduled_at')
    .eq('user_id', user.id)
    .eq('source' as never, 'autofarm')
    .eq('status', 'scheduled')
    .in('clip_id', filteredPosts.map(p => p.clip_id))

  const existingKeys = new Set(
    (existingRows ?? []).map(r => `${r.clip_id}::${r.scheduled_at}`)
  )
  const newPosts = filteredPosts.filter(
    p => !existingKeys.has(`${p.clip_id}::${p.scheduled_at}`)
  )

  // 3. INSERT only genuinely new rows
  let insertedIds: string[] = []
  if (newPosts.length > 0) {
    const rows = newPosts.map(p => ({
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
    const { data: inserted, error } = await (admin as any)
      .from('scheduled_publications')
      .insert(rows)
      .select('id')

    if (error) return errorResponse(error.message, 500)
    insertedIds = (inserted ?? []).map((r: { id: string }) => r.id)
  }

  // 4. Cancel old autofarm rows by ID — keep only the rows we just inserted
  //    plus any that matched an existing dedup key
  const keepClipIds = filteredPosts.map(p => p.clip_id)
  // Get IDs of existing rows we want to KEEP (deduped matches)
  const { data: keepExisting } = await admin
    .from('scheduled_publications')
    .select('id')
    .eq('user_id', user.id)
    .eq('source' as never, 'autofarm')
    .eq('status', 'scheduled')
    .in('clip_id', keepClipIds)

  const allKeepIds = new Set([
    ...insertedIds,
    ...(keepExisting ?? []).map((r: { id: string }) => r.id),
  ])

  // Cancel any autofarm scheduled rows NOT in the keep set
  if (allKeepIds.size > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('scheduled_publications')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('source', 'autofarm')
      .eq('status', 'scheduled')
      .not('id', 'in', `(${[...allKeepIds].join(',')})`)
  }

  return jsonResponse({ synced: newPosts.length, deduped: filteredPosts.length - newPosts.length })
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
