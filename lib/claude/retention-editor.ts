import { createAnthropicClient, CLAUDE_MODEL, parseClaudeJson } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SegmentToKeep {
  start: number
  end: number
  reason: string
  intensity: number  // 1-10, emotional intensity of segment
}

export interface CutReason {
  start: number
  end: number
  why_cut: string
}

export interface RetentionEditorResult {
  segments_to_keep: SegmentToKeep[]
  suggested_order: number[]
  climax_timestamp: number
  estimated_retention_score: number
  cut_reasons: CutReason[]
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un expert en ingénierie de rétention. Ta spécialité : la structure des 3 premières secondes et l'identification du climax.

RÈGLES :
- Ne commence JAMAIS par "Aujourd'hui je vais vous parler de..."
- Commence toujours par le résultat final ou une menace
- Identifie le "Moment de Rupture" (le climax émotionnel)
- Coupe tout le gras : pauses, répétitions, tangentes, intros molles
- Clip entre 15 et 90 secondes, le premier segment DOIT être le plus fort

Retourne UNIQUEMENT du JSON valide sans markdown ni backticks.`

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runRetentionEditor(
  transcript: string,
  videoDurationSeconds: number
): Promise<RetentionEditorResult> {
  const anthropic = createAnthropicClient()

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analyse cette transcription (durée source : ${videoDurationSeconds}s) et identifie les segments à garder pour maximiser la rétention.

Réponds en JSON :
{
  "segments_to_keep": [
    {"start": 12.5, "end": 28.3, "reason": "Hook fort + révélation", "intensity": 9},
    {"start": 45.1, "end": 67.8, "reason": "Point principal + émotion", "intensity": 7}
  ],
  "suggested_order": [0, 1],
  "climax_timestamp": 45.1,
  "estimated_retention_score": 78,
  "cut_reasons": [
    {"start": 0, "end": 12.5, "why_cut": "Intro molle sans valeur immédiate"},
    {"start": 28.3, "end": 45.1, "why_cut": "Répétition et tangente hors-sujet"}
  ]
}

Transcription :
${transcript}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Retention Editor')

  return parseClaudeJson<RetentionEditorResult>(content.text, 'Retention Editor')
}
