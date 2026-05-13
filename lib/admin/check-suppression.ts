import { createAdminClient } from '@/lib/supabase/admin'

// Re-export 4-way suppression check for new code
export { isSuppressed4Way, filterSuppressed4Way } from '@/lib/admin/compliance/suppression-check'
export { validateContact } from '@/lib/admin/compliance/contact-validator'

interface SuppressedEntry {
  email: string
  reason: string
}

interface FilterResult {
  allowed: string[]
  suppressed: SuppressedEntry[]
}

/**
 * Filter a list of emails against the suppression list.
 * Call this before every campaign export.
 */
export async function filterSuppressed(emails: string[]): Promise<FilterResult> {
  if (emails.length === 0) return { allowed: [], suppressed: [] }

  const supabase = createAdminClient()
  const lowerEmails = emails.map((e) => e.toLowerCase())

  // Get all domains from the email list
  const domains = [...new Set(lowerEmails.map((e) => e.split('@')[1]).filter(Boolean))]

  // Query suppressed emails (case insensitive via lower())
  const { data: suppressedByEmail } = await supabase
    .from('suppression_list')
    .select('email, reason')
    .not('email', 'is', null)
    .in('email', lowerEmails)

  // Query suppressed domains
  const { data: suppressedByDomain } = await supabase
    .from('suppression_list')
    .select('email_domain, reason')
    .not('email_domain', 'is', null)
    .in('email_domain', domains)

  const suppressedEmailSet = new Map<string, string>()

  // Add email-level suppressions
  for (const row of suppressedByEmail ?? []) {
    if (row.email) suppressedEmailSet.set(row.email.toLowerCase(), row.reason)
  }

  // Add domain-level suppressions
  const suppressedDomains = new Map<string, string>()
  for (const row of suppressedByDomain ?? []) {
    if (row.email_domain) suppressedDomains.set(row.email_domain.toLowerCase(), row.reason)
  }

  const allowed: string[] = []
  const suppressed: SuppressedEntry[] = []

  for (const email of lowerEmails) {
    const emailReason = suppressedEmailSet.get(email)
    if (emailReason) {
      suppressed.push({ email, reason: emailReason })
      continue
    }

    const domain = email.split('@')[1]
    const domainReason = domain ? suppressedDomains.get(domain) : undefined
    if (domainReason) {
      suppressed.push({ email, reason: domainReason })
      continue
    }

    allowed.push(email)
  }

  return { allowed, suppressed }
}

/**
 * Check if a single email is suppressed.
 */
export async function isSuppressed(email: string): Promise<boolean> {
  const { suppressed } = await filterSuppressed([email])
  return suppressed.length > 0
}
