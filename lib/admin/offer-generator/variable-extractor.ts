import { createAdminClient } from '@/lib/supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'
const COMMISSION_RATE = 0.30
const AVG_ARPA_USD = 24

export interface OfferVariables {
  first_name: string
  full_name: string
  handle: string
  platform: string
  follower_count_formatted: string
  niche: string
  recent_topic: string
  specific_compliment: string
  promoted_apps: string
  repost_kit_url: string
  commission_rate: string
  projected_monthly_earning: string
  affiliate_code: string
  signup_link: string
  calendly: string
  link: string
  company: string
}

function formatFollowers(n: number | null): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

function projectMonthlyEarning(audienceSize: number | null): string {
  const views = audienceSize || 5000
  const signups = views * 0.002
  const monthly = signups * AVG_ARPA_USD * COMMISSION_RATE
  if (monthly < 10) return '$5-20'
  if (monthly < 50) return `$${Math.round(monthly * 0.5)}-${Math.round(monthly * 1.5)}`
  return `$${Math.round(monthly * 0.7)}-${Math.round(monthly * 1.3)}`
}

export async function extractVariables(influencerId: string): Promise<OfferVariables> {
  const admin = createAdminClient()
  const { data: inf } = await admin.from('influencers').select('*').eq('id', influencerId).single()
  if (!inf) throw new Error(`Influencer ${influencerId} not found`)

  const handle = inf.platform_handle || inf.affiliate_code || inf.email?.split('@')[0] || 'creator'

  return {
    first_name: inf.first_name || inf.display_name || handle,
    full_name: [inf.first_name, inf.last_name].filter(Boolean).join(' ') || inf.display_name || handle,
    handle,
    platform: inf.primary_platform || 'social',
    follower_count_formatted: formatFollowers(inf.audience_size),
    niche: inf.niche || 'content creation',
    recent_topic: inf.niche || 'content',
    specific_compliment: 'really solid content',
    promoted_apps: 'similar tools',
    repost_kit_url: `${APP_URL}/partner/repost/${handle}`,
    commission_rate: '30%',
    projected_monthly_earning: projectMonthlyEarning(inf.audience_size),
    affiliate_code: inf.affiliate_code || '',
    signup_link: 'https://viralanimal.com/signup',
    calendly: 'https://calendly.com/viralanimal/demo',
    link: APP_URL,
    company: 'Viral Animal',
  }
}
