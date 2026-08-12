import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createKitSession } from '@/lib/partner/repost-kit/session'
import { projectCommission } from '@/lib/partner/repost-kit/projected-commission'
import { RepostKitClient } from './_components/repost-kit-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  return {
    title: `Repost Kit — ${handle} | Viral Animal`,
    description: 'Your pre-made repost kit. Download, copy, post — earn 30% recurring commission.',
  }
}

// Default caption template
function buildCaption(niche: string | null): string {
  const nicheHooks: Record<string, string> = {
    gaming: 'This clip editing tool is insane for streamers',
    fps: 'Auto captions + AI scoring for your clips? Yes please',
    irl: 'Make your IRL clips go viral in 45 seconds',
    entertainment: 'Turn any clip into a viral short',
    variety: 'This tool makes clipping so easy it should be illegal',
  }
  const hook = nicheHooks[(niche || '').toLowerCase()] ?? 'Make your clips go viral in 45 seconds'
  return `${hook}\n\nViral Animal does karaoke captions, hook text, and AI viral scoring — all automatic.`
}

function buildHashtags(niche: string | null): string {
  const base = '#viralanimal #contentcreator #clipping #viral #shorts'
  const nicheMap: Record<string, string> = {
    gaming: '#gaming #streamer #twitch #clips #gamingclips',
    fps: '#fps #valorant #csgo #gaming #esports',
    irl: '#irl #streaming #justchatting #streamer',
    entertainment: '#entertainment #content #creator #funny',
  }
  const extra = nicheMap[(niche || '').toLowerCase()] ?? '#creator #content'
  return `${base} ${extra}`
}

export default async function RepostKitPage({ params, searchParams }: {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ c?: string }>
}) {
  const { handle } = await params
  const { c: campaignId } = await searchParams

  const admin = createAdminClient()

  // Validate handle: strict alphanumeric + dots/underscores/hyphens only (prevent PostgREST injection)
  if (!/^[a-zA-Z0-9_.\-]{1,50}$/.test(handle)) {
    notFound()
  }

  // Lookup influencer by platform_handle or affiliate_code (separate queries, no .or() interpolation)
  let influencer: { id: string; first_name: string | null; display_name: string | null; email: string | null; platform_handle: string | null; affiliate_code: string | null; audience_size: number | null; niche: string | null; primary_platform: string | null } | null = null

  const { data: byHandle } = await admin
    .from('influencers')
    .select('id, first_name, display_name, email, platform_handle, affiliate_code, audience_size, niche, primary_platform')
    .eq('platform_handle', handle)
    .limit(1)
    .maybeSingle()

  if (byHandle) {
    influencer = byHandle
  } else {
    const { data: byCode } = await admin
      .from('influencers')
      .select('id, first_name, display_name, email, platform_handle, affiliate_code, audience_size, niche, primary_platform')
      .ilike('affiliate_code', handle)
      .limit(1)
      .maybeSingle()
    influencer = byCode
  }

  if (!influencer) {
    notFound()
  }

  // Create session
  const hdrs = await headers()
  const ua = hdrs.get('user-agent') || ''
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const ipHash = ip ? crypto.createHash('sha256').update(ip + (process.env.ENCRYPTION_SECRET || '')).digest('hex').slice(0, 16) : undefined

  const { sessionId } = await createKitSession({
    influencerId: influencer.id,
    campaignId: campaignId || undefined,
    userAgent: ua.slice(0, 500),
    ipHash,
  })

  // Build kit data
  const name = influencer.first_name || influencer.display_name || handle
  const promoCode = `VIRAL-${(influencer.affiliate_code || handle).toUpperCase()}`
  const commission = projectCommission(influencer.audience_size)

  // Social proof: real counts from DB
  const { count: repostCount } = await admin
    .from('repost_kit_sessions' as never)
    .select('id', { count: 'exact', head: true })
    .not('post_url' as never, 'is' as never, null as never)

  // Top earner: max total_commission_earned_cents from influencers with affiliate_code
  const { data: topEarnerRow } = await admin
    .from('influencers')
    .select('total_commission_earned_cents')
    .not('affiliate_code', 'is', null)
    .gt('total_commission_earned_cents', 0)
    .order('total_commission_earned_cents', { ascending: false })
    .limit(1)
    .maybeSingle()

  const topEarnerCents = (topEarnerRow as { total_commission_earned_cents: number } | null)?.total_commission_earned_cents ?? 0

  return (
    <RepostKitClient
      data={{
        sessionId,
        influencer: {
          firstName: name,
          handle: influencer.platform_handle || handle,
          promoCode,
          audienceSize: influencer.audience_size,
          niche: influencer.niche,
        },
        video: {
          url: null, // V1: no video yet, placeholder shown
        },
        caption: buildCaption(influencer.niche),
        hashtags: buildHashtags(influencer.niche),
        commission,
        socialProof: {
          repostCount: repostCount ?? 0,
          topEarner: topEarnerCents,
        },
      }}
    />
  )
}
