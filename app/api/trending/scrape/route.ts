import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/trending/scrape
 *
 * Called by n8n (The Hunter) to bulk-upsert trending clips.
 * Auth: x-api-key header = N8N_API_KEY env var.
 *
 * Optimised for Netlify free plan 10s limit:
 * - Single upsert, no .select() → fastest possible DB write
 * - Viral detection removed from this route (handled by n8n velocity score)
 */

const clipSchema = z.object({
  external_url:   z.string().url(),
  platform:       z.string(),
  title:          z.string().nullable().optional(),
  description:    z.string().nullable().optional(),
  author_name:    z.string().nullable().optional(),
  author_handle:  z.string().nullable().optional(),
  niche:          z.string().nullable().optional(),
  view_count:     z.number().int().nonnegative().nullable().optional(),
  like_count:     z.number().int().nonnegative().nullable().optional(),
  thumbnail_url:  z.string().url().nullable().optional(),
  velocity_score: z.number().nonnegative().nullable().optional(),
})

const bodySchema = z.object({
  clips: z.array(clipSchema).min(1).max(200),
})

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Clé API invalide' },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON', message: 'Corps invalide' },
      { status: 400 }
    )
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.message, message: 'Données invalides' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  const rows = parsed.data.clips.map((c) => ({
    external_url:   c.external_url,
    platform:       c.platform,
    title:          c.title         ?? null,
    description:    c.description   ?? null,
    author_name:    c.author_name   ?? null,
    author_handle:  c.author_handle ?? null,
    niche:          c.niche         ?? null,
    view_count:     c.view_count    ?? null,
    like_count:     c.like_count    ?? null,
    thumbnail_url:  c.thumbnail_url ?? null,
    velocity_score: c.velocity_score ?? null,
    scraped_at:     now,
  }))

  const { error, count } = await createAdminClient()
    .from('trending_clips')
    .upsert(rows, { onConflict: 'external_url', ignoreDuplicates: false, count: 'exact' })

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message, message: 'Erreur upsert' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: { upserted: count ?? rows.length, received: rows.length },
    error: null,
    message: `${count ?? rows.length} clips upsertés`,
  })
}
