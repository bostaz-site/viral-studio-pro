import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePerformanceScore } from '@/lib/distribution/smart-publisher'

const createSchema = z.object({
  clip_id: z.string().min(1),
  platform: z.enum(['tiktok', 'youtube', 'instagram']),
  scheduled_publication_id: z.string().uuid().optional(),
  posted_at: z.string().datetime(),
  views_1h: z.number().int().min(0).optional(),
  views_2h: z.number().int().min(0).optional(),
  views_6h: z.number().int().min(0).optional(),
  views_24h: z.number().int().min(0).optional(),
  views_48h: z.number().int().min(0).optional(),
  views_total: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
  watch_time_avg: z.number().min(0).optional(),
  retention_rate: z.number().min(0).max(1).optional(),
  niche: z.string().max(50).optional(),
  has_captions: z.boolean().optional(),
  has_split_screen: z.boolean().optional(),
  clip_duration_seconds: z.number().min(0).optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  views_1h: z.number().int().min(0).optional(),
  views_2h: z.number().int().min(0).optional(),
  views_6h: z.number().int().min(0).optional(),
  views_24h: z.number().int().min(0).optional(),
  views_48h: z.number().int().min(0).optional(),
  views_total: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
  watch_time_avg: z.number().min(0).optional(),
  retention_rate: z.number().min(0).max(1).optional(),
})

// GET: Fetch performances with filters
export const GET = withAuth(async (req, user) => {
  const supabase = createAdminClient()
  const url = new URL(req.url)
  const platform = url.searchParams.get('platform')
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '30'), 90)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)

  const since = new Date()
  since.setDate(since.getDate() - days)

  let query = supabase
    .from('publication_performance')
    .select('*')
    .eq('user_id', user.id)
    .gte('posted_at', since.toISOString())
    .order('posted_at', { ascending: false })
    .limit(limit)

  if (platform) query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

// POST: Create or update performance record
export const POST = withAuth(async (req, user) => {
  const body = await req.json()

  // If updating existing record
  if (body.id) {
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    const supabase = createAdminClient()
    const { id, ...metrics } = parsed.data

    // Fetch the existing record to recalculate score
    const { data: existing, error: fetchErr } = await supabase
      .from('publication_performance')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !existing) return errorResponse('Performance record not found', 404)

    const merged = { ...existing, ...metrics }
    const score = calculatePerformanceScore(merged as unknown as Parameters<typeof calculatePerformanceScore>[0])

    const { data, error } = await supabase
      .from('publication_performance')
      .update({
        ...metrics,
        performance_score: score,
        is_viral: score >= 90,
        velocity: (merged.views_2h || 0) / 2,
        last_checked_at: new Date().toISOString(),
        check_count: (existing.check_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return errorResponse(error.message, 500)
    return jsonResponse(data)
  }

  // Creating new record
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()
  const postedAt = new Date(parsed.data.posted_at)

  const perfData = {
    ...parsed.data,
    views_1h: parsed.data.views_1h ?? 0,
    views_2h: parsed.data.views_2h ?? 0,
    views_6h: parsed.data.views_6h ?? 0,
    views_24h: parsed.data.views_24h ?? 0,
    views_48h: parsed.data.views_48h ?? 0,
    views_total: parsed.data.views_total ?? 0,
    likes: parsed.data.likes ?? 0,
    comments: parsed.data.comments ?? 0,
    shares: parsed.data.shares ?? 0,
    watch_time_avg: parsed.data.watch_time_avg ?? null,
    retention_rate: parsed.data.retention_rate ?? null,
    has_captions: parsed.data.has_captions ?? false,
    has_split_screen: parsed.data.has_split_screen ?? false,
    clip_duration_seconds: parsed.data.clip_duration_seconds ?? null,
    niche: parsed.data.niche ?? null,
    scheduled_publication_id: parsed.data.scheduled_publication_id ?? null,
  }

  const score = calculatePerformanceScore(perfData as Parameters<typeof calculatePerformanceScore>[0])

  const { data, error } = await supabase
    .from('publication_performance')
    .insert({
      user_id: user.id,
      ...perfData,
      day_of_week: postedAt.getDay(),
      hour_of_day: postedAt.getHours(),
      performance_score: score,
      is_viral: score >= 90,
      velocity: (perfData.views_2h || 0) / 2,
      last_checked_at: new Date().toISOString(),
      check_count: 1,
    })
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
