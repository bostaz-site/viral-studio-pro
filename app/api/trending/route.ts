import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const postSchema = z.object({
  external_url: z.string().url(),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  title: z.string().optional(),
  description: z.string().optional(),
  author_name: z.string().optional(),
  author_handle: z.string().optional(),
  niche: z.string().optional(),
  view_count: z.number().int().nonnegative().optional(),
  like_count: z.number().int().nonnegative().optional(),
  velocity_score: z.number().nonnegative().optional(),
  thumbnail_url: z.string().url().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const niche    = searchParams.get('niche')
  const platform = searchParams.get('platform')
  const search   = searchParams.get('search')
  const sort     = searchParams.get('sort') ?? 'velocity'
  const limit    = Math.min(Number(searchParams.get('limit') ?? '50'), 100)
  const offset   = Number(searchParams.get('offset') ?? '0')

  const admin = createAdminClient()
  let query = admin.from('trending_clips').select('*', { count: 'exact' })

  if (niche)    query = query.ilike('niche', niche)
  if (platform) query = query.eq('platform', platform)
  if (search)   query = query.or(`title.ilike.%${search}%,author_name.ilike.%${search}%,author_handle.ilike.%${search}%`)

  if (sort === 'velocity') query = query.order('velocity_score', { ascending: false, nullsFirst: false })
  else if (sort === 'views') query = query.order('view_count', { ascending: false, nullsFirst: false })
  else query = query.order('scraped_at', { ascending: false, nullsFirst: false })

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ data: null, error: error.message, message: 'Erreur lors de la récupération' }, { status: 500 })
  }

  return NextResponse.json({ data, error: null, message: 'OK', meta: { total: count ?? 0, limit, offset } })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
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
    return NextResponse.json({ data: null, error: error.message, message: 'Erreur lors de l\'ajout' }, { status: 500 })
  }

  return NextResponse.json({ data, error: null, message: 'Clip trending ajouté' }, { status: 201 })
}
