import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/trending/scrape
 *
 * Called by n8n (The Hunter workflow) to bulk-upsert trending clips.
 * Authenticated via a shared secret header (N8N_API_KEY).
 *
 * Body: { clips: TrendingClipInput[] }
 */

const clipSchema = z.object({
  external_url: z.string().url(),
  platform: z.string(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  author_name: z.string().nullable().optional(),
  author_handle: z.string().nullable().optional(),
  niche: z.string().nullable().optional(),
  view_count: z.number().int().nonnegative().nullable().optional(),
  like_count: z.number().int().nonnegative().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  /** Velocity score pre-calculated by n8n Code node */
  velocity_score: z.number().nonnegative().nullable().optional(),
})

const bodySchema = z.object({
  clips: z.array(clipSchema).min(1).max(200),
})

export async function POST(req: NextRequest) {
  // Auth: shared secret
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Clé API invalide' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON', message: 'Corps invalide' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'Données invalides' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const rows = parsed.data.clips.map((c) => ({
    external_url: c.external_url,
    platform: c.platform,
    title: c.title ?? null,
    description: c.description ?? null,
    author_name: c.author_name ?? null,
    author_handle: c.author_handle ?? null,
    niche: c.niche ?? null,
    view_count: c.view_count ?? null,
    like_count: c.like_count ?? null,
    thumbnail_url: c.thumbnail_url ?? null,
    velocity_score: c.velocity_score ?? null,
    scraped_at: now,
  }))

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('trending_clips')
    .upsert(rows, { onConflict: 'external_url' })
    .select('id, external_url, velocity_score')

  if (error) {
    return NextResponse.json({ data: null, error: error.message, message: 'Erreur lors de l\'upsert' }, { status: 500 })
  }

  // Find high-velocity clips (score > 80) for notification
  const viral = (data ?? []).filter((c) => (c.velocity_score ?? 0) > 80)

  return NextResponse.json({
    data: {
      upserted: data?.length ?? 0,
      viral_count: viral.length,
      viral_clips: viral.map((c) => ({ id: c.id, url: c.external_url, velocity: c.velocity_score })),
    },
    error: null,
    message: `${data?.length ?? 0} clips upsertés, ${viral.length} viraux détectés`,
  })
}
