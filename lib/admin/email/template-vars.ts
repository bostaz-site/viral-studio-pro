/**
 * Server-side template variable interpolation.
 * Replaces {{var_name}} placeholders with influencer data.
 * NEVER run this client-side — template vars must stay invisible to the UI.
 */

interface InfluencerVars {
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
  email?: string | null
  platform_handle?: string | null
  primary_platform?: string | null
  niche?: string | null
  audience_size?: number | null
  affiliate_code?: string | null
}

const STATIC_VARS: Record<string, string> = {
  signup_link: 'https://viralanimal.com/signup',
  calendly: 'https://calendly.com/viralanimal/demo',
  link: 'https://viralanimal.com',
  company: 'Viral Animal',
}

export function interpolateTemplate(
  template: string,
  influencer: InfluencerVars
): string {
  const vars: Record<string, string> = {
    ...STATIC_VARS,
    first_name: influencer.first_name || influencer.display_name || '',
    last_name: influencer.last_name || '',
    full_name: [influencer.first_name, influencer.last_name].filter(Boolean).join(' ') || influencer.display_name || '',
    email: influencer.email || '',
    handle: influencer.platform_handle || '',
    platform: influencer.primary_platform || '',
    niche: influencer.niche || '',
    audience_size: influencer.audience_size?.toLocaleString() || '',
    affiliate_code: influencer.affiliate_code || '',
  }

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return vars[key] ?? match // Leave unmatched vars as-is
  })
}

export function listAvailableVars(): { key: string; description: string }[] {
  return [
    { key: 'first_name', description: 'Influencer first name' },
    { key: 'last_name', description: 'Influencer last name' },
    { key: 'full_name', description: 'First + last name' },
    { key: 'email', description: 'Influencer email' },
    { key: 'handle', description: 'Platform handle (@...)' },
    { key: 'platform', description: 'Primary platform (twitch, etc.)' },
    { key: 'niche', description: 'Influencer niche' },
    { key: 'audience_size', description: 'Follower count' },
    { key: 'affiliate_code', description: 'Affiliate code (if set)' },
    { key: 'signup_link', description: 'Viral Animal signup URL' },
    { key: 'calendly', description: 'Calendly booking link' },
    { key: 'link', description: 'Viral Animal homepage' },
    { key: 'company', description: 'Company name' },
  ]
}
