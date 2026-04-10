"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Share, Settings, Menu, X, LogOut, Upload, Zap, Compass, Wand2, BarChart3, Crown } from 'lucide-react'
import { useUiStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/trending/notification-bell'
import { createClient } from '@/lib/supabase/client'
import { isAdminEmail } from '@/lib/auth/admin-emails'
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
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isAdmin = isAdminEmail(user?.email)

  const navigation = [
    { name: 'Browse', href: '/dashboard', icon: Compass },
    { name: 'Enhance', href: '/dashboard/enhance', icon: Wand2 },
    { name: 'Publier', href: '/publish', icon: Share },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    ...(isAdmin ? [{ name: 'Growth (admin)', href: '/admin/growth', icon: Crown }] : []),
    { name: 'Paramètres', href: '/settings', icon: Settings },
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
            <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
              VIRAL STUDIO
            </h1>
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

        {/* Quick action — secondary upload */}
        <div className="px-4 pt-4">
          <Link href="/create">
            <Button variant="outline" className="w-full border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-foreground font-medium gap-2 h-9 text-sm">
              <Upload className="h-3.5 w-3.5" />
              Importer ma vidéo
            </Button>
          </Link>
        </div>

        <nav className="p-4 space-y-1 flex-1">
          {navigation.map((item) => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : item.href === '/dashboard/enhance'
              ? pathname?.startsWith('/dashboard/enhance')
              : pathname?.startsWith(item.href) && item.href !== '/dashboard'
            return (
              <Link key={item.name} href={item.href}>
                <span className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                  <item.icon className={`h-5 w-5 mr-3 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  {item.name}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Usage + Plan */}
        <div className="px-4 pb-2">
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Vidéos ce mois</span>
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
                Passer à Pro — vidéos illimitées
              </Link>
            )}
          </div>
        </div>

        {/* User footer */}
        {user && (
          <div className="p-4 border-t border-border shrink-0">
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
                title="Se déconnecter"
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
          <span className="font-bold tracking-tight text-lg bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">VIRAL STUDIO</span>
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
