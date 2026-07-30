import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashIp } from '@/lib/admin/ip-hash'
import { rateLimit } from '@/lib/rate-limit'

// GET /r/[code] — public affiliate redirect with click tracking
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const supabase = createAdminClient()

  // Resolve affiliate code → influencer
  const { data: influencer } = await supabase
    .from('influencers')
    .select('id, affiliate_code')
    .eq('affiliate_code', code.toLowerCase())
    .maybeSingle()

  if (!influencer) {
    // Fallback: try the existing /ref/[handle] page for user-facing affiliates
    return NextResponse.redirect(new URL(`/ref/${code}`, req.url))
  }

  // Rate limit by IP — 10 clicks per 24h per IP
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0'
  const rl = await rateLimit(`aff-click:${hashIp(ip)}`, 10, 24 * 60 * 60 * 1000)

  // Extract tracking data
  const ipHash = hashIp(ip)
  const ipCountry = headersList.get('x-country') ?? headersList.get('x-nf-client-connection-ip-country') ?? null
  const userAgent = headersList.get('user-agent') ?? null
  const referrerUrl = headersList.get('referer') ?? null

  // Extract UTM params
  const url = new URL(req.url)
  const utmSource = url.searchParams.get('utm_source')
  const utmMedium = url.searchParams.get('utm_medium')
  const utmCampaign = url.searchParams.get('utm_campaign')
  const landing = url.searchParams.get('landing') ?? '/'

  // Generate fingerprint hash from IP + UA (privacy-safe backup for Safari/iOS)
  const fingerprintRaw = `${ip}|${userAgent ?? ''}|${headersList.get('accept-language') ?? ''}`
  const fingerprintHash = hashIp(fingerprintRaw) // reuse hash helper

  // Dedup: skip insert if same ip_hash + code clicked in last 24h
  // Rate limit already caps volume; this prevents duplicate rows
  if (rl.allowed) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentClick } = await supabase
      .from('affiliate_clicks')
      .select('id')
      .eq('ip_hash', ipHash)
      .eq('affiliate_code', influencer.affiliate_code!)
      .gte('clicked_at', oneDayAgo)
      .limit(1)
      .maybeSingle()

    if (!recentClick) {
      // INSERT affiliate_clicks (best-effort, don't block redirect)
      void supabase.from('affiliate_clicks').insert({
        affiliate_code: influencer.affiliate_code!,
        influencer_id: influencer.id,
        ip_hash: ipHash,
        ip_country: ipCountry,
        user_agent: userAgent,
        fingerprint_hash: fingerprintHash,
        referrer_url: referrerUrl?.slice(0, 500) ?? null,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        landing_path: landing,
      })

      // total_clicks is derived from affiliate_clicks table — no separate counter to maintain
    }
  }

  // Build redirect response with cookie
  const destination = new URL(landing.startsWith('/') ? landing : '/', req.url)
  destination.searchParams.set('ref', influencer.affiliate_code!)

  const response = NextResponse.redirect(destination, { status: 302 })

  // Set affiliate cookie — 60 days, secure, sameSite lax
  response.cookies.set('va_ref', influencer.affiliate_code!, {
    maxAge: 60 * 24 * 60 * 60, // 60 days
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false, // client JS needs to read it for signup form
  })

  return response
}
