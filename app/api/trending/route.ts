import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'

const postSchema = z.object({
  external_url: z.string().url(),
  platform: z.enum(['twitch', 'youtube_gaming', 'kick']),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  author_name: z.string().max(200).optional(),
  author_handle: z.string().max(200).optional(),
  niche: z.string().max(100).optional(),
  view_count: z.number().int().nonnegative().optional(),
  like_count: z.number().int().nonnegative().optional(),
  velocity_score: z.number().nonnegative().optional(),
  thumbnail_url: z.string().url().optional(),
})

function sanitizeSearch(input: string): string {
  return input
    .replace(/[%_\\'"().,;]/g, '')
    .trim()
    .slice(0, 100)
}

/**
 * GET /api/trending — Public endpoint.
 * Supports filters: niche, platform (twitch/kick/youtube_gaming), search, sort,
 * duration (short/medium/long), feed (hot_now/early_gem/proven/recent),
 * limit, offset.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const niche    = searchParams.get('niche')
  const platform = searchParams.get('platform')
  const rawSearch = searchParams.get('search')
  const sort     = searchParams.get('sort') ?? 'velocity'
  const duration = searchParams.get('duration')
  const feed     = searchParams.get('feed')
  const limit    = Math.min(Math.max(Number(searchParams.get('limit') ?? '50'), 1), 200)
  const offset   = Math.max(Number(searchParams.get('offset') ?? '0'), 0)

  const admin = createAdminClient()
  let query = admin.from('trending_clips').select('*', { count: 'exact' })

  if (niche) {
    const safeNiche = sanitizeSearch(niche)
    if (safeNiche) query = query.ilike('niche', `%${safeNiche}%`)
  }
  if (platform) {
    if (['twitch', 'youtube_gaming', 'kick'].includes(platform)) {
      query = query.eq('platform', platform)
    }
  }
  if (rawSearch) {
    const safeSearch = sanitizeSearch(rawSearch)
    if (safeSearch) {
      query = query.or(`title.ilike.%${safeSearch}%,author_name.ilike.%${safeSearch}%,author_handle.ilike.%${safeSearch}%`)
    }
  }

  // Duration filter
  if (duration === 'short') {
    query = query.lt('duration_seconds', 30)
  } else if (duration === 'medium') {
    query = query.gte('duration_seconds', 30).lt('duration_seconds', 60)
  } else if (duration === 'long') {
    query = query.gte('duration_seconds', 60)
  }

  // Feed filter
  if (feed === 'hot_now') {
    query = query.eq('feed_category', 'hot_now')
  } else if (feed === 'early_gem') {
    query = query.eq('feed_category', 'early_gem')
  } else if (feed === 'proven') {
    query = query.eq('feed_category', 'proven')
  }

  // Sort
  if (feed === 'recent' || sort === 'date') {
    query = query.order('clip_created_at', { ascending: false, nullsFirst: false })
  } else if (sort === 'velocity') {
    query = query.order('velocity_score', { ascending: false, nullsFirst: false })
  } else if (sort === 'views') {
    query = query.order('view_count', { ascending: false, nullsFirst: false })
  } else {
    query = query.order('scraped_at', { ascending: false, nullsFirst: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ data: null, error: 'Fetch failed', message: 'Failed to fetch clips' }, { status: 500 })
  }

  return NextResponse.json({ data, error: null, message: 'OK', meta: { total: count ?? 0, limit, offset } })
}

/**
 * POST /api/trending — Add/update a trending clip. Restricted.
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const expectedKey = process.env.N8N_API_KEY

  if (!apiKey || !expectedKey || !timingSafeCompare(apiKey, expectedKey)) {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Access restricted to internal services' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (profile?.plan !== 'studio') {
      return NextResponse.json(
        { data: null, error: 'Forbidden', message: 'Only admins can add trending clips' },
        { status: 403 }
      )
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON', message: 'Invalid request body' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'Invalid parameters' }, { status: 400 })
  }

  const admin = createAdminClient()

  const insertData = {
    external_url: parsed.data.external_url,
    platform: parsed.data.platform,
    title: parsed.data.title ?? null,
    description: parsed.data.description ?? null,
    author_name: parsed.data.author_name ?? null,
    author_handle: parsed.data.author_handle ?? null,
    niche: parsed.data.niche ?? null,
    view_count: parsed.data.view_count ?? null,
    like_count: parsed.data.like_count ?? null,
    velocity_score: parsed.data.velocity_score ?? null,
    thumbnail_url: parsed.data.thumbnail_url ?? null,
    scraped_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from('trending_clips')
    .upsert(insertData, { onConflict: 'external_url' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ data: null, error: 'Add failed', message: 'Failed to add clip' }, { status: 500 })
  }

  return NextResponse.json({ data, error: null, message: 'Trending clip added' }, { status: 201 })
}
