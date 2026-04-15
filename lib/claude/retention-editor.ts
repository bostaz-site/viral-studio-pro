import { createAnthropicClient, CLAUDE_MODEL, parseClaudeJson } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SegmentToKeep {
  start: number
  end: number
  reason: string
  title: string      // unique viral hook title for this segment
  intensity: number  // 1-10, emotional intensity of segment
  retention_score: number  // 0-100, unique retention score for this segment
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

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_SEGMENT_SECONDS = 15
const MAX_SEGMENT_SECONDS = 90
const IDEAL_MIN_SECONDS = 30
const IDEAL_MAX_SECONDS = 60
const MIN_TRANSCRIPT_CHARS = 50
const MAX_TRANSCRIPT_CHARS = 15_000
const MAX_TITLE_WORDS = 10

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un expert en montage vidéo viral spécialisé en clips courts (TikTok, Reels, Shorts). Tu analyses comme OpusClip : tu identifies TOUS les moments forts et tu génères le MAXIMUM de clips autonomes.

## MISSION

Extraire le maximum de clips viraux d'une transcription. Chaque clip = un moment fort autonome.

## RÈGLES ABSOLUES

1. DURÉE : Chaque segment doit faire entre ${MIN_SEGMENT_SECONDS} et ${MAX_SEGMENT_SECONDS} secondes. La durée IDÉALE est ${IDEAL_MIN_SECONDS}-${IDEAL_MAX_SECONDS} secondes.
2. QUANTITÉ : Génère autant de segments que possible. Pour une vidéo de 5 min → 3-5 clips. Pour 10 min → 5-8 clips. Pour 20+ min → 8-12 clips.
3. AUTONOMIE : Chaque segment DOIT raconter une histoire complète — début + milieu + fin. Le spectateur ne doit PAS avoir besoin de contexte.
4. HOOK : Chaque segment DOIT commencer par un moment fort (révélation, question, choc, promesse). JAMAIS par une intro molle.
5. INTENSITY : Note l'intensité émotionnelle de 1-10 pour chaque segment (hook puissant = 8+, info intéressante = 5-7, remplissage = 1-4).
6. TITRE : Donne un titre UNIQUE et accrocheur pour chaque segment (max ${MAX_TITLE_WORDS} mots, style hook viral).
7. CHEVAUCHEMENT : Les segments ne doivent PAS se chevaucher. Chaque seconde de la vidéo ne peut être dans qu'un seul segment maximum.
8. COUPER LE GRAS : Élimine les intros, outros, tangentes, répétitions, pauses longues. Garde UNIQUEMENT la substance.
9. TIMESTAMPS : start et end doivent être des nombres positifs. start < end. end ne doit pas dépasser la durée totale de la vidéo.
10. SCORING : Estime un score de rétention UNIQUE pour chaque segment (pas le même pour tous). Varie les scores de façon réaliste.

## FORMAT DE RÉPONSE

Retourne UNIQUEMENT du JSON valide sans markdown ni backticks.`

// ── Validation ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFiniteNumber(val: unknown, fallback: number): number {
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

function truncateTitle(title: string): string {
  const words = title.trim().split(/\s+/)
  if (words.length <= MAX_TITLE_WORDS) return title.trim()
  return words.slice(0, MAX_TITLE_WORDS).join(' ') + '…'
}

function resolveOverlaps(segments: SegmentToKeep[]): SegmentToKeep[] {
  if (segments.length <= 1) return segments

  // Sort by start time
  const sorted = [...segments].sort((a, b) => a.start - b.start)
  const resolved: SegmentToKeep[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = resolved[resolved.length - 1]
    const curr = sorted[i]

    if (curr.start < prev.end) {
      // Overlap detected — keep the one with higher retention_score, trim the other
      if (curr.retention_score > prev.retention_score) {
        prev.end = curr.start // Trim previous segment
        if (prev.end - prev.start >= MIN_SEGMENT_SECONDS) {
          resolved.push(curr)
        } else {
          // Previous segment too short after trim — replace it
          resolved[resolved.length - 1] = curr
        }
      } else {
        // Trim current segment's start
        curr.start = prev.end
        if (curr.end - curr.start >= MIN_SEGMENT_SECONDS) {
          resolved.push(curr)
        }
        // Otherwise drop the current segment entirely
      }
    } else {
      resolved.push(curr)
    }
  }

  return resolved
}

function validateAndCleanResult(
  raw: RetentionEditorResult,
  videoDurationSeconds: number
): RetentionEditorResult {
  // ── Validate segments ──
  if (!raw?.segments_to_keep || !Array.isArray(raw.segments_to_keep) || raw.segments_to_keep.length === 0) {
    throw new Error('Retention Editor returned no segments')
  }

  const seenTitles = new Set<string>()
  const cleaned: SegmentToKeep[] = []

  for (const seg of raw.segments_to_keep) {
    if (!seg || typeof seg !== 'object') continue

    let start = toFiniteNumber(seg.start, -1)
    let end = toFiniteNumber(seg.end, -1)

    // Skip invalid timestamps
    if (start < 0 || end < 0 || start >= end) continue

    // Clamp to video bounds
    start = clamp(start, 0, videoDurationSeconds)
    end = clamp(end, 0, videoDurationSeconds)
    if (start >= end) continue

    const duration = end - start
    // Skip segments that are way too short (hard floor)
    if (duration < MIN_SEGMENT_SECONDS) continue

    // Soft-cap very long segments (warn but still keep)
    if (duration > MAX_SEGMENT_SECONDS * 1.5) {
      end = start + MAX_SEGMENT_SECONDS
    }

    // Title: ensure present, unique, truncated
    let title = typeof seg.title === 'string' && seg.title.trim().length > 0
      ? truncateTitle(seg.title)
      : `Clip ${cleaned.length + 1}`
    const titleLower = title.toLowerCase()
    if (seenTitles.has(titleLower)) {
      title = `${title} (${cleaned.length + 1})`
    }
    seenTitles.add(titleLower)

    cleaned.push({
      start: Math.round(start * 10) / 10,
      end: Math.round(end * 10) / 10,
      reason: typeof seg.reason === 'string' && seg.reason.trim().length > 0
        ? seg.reason.trim()
        : 'Segment identifié par analyse de rétention',
      title,
      intensity: clamp(Math.round(toFiniteNumber(seg.intensity, 5)), 1, 10),
      retention_score: clamp(Math.round(toFiniteNumber(seg.retention_score, 60)), 0, 100),
    })
  }

  if (cleaned.length === 0) {
    throw new Error('Retention Editor: all segments were invalid after validation')
  }

  // Resolve overlapping segments
  const resolved = resolveOverlaps(cleaned)

  // ── Validate suggested_order ──
  let suggestedOrder: number[] = []
  if (Array.isArray(raw.suggested_order)) {
    suggestedOrder = raw.suggested_order
      .map(Number)
      .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < resolved.length)
    // Deduplicate while preserving order
    suggestedOrder = [...new Set(suggestedOrder)]
  }
  // Fallback: if order is incomplete, use natural order for missing indices
  if (suggestedOrder.length !== resolved.length) {
    const present = new Set(suggestedOrder)
    for (let i = 0; i < resolved.length; i++) {
      if (!present.has(i)) suggestedOrder.push(i)
    }
  }

  // ── Validate climax_timestamp ──
  let climaxTimestamp = toFiniteNumber(raw.climax_timestamp, -1)
  if (climaxTimestamp < 0 || climaxTimestamp > videoDurationSeconds) {
    // Default to the start of the highest-scored segment
    const best = resolved.reduce((a, b) => b.retention_score > a.retention_score ? b : a)
    climaxTimestamp = best.start
  }

  // ── Validate estimated_retention_score ──
  const estimatedRetentionScore = clamp(
    Math.round(toFiniteNumber(raw.estimated_retention_score, 60)),
    0,
    100
  )

  // ── Validate cut_reasons ──
  let cutReasons: CutReason[] = []
  if (Array.isArray(raw.cut_reasons)) {
    for (const cr of raw.cut_reasons) {
      if (!cr || typeof cr !== 'object') continue
      const crStart = toFiniteNumber(cr.start, -1)
      const crEnd = toFiniteNumber(cr.end, -1)
      if (crStart < 0 || crEnd <= crStart || crEnd > videoDurationSeconds) continue
      cutReasons.push({
        start: Math.round(crStart * 10) / 10,
        end: Math.round(crEnd * 10) / 10,
        why_cut: typeof cr.why_cut === 'string' && cr.why_cut.trim().length > 0
          ? cr.why_cut.trim()
          : 'Segment coupé',
      })
    }
  }
  // Sort cut_reasons by start time
  cutReasons = cutReasons.sort((a, b) => a.start - b.start)

  return {
    segments_to_keep: resolved,
    suggested_order: suggestedOrder,
    climax_timestamp: Math.round(climaxTimestamp * 10) / 10,
    estimated_retention_score: estimatedRetentionScore,
    cut_reasons: cutReasons,
  }
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runRetentionEditor(
  transcript: string,
  videoDurationSeconds: number
): Promise<RetentionEditorResult> {
  if (!transcript || transcript.trim().length < MIN_TRANSCRIPT_CHARS) {
    throw new Error(`Transcription trop courte pour l'analyse de rétention (min ${MIN_TRANSCRIPT_CHARS} caractères)`)
  }

  if (!Number.isFinite(videoDurationSeconds) || videoDurationSeconds <= 0) {
    throw new Error('Durée de la vidéo invalide')
  }

  // Truncate very long transcripts to stay within context limits
  const trimmedTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[... transcription tronquée]'
    : transcript

  const expectedClips = Math.max(2, Math.min(12, Math.floor(videoDurationSeconds / 45)))

  const anthropic = createAnthropicClient()

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analyse cette transcription (durée source : ${videoDurationSeconds}s) et identifie TOUS les segments à garder pour maximiser les clips viraux.

Nombre de clips attendu : ~${expectedClips} clips.

Réponds en JSON :
{
  "segments_to_keep": [
    {"start": 5.0, "end": 52.3, "reason": "Hook fort + révélation principale", "title": "Ce que personne ne te dit sur...", "intensity": 9, "retention_score": 85},
    {"start": 60.1, "end": 115.8, "reason": "Transformation émotionnelle", "title": "J'ai failli tout abandonner", "intensity": 7, "retention_score": 72},
    {"start": 130.0, "end": 188.5, "reason": "Point clé avec preuve", "title": "La technique qui change tout", "intensity": 8, "retention_score": 78}
  ],
  "suggested_order": [0, 2, 1],
  "climax_timestamp": 45.1,
  "estimated_retention_score": 78,
  "cut_reasons": [
    {"start": 0, "end": 5.0, "why_cut": "Intro molle sans valeur immédiate"},
    {"start": 52.3, "end": 60.1, "why_cut": "Transition vide"}
  ]
}

IMPORTANT : Chaque segment a son propre title (hook unique, max ${MAX_TITLE_WORDS} mots) et retention_score (score unique basé sur la qualité du contenu de CE segment). Les timestamps start/end doivent être dans [0, ${videoDurationSeconds}].

Transcription :
${trimmedTranscript}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Retention Editor')

  const parsed = parseClaudeJson<RetentionEditorResult>(content.text, 'Retention Editor')
  return validateAndCleanResult(parsed, videoDurationSeconds)
}
