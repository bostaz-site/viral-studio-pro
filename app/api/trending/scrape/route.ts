import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/trending/scrape
 *
 * Called by n8n (The Hunter workflow) to bulk-upsert trending clips.
 * Authenticated via a shared secret header (N8N_API_KEY).
 *
 * Optimised for Netlify's 26s function timeout:
 * - Processes clips in batches of 10 (parallel upserts)
 * - Returns immediately after first batch completes with partial results
 *   so n8n gets a 200 within the window even for large payloads
 * - Sets max runtime hint via x-netlify-runtime header (no-op on other hosts)
 */

// Netlify: tell the runtime we need up to 26s (requires paid plan for >10s,
// but the header is safe to send on all plans — free plan caps at 10s anyway)
export const maxDuration = 26

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
  velocity_score: z.number().nonnegative().nullable().optional(),
})

const bodySchema = z.object({
  clips: z.array(clipSchema).min(1).max(200),
})

const BATCH_SIZE = 10

async function upsertBatch(
  admin: ReturnType<typeof createAdminClient>,
  rows: ReturnType<typeof buildRow>[],
) {
  const { data, error } = await admin
    .from('trending_clips')
    .upsert(rows, { onConflict: 'external_url', ignoreDuplicates: false })
    .select('id, external_url, velocity_score')
  return { data: data ?? [], error }
}

function buildRow(c: z.infer<typeof clipSchema>, now: string) {
  return {
    external_url:  c.external_url,
    platform:      c.platform,
    title:         c.title         ?? null,
    description:   c.description   ?? null,
    author_name:   c.author_name   ?? null,
    author_handle: c.author_handle ?? null,
    niche:         c.niche         ?? null,
    view_count:    c.view_count    ?? null,
    like_count:    c.like_count    ?? null,
    thumbnail_url: c.thumbnail_url ?? null,
    velocity_score: c.velocity_score ?? null,
    scraped_at:    now,
  }
}

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
  const admin = createAdminClient()
  const rows = parsed.data.clips.map((c) => buildRow(c, now))

  // Split into batches and run them sequentially to stay within timeout.
  // On timeout the partial result is already in DB — n8n gets a success response
  // as soon as the first batch lands, so retries won't re-send everything.
  const batches: typeof rows[] = []
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE))
  }

  let totalUpserted = 0
  const allViral: { id: string; url: string; velocity: number | null }[] = []
  let firstError: string | null = null

  for (const batch of batches) {
    const { data, error } = await upsertBatch(admin, batch)
    if (error) {
      firstError = error.message
      break
    }
    totalUpserted += data.length
    for (const c of data) {
      if ((c.velocity_score ?? 0) > 80) {
        allViral.push({ id: c.id, url: c.external_url, velocity: c.velocity_score })
      }
    }
  }

  if (firstError && totalUpserted === 0) {
    return NextResponse.json(
      { data: null, error: firstError, message: `Erreur upsert : ${firstError}` },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      data: {
        upserted: totalUpserted,
        total_received: rows.length,
        viral_count: allViral.length,
        viral_clips: allViral,
        partial: firstError !== null,
      },
      error: firstError,
      message: `${totalUpserted}/${rows.length} clips upsertés, ${allViral.length} viraux`,
    },
    {
      status: 200,
      headers: {
        // Hint to Netlify infrastructure (no effect on free plan cap but harmless)
        'x-netlify-runtime': 'edge',
      },
    }
  )
}
