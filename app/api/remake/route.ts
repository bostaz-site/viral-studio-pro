import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { runRemakeScript } from '@/lib/claude/remake-script'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const bodySchema = z.object({
  clip_id: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: 'unauthorized', message: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Rate limiting (AI operation)
    const rl = rateLimit(user.id, RATE_LIMITS.ai.limit, RATE_LIMITS.ai.windowMs)
    if (!rl.allowed) {
      return NextResponse.json(
        { data: null, error: 'Rate limited', message: `Trop de requêtes. Réessayez dans ${Math.ceil((rl.retryAfterMs ?? 0) / 1000)}s` },
        { status: 429 }
      )
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json(
        { data: null, error: 'invalid_json', message: 'Corps invalide' },
        { status: 400 }
      )
    }

    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.message, message: 'clip_id UUID requis' },
        { status: 400 }
      )
    }

    const { clip_id } = parsed.data

    // Fetch clip
    const { data: clip, error: clipError } = await supabase
      .from('clips')
      .select('*')
      .eq('id', clip_id)
      .eq('user_id', user.id)
      .single()

    if (clipError || !clip) {
      return NextResponse.json(
        { data: null, error: 'clip_not_found', message: 'Clip introuvable' },
        { status: 404 }
      )
    }

    // Fetch viral score for current hook info
    const { data: viralScore } = await supabase
      .from('viral_scores')
      .select('*')
      .eq('clip_id', clip.id)
      .single()

    // Get transcript
    const transcript = clip.transcript_segment || 'Pas de transcription disponible'
    const currentHook = viralScore?.hook_type ?? null
    const currentScore = viralScore?.score ?? null

    // Run Claude remake
    const result = await runRemakeScript(transcript, currentHook, currentScore)

    return NextResponse.json({
      data: result,
      error: null,
      message: 'Remake généré avec succès',
    })
  } catch (err) {
    console.error('[/api/remake] Error:', err)
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { data: null, error: 'internal', message },
      { status: 500 }
    )
  }
}
