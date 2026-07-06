'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, LogOut, Gift } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { StatsCards } from './_components/stats-cards'
import { CodeCard } from './_components/code-card'
import { RecentReferrals } from './_components/recent-referrals'
import { PayoutSchedule } from './_components/payout-schedule'
import Link from 'next/link'

interface PartnerStats {
  influencer: { name: string; email: string; affiliate_code: string | null }
  clicks: { total: number; thisMonth: number }
  signups: number
  paying: number
  earnings: { totalCents: number; thisMonthCents: number }
  nextPayout: { amountCents: number; status: string; periodEnd: string } | null
}

interface LedgerData {
  referrals: Array<{
    label: string; status: string; signedUpAt: string;
    firstPaidAt: string | null; revenueCents: number; commissionCents: number
  }>
  payouts: Array<{
    id: string; net_payout_cents: number; status: string;
    period_start_at: string; period_end_at: string; sent_at: string | null; created_at: string
  }>
}

export default function PartnerDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [ledger, setLedger] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, ledgerRes] = await Promise.all([
          fetch('/api/partner/stats', { cache: 'no-store' }),
          fetch('/api/partner/ledger', { cache: 'no-store' }),
        ])

        if (statsRes.status === 401 || ledgerRes.status === 401) {
          router.push('/partner/login')
          return
        }

        const statsJson = await statsRes.json()
        const ledgerJson = await ledgerRes.json()

        if (statsJson.data) setStats(statsJson.data)
        if (ledgerJson.data) setLedger(ledgerJson.data)
      } catch {
        setError('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const handleLogout = async () => {
    await fetch('/api/partner/auth/logout', { method: 'POST' })
    router.push('/partner/login')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <WolfLoader variant="spinner" size={32} mode="amber" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-sm text-red-400">{error || 'Failed to load'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Hi {stats.influencer.name}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">{stats.influencer.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/partner/promo-kit"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-md hover:bg-zinc-700 transition-colors"
          >
            <Gift className="h-3.5 w-3.5" />
            Promo Kit
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsCards
        clicks={stats.clicks}
        signups={stats.signups}
        paying={stats.paying}
        earnings={stats.earnings}
      />

      {/* Affiliate code + link + QR */}
      <CodeCard affiliateCode={stats.influencer.affiliate_code} />

      {/* Two columns: referrals + payouts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentReferrals referrals={ledger?.referrals || []} />
        <PayoutSchedule
          nextPayout={stats.nextPayout}
          pastPayouts={ledger?.payouts || []}
          totalEarnedCents={stats.earnings.totalCents}
        />
      </div>

      {/* Commission info */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-center">
        <p className="text-xs text-zinc-500">
          You earn <span className="text-amber-400 font-medium">30% recurring commission</span> on every paying customer you refer.
          Commissions are paid monthly via Stripe. Minimum payout: $50.
        </p>
      </div>
    </div>
  )
}
