import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/withAuth'

const platformCaptionSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
})

const bodySchema = z.object({
  clip_id: z.string().uuid(),
  platforms: z.array(z.enum(['tiktok', 'instagram', 'youtube'])).min(1),
  captions: z.record(z.enum(['tiktok', 'instagram', 'youtube']), platformCaptionSchema),
  scheduled_at: z.string().datetime(),
})

export const POST = withAuth(async (req, user) => {
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
      { data: null, error: parsed.error.message, message: 'Paramètres invalides' },
      { status: 400 }
    )
  }

  const { clip_id, platforms, captions, scheduled_at } = parsed.data
  const supabase = createClient()

  // Validate clip ownership
  const { data: clip } = await supabase
    .from('clips')
    .select('id')
    .eq('id', clip_id)
    .eq('user_id', user.id)
    .single()

  if (!clip) {
    return NextResponse.json(
      { data: null, error: 'Clip not found', message: 'Clip introuvable' },
      { status: 404 }
    )
  }

  const admin = createAdminClient()

  // Fetch social accounts
  const { data: accounts } = await admin
    .from('social_accounts')
    .select('id, platform')
    .eq('user_id', user.id)
    .in('platform', platforms)

  const accountMap = new Map(accounts?.map((a) => [a.platform, a]) ?? [])
  const inserted: string[] = []

  for (const platform of platforms) {
    const account = accountMap.get(platform)
    const copy = captions[platform]
    if (!copy) continue

    const { data: pub } = await admin.from('publications').insert({
      clip_id,
      social_account_id: account?.id ?? null,
      platform,
      caption: copy.caption,
      hashtags: copy.hashtags,
      scheduled_at,
      status: 'scheduled',
    }).select('id').single()

    if (pub) inserted.push(pub.id)
  }

  return NextResponse.json({
    data: { scheduled_ids: inserted, scheduled_at },
    error: null,
    message: `${inserted.length} publication(s) planifiée(s)`,
  })
})

export const GET = withAuth(async (req, user) => {
  const supabase = createClient()
  const admin = createAdminClient()

  // Optional date range filters
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  // Fetch user's clip IDs first (RLS-safe approach)
  const { data: userClips } = await supabase
    .from('clips')
    .select('id')
    .eq('user_id', user.id)

  const clipIds = userClips?.map((c) => c.id) ?? []
  if (clipIds.length === 0) {
    return NextResponse.json({ data: [], error: null, message: 'OK' })
  }

  let query = admin
    .from('publications')
    .select('id, platform, caption, scheduled_at, published_at, status, clip_id, platform_post_id')
    .in('clip_id', clipIds)
    .order('scheduled_at', { ascending: true })

  if (from) query = query.gte('scheduled_at', from)
  if (to) query = query.lte('scheduled_at', to)

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message, message: 'Erreur de récupération' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data, error: null, message: 'OK' })
})
