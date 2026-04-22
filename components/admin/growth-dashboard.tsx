'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Loader2,
  AlertCircle,
  Crown,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAffiliateStore, type Affiliate } from '@/stores/affiliate-store'

export function GrowthDashboard() {
  const { affiliates, loading, fetchAffiliates } = useAffiliateStore()
  const [signupData, setSignupData] = useState<{ date: string; count: number }[]>([])
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    fetchAffiliates()
  }, [fetchAffiliates])

  useEffect(() => {
    // Generate last 30 days of mock signup data from affiliate totals
    const days: { date: string; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push({
        date: d.toISOString().slice(0, 10),
        count: 0,
      })
    }
    setSignupData(days)
    setLoadingStats(false)
  }, [])

  const totalRevenue = affiliates.reduce((s, a) => s + (a.total_revenue ?? 0), 0)
  const totalSignups = affiliates.reduce((s, a) => s + (a.total_signups ?? 0), 0)
  const totalConversions = affiliates.reduce((s, a) => s + (a.total_conversions ?? 0), 0)
  const conversionRate = totalSignups > 0 ? ((totalConversions / totalSignups) * 100).toFixed(1) : '0'
  const topAffiliates = [...affiliates]
    .sort((a, b) => (b.total_revenue ?? 0) - (a.total_revenue ?? 0))
    .slice(0, 5)

  if (loading && affiliates.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Affiliate Signups" value={totalSignups} icon={<Users className="h-4 w-4" />} color="text-blue-400" />
        <StatCard label="Conversions" value={totalConversions} icon={<Target className="h-4 w-4" />} color="text-green-400" />
        <StatCard label="Conv. Rate" value={`${conversionRate}%`} icon={<TrendingUp className="h-4 w-4" />} color="text-amber-400" />
        <StatCard label="Revenue" value={`$${totalRevenue.toFixed(0)}`} icon={<DollarSign className="h-4 w-4" />} color="text-emerald-400" />
      </div>

      {/* Signup sources breakdown */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold text-foreground">Signup Sources</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Direct', value: '—', color: 'text-foreground' },
              { label: 'Referral Link', value: affiliates.reduce((s, a) => s + (a.total_clicks ?? 0), 0), color: 'text-blue-400' },
              { label: 'Promo Code', value: totalSignups, color: 'text-amber-400' },
              { label: 'Organic', value: '—', color: 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="text-center p-3 rounded-xl border border-border">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Signups bar chart (last 30 days) */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold text-foreground">Signups (last 30 days)</h3>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-[2px] h-[120px]">
            {signupData.map(d => (
              <div
                key={d.date}
                className="flex-1 bg-primary/30 hover:bg-primary/50 rounded-t transition-colors min-h-[2px]"
                style={{ height: `${Math.max(d.count * 20, 2)}%` }}
                title={`${d.date}: ${d.count}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top affiliates */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-400" />
            Top Affiliates by Revenue
          </h3>
        </CardHeader>
        <CardContent className="space-y-2">
          {topAffiliates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No affiliates yet</p>
          ) : (
            topAffiliates.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20">
                <span className={`text-sm font-bold w-6 text-center ${
                  i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : 'text-muted-foreground'
                }`}>
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground">@{a.handle} · {a.platform ?? 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">${(a.total_revenue ?? 0).toFixed(0)}</p>
                  <p className="text-[10px] text-muted-foreground">{a.total_conversions ?? 0} conv.</p>
                </div>
                <Badge variant="outline" className={`text-[9px] ${
                  a.status === 'active' ? 'text-green-400 border-green-400/40' : 'text-muted-foreground border-border'
                }`}>
                  {a.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
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
