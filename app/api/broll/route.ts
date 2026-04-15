import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAnthropicClient, CLAUDE_MODEL } from '@/lib/claude/client'
import { withAuth } from '@/lib/api/withAuth'

const inputSchema = z.object({
  clip_id: z.string().uuid(),
})

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrollSuggestion {
  timestamp: number        // seconds into the clip where B-roll should start
  duration: number         // recommended B-roll duration (seconds)
  keyword: string          // search term for stock footage
  reason: string           // why B-roll helps here
  visual_direction: string // what the B-roll should show visually
  priority: 'high' | 'medium' | 'low'
}

export interface BrollAnalysisResult {
  suggestions: BrollSuggestion[]
  total_broll_time: number
  coverage_ratio: number   // 0-1, proportion of clip that could use B-roll
}

// ── Route ─────────────────────────────────────────────────────────────────────

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

  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.message, message: 'Paramètres invalides' },
      { status: 400 }
    )
  }

  const { clip_id } = parsed.data
  const admin = createAdminClient()

  // Fetch clip + transcription segment
  const { data: clip } = await admin
    .from('clips')
    .select('id, start_time, end_time, duration_seconds, transcript_segment, video_id, user_id')
    .eq('id', clip_id)
    .eq('user_id', user.id)
    .single()

  if (!clip) {
    return NextResponse.json(
      { data: null, error: 'Clip not found', message: 'Clip introuvable' },
      { status: 404 }
    )
  }

  const clipDuration = (clip.end_time ?? 0) - (clip.start_time ?? 0)

  // Fetch transcription if no transcript_segment
  let transcriptText = clip.transcript_segment ?? ''
  if (!transcriptText && clip.video_id) {
    const { data: transcription } = await admin
      .from('transcriptions')
      .select('full_text, segments')
      .eq('video_id', clip.video_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (transcription) {
      // Extract only the clip's text from segments
      const segs = transcription.segments as Array<{ start: number; end: number; text: string }> | null
      if (segs) {
        transcriptText = segs
          .filter((s) => s.start >= (clip.start_time ?? 0) && s.end <= (clip.end_time ?? Infinity))
          .map((s) => s.text)
          .join(' ')
      } else {
        transcriptText = transcription.full_text
      }
    }
  }

  if (!transcriptText) {
    return NextResponse.json(
      { data: null, error: 'No transcript', message: 'Aucune transcription disponible pour analyser le B-roll' },
      { status: 422 }
    )
  }

  // Claude analysis
  try {
    const anthropic = createAnthropicClient()
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: `Tu es un directeur artistique vidéo expert en montage B-roll pour les vidéos courtes virales.
Identifie les moments dans le clip où un B-roll augmenterait l'engagement et la rétention.

RÈGLES :
- B-roll sur les concepts abstraits, statistiques, lieux mentionnés
- Jamais de B-roll pendant les moments d'émotion forte (l'humain doit rester visible)
- Le B-roll renforce le propos, ne le distrait pas
- Durée recommandée par insertion : 2-5 secondes
- Retourne UNIQUEMENT du JSON valide sans markdown.`,
      messages: [
        {
          role: 'user',
          content: `Analyse ce clip (durée : ${clipDuration.toFixed(1)}s) et propose des insertions B-roll.

Les timestamps sont RELATIFS au clip (0 = début du clip).

Réponds en JSON :
{
  "suggestions": [
    {
      "timestamp": 3.5,
      "duration": 3,
      "keyword": "terme de recherche pour stock footage en anglais",
      "reason": "pourquoi du B-roll ici",
      "visual_direction": "description précise de ce qui doit apparaître visuellement",
      "priority": "high|medium|low"
    }
  ],
  "total_broll_time": 9,
  "coverage_ratio": 0.3
}

Transcription du clip :
${transcriptText}`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected Claude response')

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const result = JSON.parse(jsonMatch[0]) as BrollAnalysisResult

    return NextResponse.json({
      data: {
        clip_id,
        clip_duration: clipDuration,
        ...result,
      },
      error: null,
      message: `${result.suggestions.length} suggestion(s) B-roll générées`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur Claude'
    return NextResponse.json(
      { data: null, error: msg, message: `Analyse B-roll échouée : ${msg}` },
      { status: 500 }
    )
  }
})
