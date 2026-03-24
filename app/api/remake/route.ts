import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runRemakeScript } from '@/lib/claude/remake-script'

const bodySchema = z.object({
  clip_id: z.string().uuid(),
})

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

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'Paramètres invalides' }, { status: 400 })
  }

  const { clip_id } = parsed.data
  const admin = createAdminClient()

  // Fetch clip + verify ownership
  const { data: clip, error: clipError } = await admin
    .from('clips')
    .select('id, video_id, user_id, transcript_segment, title')
    .eq('id', clip_id)
    .single()

  if (clipError || !clip) {
    return NextResponse.json({ data: null, error: 'Not found', message: 'Clip introuvable' }, { status: 404 })
  }
  if (clip.user_id !== user.id) {
    return NextResponse.json({ data: null, error: 'Forbidden', message: 'Accès refusé' }, { status: 403 })
  }

  // Fetch viral score for current hook/score
  const { data: viralScore } = await admin
    .from('viral_scores')
    .select('score, hook_type')
    .eq('clip_id', clip_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const transcript = clip.transcript_segment ?? ''
  const currentHook = viralScore?.hook_type ?? null
  const currentScore = viralScore?.score ?? null

  try {
    const result = await runRemakeScript(transcript, currentHook, currentScore)
    return NextResponse.json({ data: result, error: null, message: 'Remake généré avec succès' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors du remake'
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  }
}
