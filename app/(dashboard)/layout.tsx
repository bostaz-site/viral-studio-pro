"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, Menu, X, LogOut, Zap, Compass, Wand2, Radio, BarChart3, TrendingUp, Handshake, Users, ChevronRight, Inbox, Mail, Upload, ShieldBan, RefreshCw, Webhook, ShieldAlert, MailCheck, Globe, PieChart, DollarSign, Banknote, Home, Filter, Receipt, LineChart, ShieldCheck, Radar } from 'lucide-react'
import { ViralAnimalLogo } from '@/components/brand/viral-animal-logo'
import { useUiStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/trending/notification-bell'
import { createClient } from '@/lib/supabase/client'
import { useAccountStore } from '@/stores/account-store'
import { CREATOR_RANK_CONFIG } from '@/lib/scoring/account-scorer'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

interface UserProfile {
  plan: string | null
  monthly_videos_used: number | null
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarOpen, setSidebarOpen } = useUiStore()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase
          .from('profiles')
          .select('plan, monthly_videos_used')
          .eq('id', data.user.id)
          .single()
          .then(({ data: p }) => { if (p) setProfile(p) })
        // Check admin status server-side (email list never sent to client)
        fetch('/api/auth/me')
          .then(r => r.json())
          .then(d => setIsAdmin(d.isAdmin === true))
          .catch(() => setIsAdmin(false))
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setIsAdmin(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // User-facing nav (always visible)
  const userNavigation = [
    { name: 'Browse', href: '/dashboard', icon: Compass },
    { name: 'Enhance', href: '/dashboard/enhance', icon: Wand2 },
    { name: 'Distribution', href: '/dashboard/distribution', icon: Radio },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  // Admin-only nav — grouped par section pour clarté à scale
  // Pages futures (Scraper, Videos Library, Learning Engine, etc.) ajoutées au fur et à mesure du build V3
  const adminNavigationGrouped = [
    {
      section: 'Overview',
      items: [
        { name: 'Dashboard', href: '/admin', icon: Home },
        { name: 'Watchdog', href: '/admin/watchdog', icon: ShieldAlert },
      ],
    },
    {
      section: 'CRM & Leads',
      items: [
        { name: 'Scraper', href: '/admin/scraper', icon: Radar },
        { name: 'Influencers', href: '/admin/influencers', icon: Users },
        { name: 'Import', href: '/admin/influencers/import', icon: Upload },
        { name: 'Suppression', href: '/admin/suppression', icon: ShieldBan },
        { name: 'Compliance', href: '/admin/compliance', icon: ShieldCheck },
      ],
    },
    {
      section: 'Outreach',
      items: [
        { name: 'Campaigns', href: '/admin/campaigns', icon: Mail },
        { name: 'Inbox', href: '/admin/inbox', icon: Inbox },
      ],
    },
    {
      section: 'Affiliates',
      items: [
        { name: 'Affiliates', href: '/admin/affiliates', icon: Handshake },
      ],
    },
    {
      section: 'Analytics',
      items: [
        { name: 'Overview', href: '/admin/analytics', icon: PieChart },
        { name: 'Funnel', href: '/admin/analytics/funnel', icon: Filter },
        { name: 'Revenue', href: '/admin/analytics/revenue', icon: BarChart3 },
        { name: 'Leaderboard', href: '/admin/analytics/affiliates', icon: TrendingUp },
        { name: 'Campaign Perf', href: '/admin/analytics/campaigns', icon: PieChart },
        { name: 'Cohorts', href: '/admin/analytics/cohorts', icon: LineChart },
        { name: 'User Growth', href: '/admin/growth', icon: TrendingUp },
      ],
    },
    {
      section: 'Finance',
      items: [
        { name: 'Payouts', href: '/admin/payouts', icon: Banknote },
        { name: 'Costs', href: '/admin/costs', icon: Receipt },
      ],
    },
    {
      section: 'Infrastructure',
      items: [
        { name: 'Mailboxes', href: '/admin/mailboxes', icon: MailCheck },
        { name: 'Domains', href: '/admin/domains', icon: Globe },
        { name: 'Sync', href: '/admin/sync', icon: RefreshCw },
        { name: 'Webhooks', href: '/admin/webhooks', icon: Webhook },
      ],
    },
  ]

  const planLimits: Record<string, number> = { free: 3, pro: 50, studio: 999 }
  const planLabel: Record<string, string> = { free: 'Free', pro: 'Pro', studio: 'Studio' }
  const currentPlan = profile?.plan || 'free'
  const videosUsed = profile?.monthly_videos_used ?? 0
  const videosLimit = planLimits[currentPlan] ?? 3

  const userInitials = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar bg */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-border shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <ViralAnimalLogo size={32} />
            {currentPlan !== 'free' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white uppercase">
                {planLabel[currentPlan]}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <nav className="p-4 pt-6 flex-1 overflow-y-auto">
          {/* User nav */}
          <div className="space-y-1">
            {userNavigation.map((item) => {
              const isActive = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname?.startsWith(item.href)
              return (
                <Link key={item.name} href={item.href}>
                  <span className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${isActive ? 'bg-amber-500/10 text-amber-400 shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                    <item.icon className={`h-5 w-5 mr-3 ${isActive ? 'text-amber-400' : 'text-muted-foreground'}`} />
                    {item.name}
                  </span>
                </Link>
              )
            })}
          </div>

          {/* Admin nav — grouped sections, only visible to admins */}
          {isAdmin && (
            <div className="mt-6">
              <div className="flex items-center gap-2 px-4 mb-3">
                <span className="text-[10px] font-bold tracking-wider text-amber-500/70 uppercase">Admin</span>
                <div className="flex-1 h-px bg-amber-500/20" />
              </div>
              {adminNavigationGrouped.map((group) => (
                <div key={group.section} className="mb-4">
                  <div className="px-4 mb-1.5">
                    <span className="text-[9px] font-bold tracking-widest text-zinc-600 uppercase">{group.section}</span>
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = item.href === '/admin'
                        ? pathname === '/admin'
                        : pathname?.startsWith(item.href)
                      return (
                        <Link key={item.name} href={item.href}>
                          <span className={`flex items-center px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${isActive ? 'bg-amber-500/10 text-amber-400 shadow-sm' : 'text-zinc-500 hover:bg-muted hover:text-zinc-300'}`}>
                            <item.icon className={`h-4 w-4 mr-3 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                            {item.name}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Usage + Plan */}
        <div className="px-4 pb-2">
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Clips this month</span>
              <span className="text-xs font-semibold text-foreground">{videosUsed}/{videosLimit === 999 ? '∞' : videosLimit}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (videosUsed / videosLimit) * 100)}%` }}
              />
            </div>
            {currentPlan === 'free' && (
              <Link href="/settings" className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium">
                <Zap className="h-3 w-3" />
                Upgrade to Pro — {planLimits.pro} clips/mo
              </Link>
            )}
          </div>
        </div>

        {/* User footer */}
        {user && (
          <div className="p-4 border-t border-border shrink-0">
            <SidebarRankBadge />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{userInitials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {(user.user_metadata?.full_name as string | undefined) ?? user.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleLogout}
                title="Log out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border bg-card/50 backdrop-blur-md md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <ViralAnimalLogo size={28} iconOnly />
          <div className="w-10"></div>
        </header>

        <main className="flex-1 overflow-y-auto focus:outline-none bg-background/50">
          <div className="py-6 px-4 sm:px-6 md:px-8 max-w-[1600px] mx-auto min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

// Rank thresholds (must match lib/scoring/account-scorer.ts CREATOR_RANK_CONFIG)
// Used to compute progression toward the next rank tier.
const RANK_THRESHOLDS: Record<string, number> = {
  scout: 0,
  hunter: 20,
  alpha: 40,
  apex: 60,
  legend: 80,
}
const RANK_ORDER = ['scout', 'hunter', 'alpha', 'apex', 'legend']

function SidebarRankBadge() {
  const { score, fetchAccountScore } = useAccountStore()
  useEffect(() => { fetchAccountScore() }, [fetchAccountScore])
  if (!score) return null
  const cfg = CREATOR_RANK_CONFIG[score.creator_rank]
  const currentScore = score.creator_score
  const currentIdx = RANK_ORDER.indexOf(score.creator_rank)
  const nextRank = currentIdx >= 0 && currentIdx < RANK_ORDER.length - 1 ? RANK_ORDER[currentIdx + 1] : null
  const nextThreshold = nextRank ? RANK_THRESHOLDS[nextRank] : null
  const currentThreshold = RANK_THRESHOLDS[score.creator_rank] ?? 0
  const progressPct = nextThreshold
    ? Math.min(100, Math.max(0, ((currentScore - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100

  return (
    <Link
      href="/dashboard/analytics"
      className="block mb-3 px-3 py-2.5 rounded-xl bg-cyan-500/8 hover:bg-cyan-500/12 border border-cyan-500/15 hover:border-cyan-500/30 transition-all group"
      title="View your full Creator Rank in Analytics"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">{cfg.emoji}</span>
          <span className={`text-xs font-bold ${cfg.color} truncate`}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums shrink-0">
          <span className="font-semibold text-zinc-300">{currentScore}</span>
          <span>/100</span>
          <ChevronRight className="h-3 w-3 ml-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />
        </div>
      </div>
      {nextRank && (
        <>
          <div className="h-1 bg-zinc-800/70 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[9px] text-muted-foreground mt-1.5 truncate">
            {(nextThreshold! - currentScore).toFixed(1)} to <span className="font-semibold text-cyan-400 uppercase">{nextRank}</span>
          </p>
        </>
      )}
      {!nextRank && (
        <p className="text-[9px] text-amber-400/80 mt-1 font-medium uppercase tracking-wider">Max rank — keep dominating</p>
      )}
    </Link>
  )
}
