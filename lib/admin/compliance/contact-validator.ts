import { isSuppressed4Way } from './suppression-check'
import { checkProvenance } from './provenance-enforcer'
import { logComplianceAction } from './audit-logger'

export interface ContactValidationResult {
  allowed: boolean
  blocks: string[]
  warnings: string[]
}

/**
 * Master contact validation function.
 * Enforces ALL compliance rules before any contact attempt.
 *
 * Rules:
 * 1. NO source_url = NO contact (except import)
 * 2. 4-way suppression check (email, domain, handle, profile_url)
 * 3. For 'send_email' intent, email must exist
 */
export async function validateContact(params: {
  email?: string | null
  handle?: string | null
  platform?: string | null
  profileUrl?: string | null
  sourceUrl?: string | null
  intent: 'import' | 'export_campaign' | 'send_email' | 'add_to_kit'
  triggeredBy?: string
}): Promise<ContactValidationResult> {
  const blocks: string[] = []
  const warnings: string[] = []

  // Rule 1: Provenance check
  const provenance = checkProvenance({
    sourceUrl: params.sourceUrl,
    intent: params.intent,
  })
  if (!provenance.allowed) {
    blocks.push(provenance.reason!)
  }

  // Rule 2: 4-way suppression check
  const suppressed = await isSuppressed4Way({
    email: params.email,
    handle: params.handle,
    profileUrl: params.profileUrl,
    platform: params.platform,
  })
  if (suppressed) {
    blocks.push('Contact is in suppression list (email, domain, handle, or profile URL)')
  }

  // Rule 3: Email required for send_email intent
  if (params.intent === 'send_email' && !params.email) {
    blocks.push('No email address — cannot send cold email')
  }

  // Log compliance action
  if (blocks.length > 0) {
    const action = blocks.some(b => b.includes('suppression'))
      ? 'contact_blocked_suppressed'
      : blocks.some(b => b.includes('source_url'))
        ? 'contact_blocked_no_source'
        : 'contact_blocked_no_email'

    void logComplianceAction({
      action,
      targetType: 'contact',
      details: {
        email: params.email ?? undefined,
        handle: params.handle ?? undefined,
        platform: params.platform ?? undefined,
        intent: params.intent,
        blocks,
      },
      triggeredBy: params.triggeredBy,
    })
  }

  return { allowed: blocks.length === 0, blocks, warnings }
}
