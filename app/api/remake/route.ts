import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runRemakeScript } from '@/lib/claude/remake-script'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Check auth
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

    const body = (await req.json()) as { clip_id?: string }

    if (!body.clip_id) {
      return NextResponse.json(
        { data: null, error: 'missing_clip_id', message: 'clip_id requis' },
        { status: 400 }
      )
    }

    // Fetch clip
    const { data: clip, error: clipError } = await supabase
      .from('clips')
      .select('*')
      .eq('id', body.clip_id)
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
