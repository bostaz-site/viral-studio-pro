'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Link2, Users, DollarSign, MousePointerClick } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CommissionLedgerView } from '../_components/commission-ledger-view'

interface DetailData {
  influencer: {
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
  referrals: Array<{
    id: string
    user_id: string
    attribution_type: string
    status: string
    total_revenue_cents: number | null
    first_paid_at: string | null
    created_at: string
  }>
  ledger: Array<{
    id: string
    event_type: string
    amount_cents: number
    currency: string
    stripe_invoice_id: string | null
    stripe_charge_id: string | null
    notes: string | null
    created_at: string
  }>
  clicks: Array<{
    id: string
    ip_country: string | null
    utm_source: string | null
    utm_medium: string | null
    signup_user_id: string | null
    clicked_at: string
  }>
  balance: { earned_cents: number; clawback_cents: number; available_cents: number }
}

export default function AffiliateDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: userData }) => {
      if (!userData.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => {
          if (!d.isAdmin) { router.push('/dashboard'); return }
          setAuthorized(true)
          setAuthLoading(false)
        })
        .catch(() => router.push('/dashboard'))
    })
  }, [router])

  useEffect(() => {
    if (!authorized || !id) return
    setLoading(true)
    fetch(`/api/admin/influencer-affiliates/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error)
        setData(json.data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [authorized, id])

  if (authLoading || !authorized) {
    return <div className="flex items-center justify-center py-20"><WolfLoader variant="spinner" size={24} mode="amber" /></div>
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><WolfLoader variant="spinner" size={24} mode="amber" /></div>
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div className="text-sm text-red-400">{error ?? 'Not found'}</div>
      </div>
    )
  }

  const { influencer, referrals, ledger, clicks, balance } = data
  const linkUrl = influencer.affiliate_code ? `viralanimal.com/r/${influencer.affiliate_code}` : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{influencer.display_name ?? influencer.email}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {influencer.affiliate_code && <span className="font-mono">{influencer.affiliate_code}</span>}
            {influencer.platform_handle && <span> &middot; @{influencer.platform_handle}</span>}
          </p>
        </div>
        <Badge variant="outline" className="ml-auto text-xs">{influencer.status}</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Clicks" value={clicks.length} icon={<MousePointerClick className="h-4 w-4" />} color="text-cyan-400" />
        <StatCard label="Referrals" value={referrals.length} icon={<Users className="h-4 w-4" />} color="text-green-400" />
        <StatCard label="Paying" value={referrals.filter(r => r.first_paid_at).length} icon={<DollarSign className="h-4 w-4" />} color="text-amber-400" />
        <StatCard label="Link" value={linkUrl ?? '—'} icon={<Link2 className="h-4 w-4" />} color="text-amber-400" small />
      </div>

      {/* Commission Ledger */}
      <CommissionLedgerView entries={ledger} balance={balance} />

      {/* Recent referrals */}
      <Card className="border-border">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Referrals ({referrals.length})</h3>
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals yet</p>
          ) : (
            <div className="space-y-2">
              {referrals.slice(0, 20).map(r => (
                <div key={r.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${r.first_paid_at ? 'text-green-400 border-green-400/40' : 'text-muted-foreground'}`}>
                      {r.status}
                    </Badge>
                    <span className="text-muted-foreground font-mono">{r.user_id.slice(0, 8)}</span>
                    <span className="text-muted-foreground">via {r.attribution_type}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, icon, color, small }: { label: string; value: number | string; icon: React.ReactNode; color: string; small?: boolean }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={color}>{icon}</div>
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className={`font-bold text-foreground ${small ? 'text-xs font-mono truncate' : 'text-2xl'}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
