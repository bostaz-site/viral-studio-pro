'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { DashboardOverview } from '@/lib/admin/dashboard/aggregator'

import { WhileYouSlept } from './_components/while-you-slept'
import { HotLeadsSection } from './_components/hot-leads-section'
import { StuckFollowups } from './_components/stuck-followups'
import { PayoutsDueCard } from './_components/payouts-due-card'
import { WatchdogAlertsCard } from './_components/watchdog-alerts-card'
import { AiInsightsCard } from './_components/ai-insights-card'
import { WeeklyGoal } from './_components/weekly-goal'

export default function AdminDashboardPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Auth check
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

  // Fetch dashboard data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/admin/dashboard/overview')
      const json = await res.json()
      if (json.data) setData(json.data)
    } catch { /* ignore */ }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    if (authorized) fetchData()
  }, [authorized, fetchData])

  // Supabase Realtime: new replies + new alerts
  useEffect(() => {
    if (!authorized) return
    const supabase = createClient()

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'email_messages',
        filter: 'direction=eq.inbound',
      }, () => {
        fetchData(true)
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_alerts',
      }, () => {
        fetchData(true)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [authorized, fetchData])

  if (authLoading || !authorized) {
    return <div className="flex items-center justify-center py-20"><WolfLoader variant="spinner" size={24} mode="amber" /></div>
  }

  if (loading || !data) {
    return <div className="flex items-center justify-center py-20"><WolfLoader variant="spinner" size={24} mode="amber" /></div>
  }

  const mrrDollars = (data.mrr.current / 100).toFixed(0)
  const mrrUp = data.mrr.changePct >= 0

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bonjour {data.greeting.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{data.greeting.date}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* MRR */}
          <div className="text-right">
            <p className="text-xs text-muted-foreground">MRR</p>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-foreground">${mrrDollars}</span>
              {data.mrr.changePct !== 0 && (
                <span className={`flex items-center text-[10px] font-medium ${mrrUp ? 'text-green-400' : 'text-red-400'}`}>
                  {mrrUp ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {mrrUp ? '+' : ''}{data.mrr.changePct}%
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="h-8 w-8 p-0">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* While you slept */}
      <WhileYouSlept {...data.whileYouSlept} />

      {/* Hot leads + Stuck */}
      <div className="grid md:grid-cols-2 gap-4">
        <HotLeadsSection leads={data.hotLeads} />
        <StuckFollowups leads={data.stuckFollowups} />
      </div>

      {/* Payouts + Watchdog */}
      <div className="grid md:grid-cols-2 gap-4">
        <PayoutsDueCard {...data.payoutsDue} />
        <WatchdogAlertsCard alerts={data.alerts} />
      </div>

      {/* AI Insights */}
      <AiInsightsCard />

      {/* Weekly goal */}
      <WeeklyGoal {...data.weeklyGoal} />
    </div>
  )
}
