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
  // Metadata (not template vars, but used by generate route)
  _is_recent_topic_fallback: boolean
  _is_compliment_fallback: boolean
  _ai_recommended_offer_angle: string | null
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

/**
 * Clean a video title for use in email copy.
 * Strips excessive emojis, truncates to 60 chars.
 */
function cleanVideoTitle(title: string): string {
  // Remove runs of 3+ emojis but keep 1-2
  const cleaned = title
    .replace(/([\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*){3,}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length <= 60) return cleaned
  return cleaned.slice(0, 57).replace(/\s+\S*$/, '') + '...'
}

/**
 * Get promoted product names for an influencer from the distributor graph.
 * Returns "OpusClip and Submagic" or "clipping tools" as fallback.
 */
async function getPromotedApps(influencerId: string): Promise<string> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('promoted_products')
    .select('product_name')
    .eq('influencer_id', influencerId)
    .limit(3)

  if (!data?.length) return 'clipping tools'

  const names = data.map((p: { product_name: string }) => p.product_name)
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names[0]}, ${names[1]}, and ${names[2]}`
}

export async function extractVariables(influencerId: string): Promise<OfferVariables> {
  const admin = createAdminClient()
  // Cast needed: recent_video_titles and ai_specific_compliment not in generated types yet
  const { data: inf } = await admin.from('influencers').select('*').eq('id', influencerId).single() as {
    data: Record<string, unknown> | null
  }
  if (!inf) throw new Error(`Influencer ${influencerId} not found`)

  const s = (key: string): string => (inf[key] as string) ?? ''
  const n = (key: string): number | null => (inf[key] as number) ?? null
  const handle = s('platform_handle') || s('affiliate_code') || s('email').split('@')[0] || 'creator'

  // recent_topic: real video title or niche fallback
  const videoTitles = (inf.recent_video_titles as string[] | null) ?? []
  let recentTopic: string
  let isRecentTopicFallback = true
  if (videoTitles.length > 0) {
    recentTopic = cleanVideoTitle(videoTitles[0])
    isRecentTopicFallback = false
  } else {
    recentTopic = s('niche') || 'content creation'
  }

  // specific_compliment: AI-generated or built from recent_topic
  let specificCompliment: string
  let isComplimentFallback = true
  if (s('ai_specific_compliment')) {
    specificCompliment = s('ai_specific_compliment')
    isComplimentFallback = false
  } else if (!isRecentTopicFallback) {
    specificCompliment = `your recent video on ${recentTopic} caught my eye`
    isComplimentFallback = true
  } else {
    specificCompliment = `your ${s('niche') || 'content creation'} content stands out`
  }

  // promoted_apps: real data from distributor graph
  const promotedApps = await getPromotedApps(influencerId)
  const niche = s('niche') || 'content creation'

  return {
    first_name: s('first_name') || s('display_name') || handle,
    full_name: [s('first_name'), s('last_name')].filter(Boolean).join(' ') || s('display_name') || handle,
    handle,
    platform: s('primary_platform') || 'social',
    follower_count_formatted: formatFollowers(n('audience_size')),
    niche,
    recent_topic: recentTopic,
    specific_compliment: specificCompliment,
    promoted_apps: promotedApps,
    repost_kit_url: `${APP_URL}/partner/repost/${handle}`,
    commission_rate: '30%',
    projected_monthly_earning: projectMonthlyEarning(n('audience_size')),
    affiliate_code: s('affiliate_code'),
    signup_link: 'https://viralanimal.com/signup',
    calendly: 'https://calendly.com/viralanimal/demo',
    link: APP_URL,
    company: 'Viral Animal',
    _is_recent_topic_fallback: isRecentTopicFallback,
    _is_compliment_fallback: isComplimentFallback,
    _ai_recommended_offer_angle: s('ai_recommendation') || null,
  }
}
