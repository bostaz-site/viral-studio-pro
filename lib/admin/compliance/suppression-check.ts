import { createAdminClient } from '@/lib/supabase/admin'

interface SuppressionResult {
  suppressed: boolean
  reason?: string
  matchType?: 'email' | 'domain' | 'handle' | 'profile_url'
}

/**
 * 4-way suppression check via Postgres function.
 * Checks: email, email_domain, platform_handle+platform, profile_url.
 */
export async function isSuppressed4Way(params: {
  email?: string | null
  handle?: string | null
  profileUrl?: string | null
  platform?: string | null
}): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await (admin as any).rpc('is_suppressed_4way', {
    p_email: params.email ?? null,
    p_handle: params.handle ?? null,
    p_profile_url: params.profileUrl ?? null,
    p_platform: params.platform ?? null,
  })
  return data === true
}

/**
 * Batch 4-way suppression filter for import flows.
 * Returns which contacts are suppressed and why.
 */
export async function filterSuppressed4Way(
  contacts: Array<{
    email?: string | null
    handle?: string | null
    platform?: string | null
    profileUrl?: string | null
  }>
): Promise<{
  allowed: number[]
  suppressed: Array<{ index: number; reason: string }>
}> {
  if (contacts.length === 0) return { allowed: [], suppressed: [] }

  const admin = createAdminClient()

  // Collect all dimensions for batch query
  const emails = contacts.map(c => c.email?.toLowerCase()).filter(Boolean) as string[]
  const domains = [...new Set(emails.map(e => e.split('@')[1]).filter(Boolean))]
  const handles = contacts
    .filter(c => c.handle && c.platform)
    .map(c => ({ handle: c.handle!.toLowerCase(), platform: c.platform! }))
  const profileUrls = contacts.map(c => c.profileUrl).filter(Boolean) as string[]

  // Query all matching suppressions
  const suppressedEmails = new Set<string>()
  const suppressedDomains = new Set<string>()
  const suppressedHandles = new Set<string>()
  const suppressedUrls = new Set<string>()

  if (emails.length > 0) {
    const { data } = await admin
      .from('suppression_list')
      .select('email')
      .not('email', 'is', null)
      .in('email', emails)
    for (const row of data || []) {
      if (row.email) suppressedEmails.add(row.email.toLowerCase())
    }
  }

  if (domains.length > 0) {
    const { data } = await admin
      .from('suppression_list')
      .select('email_domain')
      .not('email_domain', 'is', null)
      .in('email_domain', domains)
    for (const row of data || []) {
      if (row.email_domain) suppressedDomains.add(row.email_domain.toLowerCase())
    }
  }

  if (profileUrls.length > 0) {
    const { data } = await admin
      .from('suppression_list')
      .select('profile_url')
      .not('profile_url', 'is', null)
      .in('profile_url', profileUrls)
    for (const row of data || []) {
      if (row.profile_url) suppressedUrls.add(row.profile_url)
    }
  }

  // Check handles (need platform match too)
  if (handles.length > 0) {
    const handleValues = handles.map(h => h.handle)
    const { data } = await admin
      .from('suppression_list')
      .select('platform_handle, platform')
      .not('platform_handle', 'is', null)
      .in('platform_handle', handleValues)
    for (const row of data || []) {
      if (row.platform_handle && row.platform) {
        suppressedHandles.add(`${row.platform_handle.toLowerCase()}:${row.platform}`)
      }
    }
  }

  const allowed: number[] = []
  const suppressed: Array<{ index: number; reason: string }> = []

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i]
    const email = c.email?.toLowerCase()
    const domain = email?.split('@')[1]

    if (email && suppressedEmails.has(email)) {
      suppressed.push({ index: i, reason: 'email_suppressed' })
    } else if (domain && suppressedDomains.has(domain)) {
      suppressed.push({ index: i, reason: 'domain_suppressed' })
    } else if (c.handle && c.platform && suppressedHandles.has(`${c.handle.toLowerCase()}:${c.platform}`)) {
      suppressed.push({ index: i, reason: 'handle_suppressed' })
    } else if (c.profileUrl && suppressedUrls.has(c.profileUrl)) {
      suppressed.push({ index: i, reason: 'profile_url_suppressed' })
    } else {
      allowed.push(i)
    }
  }

  return { allowed, suppressed }
}
