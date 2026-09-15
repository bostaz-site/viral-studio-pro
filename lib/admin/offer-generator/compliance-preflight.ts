import { validateContact, type ContactValidationResult } from '@/lib/admin/compliance/contact-validator'
import { createAdminClient } from '@/lib/supabase/admin'

export async function compliancePreflight(influencerId: string): Promise<ContactValidationResult> {
  const admin = createAdminClient()
  const { data: inf } = await admin
    .from('influencers')
    .select('email, platform_handle, primary_platform, platform_url, source')
    .eq('id', influencerId)
    .single()

  if (!inf) return { allowed: false, blocks: ['Influencer not found'], warnings: [] }

  return validateContact({
    email: inf.email,
    handle: inf.platform_handle,
    platform: inf.primary_platform,
    profileUrl: inf.platform_url,
    sourceUrl: inf.source,
    intent: 'send_email',
  })
}

// ── Sequence-level compliance (cold-email v2) ────────────────────────────

const BANNED_PHRASES = ['limited time', 'exclusive', 'act now']
const POSTAL_MARKER = 'J1Z 0A6'
const FOOTER_SEPARATOR = '\n—\n'

export interface StepViolation {
  step: number
  violations: string[]
}

export interface SequencePreflightResult {
  pass: boolean
  steps: StepViolation[]
}

interface TemplateStep {
  step_number: number
  body_text: string
  max_words?: number
}

/**
 * Validate a sequence of email templates against cold-email v2 compliance rules.
 * Returns per-step violations. Pass = zero violations across all steps.
 */
export function sequenceCompliancePreflight(templates: TemplateStep[]): SequencePreflightResult {
  const steps: StepViolation[] = []

  for (const tpl of templates) {
    const violations: string[] = []
    const { body, footer } = splitFooter(tpl.body_text)
    const maxWords = tpl.max_words ?? 80

    // 1. Step 1: no URLs in body
    if (tpl.step_number === 1) {
      if (hasUrl(body)) {
        violations.push('Step 1 must not contain any URL or link')
      }
    }

    // 2. Word count (excluding footer)
    const wordCount = countWords(body)
    if (wordCount > maxWords) {
      violations.push(`Body has ${wordCount} words, exceeds max ${maxWords}`)
    }

    // 3. Footer must contain postal address
    if (!footer.includes(POSTAL_MARKER)) {
      violations.push(`Footer missing postal address (expected ${POSTAL_MARKER})`)
    }

    // 4. Footer must contain {{unsubscribeLink}}
    if (!footer.includes('{{unsubscribeLink}}') && !footer.includes('unsubscribeLink')) {
      violations.push('Footer missing {{unsubscribeLink}}')
    }

    // 5. Banned phrases
    const bodyLower = body.toLowerCase()
    for (const phrase of BANNED_PHRASES) {
      if (bodyLower.includes(phrase)) {
        violations.push(`Banned phrase: "${phrase}"`)
      }
    }

    // 6. Triple exclamation marks
    if (body.includes('!!!') || body.includes('!! ') || (body.match(/!/g) || []).length > 2) {
      // Check for 3+ exclamation marks anywhere
      if ((body.match(/!/g) || []).length >= 3) {
        violations.push('Too many exclamation marks (max 2)')
      }
    }

    // 7. ALL-CAPS words (length > 3 characters, excluding template variables)
    const capsWords = body
      .replace(/\{\{[^}]+\}\}/g, '') // remove template variables
      .replace(/\{[^}]+\}/g, '')     // remove spintax
      .split(/\s+/)
      .filter(w => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w))

    if (capsWords.length > 0) {
      violations.push(`ALL-CAPS words found: ${capsWords.join(', ')}`)
    }

    steps.push({ step: tpl.step_number, violations })
  }

  return {
    pass: steps.every(s => s.violations.length === 0),
    steps,
  }
}

function splitFooter(bodyText: string): { body: string; footer: string } {
  const idx = bodyText.lastIndexOf(FOOTER_SEPARATOR)
  if (idx === -1) {
    return { body: bodyText, footer: '' }
  }
  return {
    body: bodyText.slice(0, idx),
    footer: bodyText.slice(idx),
  }
}

function countWords(text: string): number {
  // Remove template variables and spintax, then count whitespace-separated tokens
  const cleaned = text
    .replace(/\{\{[^}]+\}\}/g, 'X')   // count each variable as 1 word
    .replace(/\{([^}]+)\}/g, (_m, content: string) => {
      // For spintax {a|b|c}, use the longest variant for word counting
      const variants = content.split('|')
      const longest = variants.reduce((a: string, b: string) => a.length > b.length ? a : b, '')
      return longest
    })
    .trim()

  if (!cleaned) return 0
  return cleaned.split(/\s+/).filter(w => w.length > 0).length
}

function hasUrl(text: string): boolean {
  // Check for actual URLs or URL template variables (excluding unsubscribeLink which is in footer)
  if (/https?:\/\//i.test(text)) return true
  if (/\{\{[^}]*[Uu]rl[^}]*\}\}/.test(text)) return true
  return false
}
