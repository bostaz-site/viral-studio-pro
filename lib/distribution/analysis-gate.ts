// ═════════════════════════════════════════════════════════════════════════════
// Analysis Gate — P5 · 4-criteria autofarm eligibility (2026-09)
//
// Rule: a clip whose 4 criteria (unexpected / emotion / informative / density)
// are ALL < 4 is NOT eligible for auto-publish, regardless of velocity_score.
// Manual publish stays allowed — this only guards the autofarm executor
// (app/api/cron/publish-scheduled/route.ts, next to the transform_score gate).
//
// Read path (in order):
//   1. render_jobs.contract  → entry { feature: 'analysis_criteria', meta: {...} } (written by the VPS)
//   2. render_jobs.render_settings.analysis_criteria (written by POST /api/render)
// No analysis found → gate does not apply (eligible).
// ═════════════════════════════════════════════════════════════════════════════

import {
  evaluateCriteriaGate,
  parseClipCriteria,
  type ClipCriteria,
} from '@/lib/enhance/clip-criteria'

interface ContractEntryLike {
  feature?: unknown
  meta?: unknown
}

/**
 * Extract the 4-criteria grid from a render_jobs row (contract first, render_settings fallback).
 */
export function extractRenderJobCriteria(job: {
  contract?: unknown
  render_settings?: unknown
} | null | undefined): ClipCriteria | null {
  if (!job) return null

  if (Array.isArray(job.contract)) {
    const entry = (job.contract as ContractEntryLike[]).find((e) => e && e.feature === 'analysis_criteria')
    const fromContract = parseClipCriteria(entry?.meta)
    if (fromContract) return fromContract
  }

  if (job.render_settings && typeof job.render_settings === 'object') {
    const rs = job.render_settings as { analysis_criteria?: unknown }
    const fromSettings = parseClipCriteria(rs.analysis_criteria)
    if (fromSettings) return fromSettings
  }

  return null
}

export interface AnalysisGateResult {
  eligible: boolean
  /** Machine-readable code for results/logs. */
  code: 'no_analysis' | 'ok' | 'analysis_criteria_too_low'
  /** Human-readable reason (stored in scheduled_publications.error_message when blocked). */
  reason: string | null
  criteria: ClipCriteria | null
}

/**
 * Autofarm quality gate on the 4-criteria grid.
 */
export function checkAnalysisGate(job: {
  contract?: unknown
  render_settings?: unknown
} | null | undefined): AnalysisGateResult {
  const criteria = extractRenderJobCriteria(job)
  if (!criteria) return { eligible: true, code: 'no_analysis', reason: null, criteria: null }
  const verdict = evaluateCriteriaGate(criteria)
  if (verdict.eligible) return { eligible: true, code: 'ok', reason: null, criteria }
  return { eligible: false, code: 'analysis_criteria_too_low', reason: verdict.reason, criteria }
}
