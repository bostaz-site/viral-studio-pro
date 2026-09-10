/**
 * Translate autofarm gate cancellation reasons into user-friendly messages.
 */

export interface GateInfo {
  label: string
  description: string
  cta: 'publish_manually' | 'pick_another' | 'edit_more' | null
  ctaLabel: string | null
}

const GATE_MAP: Record<string, GateInfo> = {
  transform_score_too_low: {
    label: 'Not enough edits',
    description: 'Source already had captions or not enough transformation to post safely. Add hook, captions, or smart zoom.',
    cta: 'edit_more',
    ctaLabel: 'Edit clip',
  },
  render_degraded: {
    label: 'Render incomplete',
    description: 'Some features failed during render. Re-render for a clean output.',
    cta: 'edit_more',
    ctaLabel: 'Re-render',
  },
  analysis_criteria_too_low: {
    label: 'Clip too weak',
    description: 'The clip scored low on all 4 quality criteria. Pick a more engaging clip.',
    cta: 'pick_another',
    ctaLabel: 'Pick another clip',
  },
  already_edited: {
    label: 'Already edited source',
    description: 'This clip appears to be someone else\'s TikTok (vertical + burned captions). High risk of "unoriginal content" flag.',
    cta: 'pick_another',
    ctaLabel: 'Pick another clip',
  },
  content_risk_blocked: {
    label: 'Content risk',
    description: 'This clip contains restricted content (gambling, violence, or mature). Auto-publish is blocked.',
    cta: 'publish_manually',
    ctaLabel: 'Publish manually',
  },
  autofarm_paused: {
    label: 'Autofarm paused',
    description: 'Auto-publishing is temporarily paused (warmup period or account cooldown).',
    cta: null,
    ctaLabel: null,
  },
}

export function getGateInfo(errorKey: string | null): GateInfo | null {
  if (!errorKey) return null
  // Match by key or by substring in error_message
  if (GATE_MAP[errorKey]) return GATE_MAP[errorKey]
  // Try matching partial keys in the error message text
  for (const [key, info] of Object.entries(GATE_MAP)) {
    if (errorKey.includes(key)) return info
  }
  return {
    label: 'Skipped by gate',
    description: errorKey.slice(0, 200),
    cta: 'publish_manually',
    ctaLabel: 'Publish manually',
  }
}
