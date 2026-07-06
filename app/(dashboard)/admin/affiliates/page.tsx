'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, DollarSign, TrendingUp, Handshake } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { AffiliatesDashboard } from '@/components/admin/affiliates-dashboard'
import { InfluencerAffiliateTable } from './_components/influencer-affiliate-table'

type Tab = 'influencers' | 'legacy'

interface InfluencerAffiliate {
  id: string
  email: string
  display_name: string | null
  platform_handle: string | null
  affiliate_code: string | null
  status: string
  total_referrals: number | null
  total_paying_referrals: number | null
  total_commission_earned_cents: number | null
  total_commission_paid_cents: number | null
}

export default function AffiliatesAdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('influencers')

  // Influencer affiliates data
  const [influencerAffiliates, setInfluencerAffiliates] = useState<InfluencerAffiliate[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => {
          if (!d.isAdmin) { router.push('/dashboard'); return }
          setAuthorized(true)
          setLoading(false)
        })
        .catch(() => router.push('/dashboard'))
    })
  }, [router])

  const fetchInfluencerAffiliates = useCallback(async () => {
    setDataLoading(true)
    try {
      const res = await fetch('/api/admin/influencer-affiliates')
      const json = await res.json()
      if (json.data) setInfluencerAffiliates(json.data)
    } catch { /* ignore */ }
    setDataLoading(false)
  }, [])

  useEffect(() => {
    if (authorized) fetchInfluencerAffiliates()
  }, [authorized, fetchInfluencerAffiliates])

  if (loading || !authorized) {
    return (
      <div className="flex items-center justify-center py-20">
        <WolfLoader variant="spinner" size={24} mode="amber" />
      </div>
    )
  }

  const totalEarned = influencerAffiliates.reduce((s, a) => s + (a.total_commission_earned_cents ?? 0), 0)
  const totalDue = influencerAffiliates.reduce((s, a) => s + (a.total_commission_earned_cents ?? 0) - (a.total_commission_paid_cents ?? 0), 0)
  const activeCount = influencerAffiliates.filter(a => a.affiliate_code).length
  const payingReferrals = influencerAffiliates.reduce((s, a) => s + (a.total_paying_referrals ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Handshake className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Affiliates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Attribution, commissions & payouts</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Affiliates" value={activeCount} icon={<Users className="h-4 w-4" />} color="text-cyan-400" />
        <StatCard label="Paying Referrals" value={payingReferrals} icon={<TrendingUp className="h-4 w-4" />} color="text-green-400" />
        <StatCard label="Total Earned" value={`$${(totalEarned / 100).toFixed(2)}`} icon={<DollarSign className="h-4 w-4" />} color="text-amber-400" />
        <StatCard label="Commission Due" value={`$${(totalDue / 100).toFixed(2)}`} icon={<DollarSign className="h-4 w-4" />} color="text-red-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'influencers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('influencers')}
        >
          Influencer Affiliates
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'legacy'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('legacy')}
        >
          Creator Affiliates (Legacy)
        </button>
      </div>

      {/* Content */}
      {tab === 'influencers' ? (
        dataLoading && influencerAffiliates.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <WolfLoader variant="spinner" size={20} mode="amber" />
          </div>
        ) : (
          <InfluencerAffiliateTable
            affiliates={influencerAffiliates}
            onViewDetail={(id) => router.push(`/admin/affiliates/${id}`)}
          />
        )
      ) : (
        <AffiliatesDashboard />
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={color}>{icon}</div>
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
