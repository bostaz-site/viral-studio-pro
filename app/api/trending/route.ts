import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'

const postSchema = z.object({
  external_url: z.string().url(),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
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

/**
 * Sanitize a search string for use in PostgREST ilike filters.
 * Strips characters that could break the filter syntax.
 */
function sanitizeSearch(input: string): string {
  return input
    .replace(/[%_\\'"().,;]/g, '') // Remove PostgREST special chars
    .trim()
    .slice(0, 100) // Max length
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const niche    = searchParams.get('niche')
  const platform = searchParams.get('platform')
  const rawSearch = searchParams.get('search')
  const sort     = searchParams.get('sort') ?? 'velocity'
  const limit    = Math.min(Math.max(Number(searchParams.get('limit') ?? '50'), 1), 100)
  const offset   = Math.max(Number(searchParams.get('offset') ?? '0'), 0)

  const admin = createAdminClient()
  let query = admin.from('trending_clips').select('*', { count: 'exact' })

  // Sanitize and validate filter inputs
  if (niche) {
    const safeNiche = sanitizeSearch(niche)
    if (safeNiche) query = query.ilike('niche', `%${safeNiche}%`)
  }
  if (platform) {
    // Platform must be one of the allowed values
    if (['tiktok', 'instagram', 'youtube'].includes(platform)) {
      query = query.eq('platform', platform)
    }
  }
  if (rawSearch) {
    const safeSearch = sanitizeSearch(rawSearch)
    if (safeSearch) {
      query = query.or(`title.ilike.%${safeSearch}%,author_name.ilike.%${safeSearch}%,author_handle.ilike.%${safeSearch}%`)
    }
  }

  if (sort === 'velocity') query = query.order('velocity_score', { ascending: false, nullsFirst: false })
  else if (sort === 'views') query = query.order('view_count', { ascending: false, nullsFirst: false })
  else query = query.order('scraped_at', { ascending: false, nullsFirst: false })

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ data: null, error: 'Erreur lors de la récupération', message: 'Erreur lors de la récupération' }, { status: 500 })
  }

  return NextResponse.json({ data, error: null, message: 'OK', meta: { total: count ?? 0, limit, offset } })
}

/**
 * POST /api/trending — Add/update a trending clip.
 *
 * RESTRICTED: Only accessible via API key (n8n/scraper service).
 * Regular users cannot inject data into the trending feed.
 */
export async function POST(req: NextRequest) {
  // Auth via API key (internal service calls only — n8n scraper)
  const apiKey = req.headers.get('x-api-key')
  const expectedKey = process.env.N8N_API_KEY

  if (!apiKey || !expectedKey || !timingSafeCompare(apiKey, expectedKey)) {
    // Fallback: check if it's an admin user (for manual testing)
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Accès réservé aux services internes' }, { status: 401 })
    }

    // Check if user has admin privileges (plan = 'studio' for now)
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (profile?.plan !== 'studio') {
      return NextResponse.json(
        { data: null, error: 'Forbidden', message: 'Seuls les administrateurs peuvent ajouter des clips trending' },
        { status: 403 }
      )
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON', message: 'Corps de requête invalide' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'Paramètres invalides' }, { status: 400 })
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
    return NextResponse.json({ data: null, error: 'Erreur lors de l\'ajout', message: 'Erreur lors de l\'ajout' }, { status: 500 })
  }

  return NextResponse.json({ data, error: null, message: 'Clip trending ajouté' }, { status: 201 })
}
