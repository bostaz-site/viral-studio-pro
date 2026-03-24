import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { runCopywriterSeo } from '@/lib/claude/copywriter-seo'

const bodySchema = z.object({
  clip_id: z.string().uuid(),
  niche: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Non autorisé' },
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
      { data: null, error: parsed.error.message, message: 'Paramètres invalides' },
      { status: 400 }
    )
  }

  const { clip_id, niche } = parsed.data

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
}
