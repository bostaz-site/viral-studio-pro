import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { runCopywriterSeo } from '@/lib/claude/copywriter-seo'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { withAuth } from '@/lib/api/withAuth'

const bodySchema = z.object({
  clip_id: z.string().uuid(),
  niche: z.string().optional(),
})

export const POST = withAuth(async (req, user) => {
  // Rate limiting (AI operation: 5 req/min)
  const rl = rateLimit(user.id, RATE_LIMITS.ai.limit, RATE_LIMITS.ai.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { data: null, error: 'Rate limited', message: `Trop de requêtes. Réessayez dans ${Math.ceil((rl.retryAfterMs ?? 0) / 1000)}s` },
      { status: 429 }
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
      { data: null, error: parsed.error.message, message: 'Paramètres invalides' },
      { status: 400 }
    )
  }

  const { clip_id, niche } = parsed.data
  const supabase = createClient()

  // Fetch clip transcript (owned by current user)
  const { data: clip, error: clipError } = await supabase
    .from('clips')
    .select('transcript_segment, title')
    .eq('id', clip_id)
    .eq('user_id', user.id)
    .single()

  if (clipError || !clip) {
    return NextResponse.json(
      { data: null, error: 'Clip not found', message: 'Clip introuvable' },
      { status: 404 }
    )
  }

  const transcript = clip.transcript_segment ?? clip.title ?? 'Clip sans transcription'

  try {
    const captions = await runCopywriterSeo(transcript, niche)
    return NextResponse.json({ data: captions, error: null, message: 'Captions générées' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur Claude'
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  }
})
