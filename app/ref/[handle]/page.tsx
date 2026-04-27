import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { redis } from '@/lib/upstash'
import { headers } from 'next/headers'
import { createHash } from 'crypto'
import { RefCookieSetter } from './cookie-setter'

interface AffiliateCodeRow {
  id: string
  code: string
  custom_handle: string | null
  clicks: number
  active: boolean
}

// affiliate_codes / referral_events not in generated Supabase types yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedAdmin = any

async function resolveAffiliate(handle: string): Promise<AffiliateCodeRow | null> {
  const admin = createAdminClient()
  const db: UntypedAdmin = admin
  const lower = handle.toLowerCase()

  // Try custom_handle first
  const { data: byHandle } = await db
    .from('affiliate_codes')
    .select('id, code, custom_handle, clicks, active')
    .eq('custom_handle', lower)
    .eq('active', true)
    .maybeSingle() as { data: AffiliateCodeRow | null }

  if (byHandle) return byHandle

  // Fallback to code
  const { data: byCode } = await db
    .from('affiliate_codes')
    .select('id, code, custom_handle, clicks, active')
    .eq('code', lower)
    .eq('active', true)
    .maybeSingle() as { data: AffiliateCodeRow | null }

  return byCode
}

async function trackClick(affiliateId: string, currentClicks: number, ip: string): Promise<void> {
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
  const redisKey = `ref_click:${affiliateId}:${ipHash}`

  try {
    // Idempotent: only count once per IP per 24h
    const result = await redis.set(redisKey, '1', { nx: true, ex: 86400 })
    if (result !== 'OK') return

    const admin = createAdminClient()
    const db: UntypedAdmin = admin

    // Increment click count
    await db
      .from('affiliate_codes')
      .update({ clicks: currentClicks + 1 })
      .eq('id', affiliateId)

    // Record event
    await db
      .from('referral_events')
      .insert({
        affiliate_code_id: affiliateId,
        event_type: 'click',
        metadata: { ip_hash: ipHash },
      })
  } catch {
    // Click tracking is best-effort
  }
}

export default async function RefPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params

  const affiliate = await resolveAffiliate(handle)
  if (!affiliate) {
    notFound()
  }

  // Track the click (idempotent by IP)
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0'
  await trackClick(affiliate.id, affiliate.clicks, ip)

  const displayHandle = affiliate.custom_handle || affiliate.code
  const refCode = affiliate.code

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Cookie setter (client component) */}
      <RefCookieSetter code={refCode} />

      {/* Hero */}
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="max-w-lg w-full text-center space-y-8">
          {/* Logo / Brand */}
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
              Viral<span className="text-primary">Animal</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Boost your clips. Go viral.
            </p>
          </div>

          {/* Referral message */}
          <div className="space-y-3">
            <p className="text-lg text-muted-foreground">
              Recommended by
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {displayHandle[0].toUpperCase()}
                </span>
              </div>
              <span className="text-lg font-bold text-primary">@{displayHandle}</span>
            </div>
          </div>

          {/* Value prop */}
          <div className="space-y-4 text-left bg-card/50 border border-border rounded-xl p-6">
            <div className="flex items-start gap-3">
              <span className="text-primary text-lg mt-0.5">1.</span>
              <div>
                <p className="font-semibold text-sm">Pick a clip</p>
                <p className="text-xs text-muted-foreground">Browse trending streamer clips or upload your own</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-primary text-lg mt-0.5">2.</span>
              <div>
                <p className="font-semibold text-sm">Boost it</p>
                <p className="text-xs text-muted-foreground">Add subtitles, split-screen, hooks — one click</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-primary text-lg mt-0.5">3.</span>
              <div>
                <p className="font-semibold text-sm">Export &amp; go viral</p>
                <p className="text-xs text-muted-foreground">Download your optimized 9:16 clip and post it</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <a
            href={`/signup?ref=${refCode}`}
            className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-colors"
          >
            Get Started Free
          </a>

          <p className="text-xs text-muted-foreground">
            Free plan includes 3 clips/month. No credit card required.
          </p>
        </div>
      </div>
    </div>
  )
}
