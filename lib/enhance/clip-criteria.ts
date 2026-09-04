// ═════════════════════════════════════════════════════════════════════════════
// Clip Criteria — the 4-criteria grid (P5 · 2026-09)
//
// Observed among paid clippers (Monster Lab, 6-figure monthly payouts — see
// RECHERCHE-ALGO-VIRALITE-2026.md Partie 6): a clip is worth editing when it has
//   (1) an unexpected event / plot twist            → unexpected
//   (2) strong emotion or relatability → shares      → emotion
//   (3) new / useful info, referenceable moment      → informative (saves)
//   (4) tight density, no dead air                   → density
//
// Pure helpers — no React, no Supabase, no Node APIs. Shared by:
//   - lib/ai/mood-detector.ts        (parse Claude output)
//   - lib/enhance/scoring.ts         (blend into the Blowup Chance baseline)
//   - components/enhance/*           (4 bars + "why")
//   - lib/distribution/analysis-gate (autofarm eligibility)
// ═════════════════════════════════════════════════════════════════════════════

export type CriterionKey = 'unexpected' | 'emotion' | 'informative' | 'density'

export const CRITERION_KEYS: CriterionKey[] = ['unexpected', 'emotion', 'informative', 'density']

/** 4 criteria, each 0-10. */
export interface ClipCriteria {
  unexpected: number
  emotion: number
  informative: number
  density: number
}

export interface DeadAirSegment {
  start: number
  end: number
}

export type ClipVerdict = 'strong' | 'ok' | 'weak'

/** Existing hook taxonomy (hook-generator / offer-generator), mapped onto the 4 axes. */
export type HookType = 'shock' | 'storytelling' | 'curiosity' | 'transformation'

/** Full analysis payload returned by the AI (and persisted with the render). */
export interface ClipAnalysis extends ClipCriteria {
  dead_air_segments: DeadAirSegment[]
  verdict: ClipVerdict
  /** One sentence — UI language (EN). */
  why: string
  /** Dominant hook type derived from the criteria (choc→unexpected, storytelling→emotion, ...). */
  hook_type_mapping: HookType
}

// ─── Weights (30 / 30 / 20 / 20) ────────────────────────────────────────────

export const CRITERIA_WEIGHTS: Record<CriterionKey, number> = {
  unexpected: 0.30,
  emotion: 0.30,
  informative: 0.20,
  density: 0.20,
}

/**
 * Hook taxonomy → criteria axes.
 *   choc (shock)      → unexpected
 *   storytelling      → emotion
 *   curiosité         → informative
 *   transformation    → emotion + informative
 */
export const HOOK_TYPE_TO_CRITERIA: Record<HookType, CriterionKey[]> = {
  shock: ['unexpected'],
  storytelling: ['emotion'],
  curiosity: ['informative'],
  transformation: ['emotion', 'informative'],
}

/** UI labels (English — matches the rest of the Enhance copy). */
export const CRITERION_LABELS: Record<CriterionKey, { label: string; hint: string }> = {
  unexpected: { label: 'Unexpected', hint: 'Plot twist / surprise' },
  emotion: { label: 'Emotion', hint: 'Intensity → shares' },
  informative: { label: 'Info', hint: 'Referenceable → saves' },
  density: { label: 'Density', hint: 'No dead air' },
}

/** Autofarm gate: a clip with ALL 4 criteria below this is never auto-published. */
export const AUTOFARM_MIN_CRITERION = 4

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp10(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10))
}

/**
 * Weighted 4-criteria score, 0-100.
 * 30% unexpected / 30% emotion / 20% informative / 20% density.
 */
export function computeCriteriaScore(c: ClipCriteria): number {
  const raw =
    c.unexpected * CRITERIA_WEIGHTS.unexpected +
    c.emotion * CRITERIA_WEIGHTS.emotion +
    c.informative * CRITERIA_WEIGHTS.informative +
    c.density * CRITERIA_WEIGHTS.density
  // raw is 0-10 → scale to 0-100
  return Math.round(Math.max(0, Math.min(100, raw * 10)))
}

/** Verdict from the weighted score when the model didn't return a usable one. */
export function verdictFromScore(score100: number): ClipVerdict {
  if (score100 >= 65) return 'strong'
  if (score100 >= 40) return 'ok'
  return 'weak'
}

/**
 * Dominant hook type derived from the criteria (used when the model omits it).
 * transformation wins when emotion AND informative are both high and close.
 */
export function deriveHookType(c: ClipCriteria): HookType {
  if (c.emotion >= 6 && c.informative >= 6 && Math.abs(c.emotion - c.informative) <= 2) return 'transformation'
  const top: [HookType, number][] = [
    ['shock', c.unexpected],
    ['storytelling', c.emotion],
    ['curiosity', c.informative],
  ]
  top.sort((a, b) => b[1] - a[1])
  return top[0][0]
}

/**
 * Autofarm eligibility rule (P5): ALL 4 criteria < AUTOFARM_MIN_CRITERION → not eligible,
 * regardless of velocity_score. Manual publish stays allowed.
 */
export function evaluateCriteriaGate(c: ClipCriteria | null | undefined): { eligible: boolean; reason: string | null } {
  if (!c) return { eligible: true, reason: null } // no analysis → gate does not apply
  const allWeak = CRITERION_KEYS.every((k) => c[k] < AUTOFARM_MIN_CRITERION)
  if (!allWeak) return { eligible: true, reason: null }
  return {
    eligible: false,
    reason: `analysis_criteria all < ${AUTOFARM_MIN_CRITERION} (unexpected=${c.unexpected} emotion=${c.emotion} informative=${c.informative} density=${c.density}) — not eligible for auto-publish`,
  }
}

/**
 * Parse an untrusted object (Claude JSON, DB JSONB, request body) into ClipCriteria.
 * Returns null when any of the 4 scores is missing / non-numeric.
 */
export function parseClipCriteria(raw: unknown): ClipCriteria | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const unexpected = clamp10(o.unexpected)
  const emotion = clamp10(o.emotion)
  const informative = clamp10(o.informative)
  const density = clamp10(o.density)
  if (unexpected === null || emotion === null || informative === null || density === null) return null
  return { unexpected, emotion, informative, density }
}

/**
 * Parse the full analysis payload. Fills verdict / hook_type_mapping / why when missing.
 * dead_air_segments are sanitized (finite, start < end, capped at 20).
 */
export function parseClipAnalysis(raw: unknown, opts: { maxDuration?: number } = {}): ClipAnalysis | null {
  const criteria = parseClipCriteria(raw)
  if (!criteria) return null
  const o = raw as Record<string, unknown>
  const maxDur = opts.maxDuration && opts.maxDuration > 0 ? opts.maxDuration : Infinity

  const segs: DeadAirSegment[] = []
  if (Array.isArray(o.dead_air_segments)) {
    for (const s of o.dead_air_segments) {
      if (!s || typeof s !== 'object') continue
      const start = Number((s as Record<string, unknown>).start)
      const end = Number((s as Record<string, unknown>).end)
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue
      if (start < 0 || end <= start || start >= maxDur) continue
      segs.push({ start: Math.round(start * 100) / 100, end: Math.round(Math.min(end, maxDur) * 100) / 100 })
      if (segs.length >= 20) break
    }
  }

  const score = computeCriteriaScore(criteria)
  const verdict: ClipVerdict =
    o.verdict === 'strong' || o.verdict === 'ok' || o.verdict === 'weak' ? o.verdict : verdictFromScore(score)
  const hookRaw = o.hook_type_mapping
  const hook_type_mapping: HookType =
    hookRaw === 'shock' || hookRaw === 'storytelling' || hookRaw === 'curiosity' || hookRaw === 'transformation'
      ? hookRaw
      : deriveHookType(criteria)
  const why = typeof o.why === 'string' && o.why.trim().length > 0
    ? o.why.trim().slice(0, 180)
    : defaultWhy(criteria, verdict)

  return { ...criteria, dead_air_segments: segs, verdict, why, hook_type_mapping }
}

function defaultWhy(c: ClipCriteria, verdict: ClipVerdict): string {
  const best = CRITERION_KEYS.slice().sort((a, b) => c[b] - c[a])[0]
  const label = CRITERION_LABELS[best].label.toLowerCase()
  if (verdict === 'strong') return `Strong ${label} signal — this is the kind of moment that gets shared.`
  if (verdict === 'ok') return `Decent ${label}, but the clip needs tight editing to carry.`
  return 'Low on every criterion — hard to make this one travel.'
}
