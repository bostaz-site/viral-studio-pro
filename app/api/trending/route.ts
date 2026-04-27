import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

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
 * Group clips from the same stream (same streamer, clip_created_at < 3h apart).
 * Groups of >= 3 clips get a stream_group_id. The best-scored clip is the
 * "representative" (not collapsed); subsequent clips are collapsed.
 */
function applyStreamGrouping(clips: Record<string, unknown>[]): void {
  const STREAM_GAP_MS = 3 * 60 * 60 * 1000 // 3 hours
  const MIN_GROUP_SIZE = 3

  // Group by streamer_id
  const byStreamer = new Map<string, Record<string, unknown>[]>()
  for (const clip of clips) {
    const sid = clip.streamer_id as string | null
    if (!sid) continue
    let arr = byStreamer.get(sid)
    if (!arr) { arr = []; byStreamer.set(sid, arr) }
    arr.push(clip)
  }

  for (const [streamerId, streamerClips] of byStreamer) {
    if (streamerClips.length < MIN_GROUP_SIZE) continue

    // Sort by clip_created_at ascending for grouping
    streamerClips.sort((a, b) => {
      const ta = new Date(a.clip_created_at as string || 0).getTime()
      const tb = new Date(b.clip_created_at as string || 0).getTime()
      return ta - tb
    })

    // Merge clips within 3h into stream groups
    const groups: Record<string, unknown>[][] = []
    let current: Record<string, unknown>[] = [streamerClips[0]]

    for (let i = 1; i < streamerClips.length; i++) {
      const prevTime = new Date(current[current.length - 1].clip_created_at as string || 0).getTime()
      const curTime = new Date(streamerClips[i].clip_created_at as string || 0).getTime()
      if (curTime - prevTime <= STREAM_GAP_MS) {
        current.push(streamerClips[i])
      } else {
        groups.push(current)
        current = [streamerClips[i]]
      }
    }
    groups.push(current)

    for (const group of groups) {
      if (group.length < MIN_GROUP_SIZE) continue

      // Sort by score desc — first clip is the representative
      group.sort((a, b) => ((b.velocity_score as number) ?? 0) - ((a.velocity_score as number) ?? 0))

      // Generate stable group ID from streamer + rounded timestamp
      const midTime = new Date(group[Math.floor(group.length / 2)].clip_created_at as string || 0).getTime()
      const roundedHour = Math.floor(midTime / 3_600_000)
      const groupId = `sg_${streamerId.slice(0, 8)}_${roundedHour}`

      for (let i = 0; i < group.length; i++) {
        group[i].stream_group_id = groupId
        group[i].stream_group_count = group.length
        group[i].stream_group_collapsed = i > 0
      }
    }
  }
}

/**
 * GET /api/trending — Public endpoint.
 * Supports filters: niche, platform (twitch/kick/youtube_gaming), search, sort,
 * duration (short/medium/long), feed (hot_now/early_gem/proven/recent),
 * limit, cursor.
 *
 * Cursor-based pagination: pass `cursor={score}_{id}` to get the next page.
 * The response includes `next_cursor` (null on last page).
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`browse:${ip}`, RATE_LIMITS.browse.limit, RATE_LIMITS.browse.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ data: null, error: 'Rate limited' }, { status: 429 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const niche    = searchParams.get('niche')
    const platform = searchParams.get('platform')
    const rawSearch = searchParams.get('search')
    const sort     = searchParams.get('sort') ?? 'velocity'
    const duration = searchParams.get('duration')
    const feed     = searchParams.get('feed')
    const limit    = Math.min(Math.max(Number(searchParams.get('limit') ?? '50'), 1), 200)
    const cursor   = searchParams.get('cursor') // format: "{sortValue}_{id}"

    const admin = createAdminClient()
    let query = admin.from('trending_clips').select('*', { count: 'exact' })

    // Niche filter — supports comma-separated values (e.g. "irl,fps")
    if (niche) {
      const niches = niche.split(',').map(sanitizeSearch).filter(Boolean)
      if (niches.length === 1) {
        query = query.ilike('niche', `%${niches[0]}%`)
      } else if (niches.length > 1) {
        query = query.in('niche', niches)
      }
    }
    // Platform filter — supports comma-separated values (e.g. "twitch,kick")
    if (platform) {
      const validPlatforms = ['twitch', 'youtube_gaming', 'kick']
      const platforms = platform.split(',').filter(p => validPlatforms.includes(p))
      if (platforms.length === 1) {
        query = query.eq('platform', platforms[0])
      } else if (platforms.length > 1) {
        query = query.in('platform', platforms)
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

    // Determine sort column for cursor-based pagination
    const useDate = feed === 'recent' || sort === 'date'
    const sortCol = useDate ? 'clip_created_at' : 'velocity_score'

    // Sort — always add id as tiebreaker for stable cursor pagination
    if (useDate) {
      query = query.order('clip_created_at', { ascending: false, nullsFirst: false })
    } else if (sort === 'velocity') {
      query = query.order('velocity_score', { ascending: false, nullsFirst: false })
    } else if (sort === 'views') {
      query = query.order('view_count', { ascending: false, nullsFirst: false })
    } else {
      query = query.order('scraped_at', { ascending: false, nullsFirst: false })
    }
    query = query.order('id', { ascending: false })

    // Cursor-based pagination: filter rows "after" the cursor
    if (cursor) {
      const sepIdx = cursor.indexOf('_')
      if (sepIdx > 0) {
        const cursorValue = cursor.slice(0, sepIdx)
        const cursorId = cursor.slice(sepIdx + 1)
        // (sortCol, id) < (cursorValue, cursorId) for DESC ordering
        // Supabase PostgREST: use .or() with compound condition
        query = query.or(
          `${sortCol}.lt.${cursorValue},` +
          `and(${sortCol}.eq.${cursorValue},id.lt.${cursorId})`
        )
      }
    }

    query = query.limit(limit)

    const { data, error, count } = await query

    if (error) {
      console.error('[Trending API] Supabase error:', error)
      return NextResponse.json({ data: null, error: 'Fetch failed', message: error.message ?? 'Failed to fetch clips' }, { status: 500 })
    }

    // Build next_cursor from the last item
    const items = (data ?? []) as Record<string, unknown>[]
    let nextCursor: string | null = null
    if (items.length === limit) {
      const last = items[items.length - 1]
      const lastSortValue = useDate
        ? (last.clip_created_at ?? last.scraped_at ?? '')
        : (last.velocity_score ?? 0)
      nextCursor = `${lastSortValue}_${last.id}`
    }

    // Apply stream grouping (mutates items in-place, adds group fields)
    applyStreamGrouping(items)

    return NextResponse.json({
      data: items,
      error: null,
      message: 'OK',
      meta: { total: count ?? 0, limit, next_cursor: nextCursor },
    })
  } catch (err) {
    console.error('[Trending API] Unexpected error:', err)
    return NextResponse.json(
      { data: null, error: 'Internal server error', message: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    )
  }
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
