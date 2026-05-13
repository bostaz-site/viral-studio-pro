/**
 * FTC disclosure compliance checker.
 * Validates that promotional captions include required disclosures.
 */

const DISCLOSURE_KEYWORDS = [
  '#ad',
  '#sponsored',
  '#paidpartnership',
  '#affiliate',
  'affiliate link',
  'affiliate',
  'partner',
  'use my code',
  'use code',
  'i earn',
  'sponsorship',
  'paid partnership',
  'commission',
]

/**
 * Check if a caption contains FTC-compliant disclosure.
 */
export function captionHasDisclosure(caption: string): boolean {
  const lower = caption.toLowerCase()
  return DISCLOSURE_KEYWORDS.some(kw => lower.includes(kw))
}

/**
 * Validate a caption for promo kit or affiliate distribution.
 */
export function validateCaptionForKit(caption: string): {
  valid: boolean
  reason?: string
  suggestion?: string
} {
  if (!caption || caption.trim().length === 0) {
    return {
      valid: false,
      reason: 'Caption is empty',
      suggestion: 'Add a caption with an FTC disclosure like #ad or "affiliate link"',
    }
  }

  if (!captionHasDisclosure(caption)) {
    return {
      valid: false,
      reason: 'Caption missing FTC disclosure',
      suggestion: 'Add #ad, #sponsored, or "affiliate link" to your caption',
    }
  }

  return { valid: true }
}
