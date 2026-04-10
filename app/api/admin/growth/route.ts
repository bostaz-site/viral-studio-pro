import { NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface NewsletterLead {
  email: string
  source: string | null
  created_at: string
}

interface ReferrerRow {
  id: string
  email: string
  full_name: string | null
  referral_code: string | null
  plan: string | null
  invited_count: number
  created_at: string | null
}

export const GET = withAdmin(async () => {
  const admin = createAdminClient()

  // ── Newsletter leads: total + last 14 days + 20 most recent
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [{ count: leadsTotal }, { count: leadsLast14d }, recentLeadsRes] = await Promise.all([
    (admin.from('newsletter_leads' as never) as unknown as {
      select: (c: string, o: { count: 'exact'; head: boolean }) => Promise<{ count: number | null }>
    }).select('email', { count: 'exact', head: true }),
    (admin.from('newsletter_leads' as never) as unknown as {
      select: (c: string, o: { count: 'exact'; head: boolean }) => {
        gte: (col: string, v: string) => Promise<{ count: number | null }>
      }
    })
      .select('email', { count: 'exact', head: true })
      .gte('created_at', fourteenDaysAgo),
    (admin.from('newsletter_leads' as never) as unknown as {
      select: (c: string) => {
        order: (col: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: NewsletterLead[] | null }>
        }
      }
    })
      .select('email, source, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // ── Referrers: top 10 profiles by invited_count
  const { data: profilesData } = await (admin.from('profiles') as unknown as {
    select: (cols: string) => Promise<{
      data: Array<{
        id: string
        email: string
        full_name: string | null
        referral_code: string | null
        referred_by: string | null
        plan: string | null
        created_at: string | null
      }> | null
    }>
  }).select('id, email, full_name, referral_code, referred_by, plan, created_at')

  const profiles = profilesData ?? []
  const invitedCount = new Map<string, number>()
  for (const p of profiles) {
    if (p.referred_by) {
      invitedCount.set(p.referred_by, (invitedCount.get(p.referred_by) ?? 0) + 1)
    }
  }

  const topReferrers: ReferrerRow[] = profiles
    .map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      referral_code: p.referral_code,
      plan: p.plan,
      invited_count: invitedCount.get(p.id) ?? 0,
      created_at: p.created_at,
    }))
    .filter((r) => r.invited_count > 0)
    .sort((a, b) => b.invited_count - a.invited_count)
    .slice(0, 10)

  const totalReferrals = Array.from(invitedCount.values()).reduce((s, n) => s + n, 0)

  return NextResponse.json({
    data: {
      newsletter: {
        total: leadsTotal ?? 0,
        last14d: leadsLast14d ?? 0,
        recent: recentLeadsRes.data ?? [],
      },
      referrals: {
        totalSignupsViaReferral: totalReferrals,
        uniqueReferrers: topReferrers.length,
        topReferrers,
      },
    },
    error: null,
    message: 'ok',
  })
})
