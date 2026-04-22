import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getPublishRecommendation,
  type PublicationPerformance,
  type AccountIntelligence,
} from '@/lib/distribution/smart-publisher'

const createSchema = z.object({
  clip_id: z.string().min(1),
  platform: z.enum(['tiktok', 'youtube', 'instagram']),
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).max(30).optional(),
  scheduled_at: z.string().datetime(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['scheduled', 'cancelled']).optional(),
  scheduled_at: z.string().datetime().optional(),
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).max(30).optional(),
})

export const GET = withAuth(async (req, user) => {
  const supabase = createAdminClient()
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const platform = url.searchParams.get('platform')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  let query = supabase
    .from('scheduled_publications')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (platform) query = query.eq('platform', platform)

  const { data, error } = await query

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

export const POST = withAuth(async (req, user) => {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()
  const { clip_id, platform, caption, hashtags, scheduled_at } = parsed.data

  // Anti-shadowban: check minimum spacing (3h) on same platform
  const scheduledTime = new Date(scheduled_at)
  const threeHoursBefore = new Date(scheduledTime.getTime() - 3 * 60 * 60 * 1000)
  const threeHoursAfter = new Date(scheduledTime.getTime() + 3 * 60 * 60 * 1000)

  const { data: conflicts } = await supabase
    .from('scheduled_publications')
    .select('id, scheduled_at')
    .eq('user_id', user.id)
    .eq('platform', platform)
    .in('status', ['scheduled', 'publishing'])
    .gte('scheduled_at', threeHoursBefore.toISOString())
    .lte('scheduled_at', threeHoursAfter.toISOString())

  if (conflicts && conflicts.length > 0) {
    return errorResponse(
      `Anti-shadowban: minimum 3h spacing required between posts on ${platform}. Conflict with post at ${conflicts[0].scheduled_at}`,
      409
    )
  }

  // Check duplicate: same clip on same platform
  const { data: dupes } = await supabase
    .from('scheduled_publications')
    .select('id')
    .eq('user_id', user.id)
    .eq('clip_id', clip_id)
    .eq('platform', platform)
    .in('status', ['scheduled', 'publishing', 'published'])
    .limit(1)

  if (dupes && dupes.length > 0) {
    return errorResponse(
      `This clip is already scheduled or published on ${platform}`,
      409
    )
  }

  // Smart publishing: check recommendation (warning, not blocking)
  let timingWarning: string | null = null
  try {
    const { data: intelligence } = await supabase
      .from('account_intelligence')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .single()

    const since = new Date()
    since.setDate(since.getDate() - 30)
    const { data: performances } = await supabase
      .from('publication_performance')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .gte('posted_at', since.toISOString())
      .order('posted_at', { ascending: false })
      .limit(100)

    const recommendation = getPublishRecommendation(
      intelligence as AccountIntelligence | null,
      (performances ?? []) as PublicationPerformance[],
      platform,
      scheduledTime
    )

    if (!recommendation.should_post_now) {
      timingWarning = recommendation.reason
    }
  } catch {
    // Non-blocking — if smart check fails, proceed normally
  }

  // Add random variation (+/- 30 min)
  const variationMs = (Math.random() - 0.5) * 2 * 30 * 60 * 1000
  const adjustedTime = new Date(scheduledTime.getTime() + variationMs)

  const { data, error } = await supabase
    .from('scheduled_publications')
    .insert({
      user_id: user.id,
      clip_id,
      platform,
      caption: caption ?? null,
      hashtags: hashtags ?? [],
      scheduled_at: adjustedTime.toISOString(),
      status: 'scheduled',
    })
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ ...data, timingWarning })
})

export const PATCH = withAuth(async (req, user) => {
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()
  const { id, ...updates } = parsed.data

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.status) updatePayload.status = updates.status
  if (updates.scheduled_at) updatePayload.scheduled_at = updates.scheduled_at
  if (updates.caption !== undefined) updatePayload.caption = updates.caption
  if (updates.hashtags !== undefined) updatePayload.hashtags = updates.hashtags

  const { data, error } = await supabase
    .from('scheduled_publications')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

export const DELETE = withAuth(async (req, user) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return errorResponse('id is required')

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('scheduled_publications')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ deleted: true })
})
