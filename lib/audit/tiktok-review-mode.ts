/**
 * TikTok Review Mode — pauses auto-fix execution during API review window.
 * Set TIKTOK_REVIEW_MODE=true in env to activate.
 */

export function isTikTokReviewMode(): boolean {
  return process.env.TIKTOK_REVIEW_MODE === 'true'
}

/**
 * Check if a finding qualifies for emergency override during TikTok review.
 * Only security/data-loss critical findings can bypass the review hold.
 */
export function canOverrideTikTokReview(finding: {
  severity: string
  title: string
  description: string
}): boolean {
  if (finding.severity !== 'critical') return false

  const text = `${finding.title} ${finding.description}`.toLowerCase()
  const overrideKeywords = [
    'security', 'xss', 'injection', 'csrf', 'auth bypass',
    'data loss', 'data leak', 'credential', 'exposed secret',
    'unauthorized access', 'privilege escalation',
  ]

  return overrideKeywords.some((kw) => text.includes(kw))
}
