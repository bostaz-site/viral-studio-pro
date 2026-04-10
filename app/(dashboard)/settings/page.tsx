"use client"

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Palette, CreditCard, Plus, Trash2, Star, CheckCircle2, AlertCircle, Loader2, Bell, Activity, Film, Clock, Gift, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { BrandEditor } from '@/components/settings/brand-editor'
import { PricingCard } from '@/components/settings/pricing-card'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface BrandTemplate {
  id: string
  name: string
  primary_color: string | null
  secondary_color: string | null
  font_family: string | null
  logo_path: string | null
  is_default: boolean | null
  created_at: string | null
}

interface Profile {
  id: string
  email: string
  full_name: string | null
  plan: string | null
  monthly_videos_used: number | null
  monthly_processing_minutes_used: number | null
  referral_code: string | null
  bonus_videos: number | null
  updated_at?: string | null
}

type Plan = 'free' | 'pro' | 'studio'

// Plan quotas — keep in sync with app/(dashboard)/layout.tsx and server enforcement
const PLAN_VIDEO_LIMITS: Record<Plan, number> = { free: 3, pro: 50, studio: 999 }
const PLAN_MINUTES_LIMITS: Record<Plan, number> = { free: 30, pro: 500, studio: 5000 }

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function SettingsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const checkoutStatus = searchParams.get('checkout')

  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [templates, setTemplates] = useState<BrandTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showBrandEditor, setShowBrandEditor] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [referralCount, setReferralCount] = useState<number>(0)
  const [referralCopied, setReferralCopied] = useState(false)

  // Profile editing
  const [fullName, setFullName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Notification preferences (stored in localStorage)
  const NOTIF_GAMES = ['irl'] as const
  const NOTIF_GAME_LABELS: Record<string, string> = {
    irl: 'IRL',
  }
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [notifGames, setNotifGames] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('viral_studio_notif_games')
      if (saved) return JSON.parse(saved) as Record<string, boolean>
    }
    return Object.fromEntries(NOTIF_GAMES.map((g) => [g, true]))
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    setUser(currentUser)
    if (!currentUser) { router.push('/login'); return }

    const templatesRes = await fetch('/api/brand-templates').then((r) => r.json())

    // Fetch profile from Supabase directly
    // referral_code / referred_by aren't in the generated Database types yet,
    // so we cast to `any` for the select string and coerce the result manually.
    const { data: rawProfile } = await (supabase.from('profiles') as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{ data: Profile | null }>
        }
      }
    })
      .select('id, email, full_name, plan, monthly_videos_used, monthly_processing_minutes_used, referral_code, bonus_videos, updated_at')
      .eq('id', currentUser.id)
      .single()

    const profileData = rawProfile
    setProfile(profileData)
    setFullName(profileData?.full_name ?? currentUser.user_metadata?.full_name ?? '')
    setTemplates((templatesRes?.data as BrandTemplate[]) ?? [])

    // Count how many users this profile has referred
    if (profileData?.id) {
      const { count } = await (supabase.from('profiles') as unknown as {
        select: (cols: string, opts: { count: 'exact'; head: boolean }) => {
          eq: (col: string, val: string) => Promise<{ count: number | null }>
        }
      })
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', profileData.id)
      setReferralCount(count ?? 0)
    }

    setLoading(false)
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    localStorage.setItem('viral_studio_notif_games', JSON.stringify(notifGames))
  }, [notifGames])

  useEffect(() => {
    localStorage.setItem('viral_studio_notif_enabled', JSON.stringify(notifEnabled))
  }, [notifEnabled])

  useEffect(() => {
    const saved = localStorage.getItem('viral_studio_notif_enabled')
    if (saved !== null) setNotifEnabled(JSON.parse(saved) as boolean)
  }, [])

  const toggleNotifGame = (game: string) => {
    setNotifGames((prev) => ({ ...prev, [game]: !prev[game] }))
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const supabase = createClient()
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', user!.id)
      await supabase.auth.updateUser({ data: { full_name: fullName } })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/brand-templates?id=${id}`, { method: 'DELETE' })
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const handleUpgrade = async (plan: 'pro' | 'studio') => {
    setUpgradeError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json() as { data: { url: string } | null; message?: string }
      if (data.data?.url) {
        window.location.href = data.data.url
        return
      }
      setUpgradeError(data.message ?? 'Impossible de créer la session de paiement. Réessaie dans quelques secondes.')
    } catch {
      setUpgradeError('Erreur réseau. Vérifie ta connexion et réessaie.')
    }
  }

  const handleManageBilling = async () => {
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json() as { data: { url: string } | null }
    if (data.data?.url) window.location.href = data.data.url
  }

  const currentPlan = (profile?.plan ?? 'free') as Plan

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="space-y-10 max-w-3xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Gérez votre profil, vos templates de marque et votre abonnement.</p>
      </div>

      {/* Checkout status notice */}
      {checkoutStatus === 'success' && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
            <p className="text-sm text-green-400 font-medium">Abonnement activé avec succès !</p>
          </CardContent>
        </Card>
      )}
      {checkoutStatus === 'cancel' && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-400">Paiement annulé. Votre plan n&apos;a pas changé.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Profile ── */}
      <Section icon={User} title="Mon profil" description="Informations de votre compte">
        <Card className="bg-card/50 border-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xl font-black text-primary">
                  {(fullName || user?.email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  Plan{' '}
                  <span className={cn_plan(currentPlan)}>{currentPlan}</span>
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Nom complet</Label>
              <div className="flex gap-2">
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="gap-1.5"
                >
                  {savingProfile ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : profileSaved ? (
                    <><CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> Sauvé</>
                  ) : (
                    'Sauvegarder'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Separator />

      {/* ── Usage ── */}
      <Section
        icon={Activity}
        title="Utilisation ce mois-ci"
        description="Tes compteurs se réinitialisent au début de chaque mois"
      >
        {(() => {
          const videosUsed = profile?.monthly_videos_used ?? 0
          const videosLimit = PLAN_VIDEO_LIMITS[currentPlan]
          const minutesUsed = profile?.monthly_processing_minutes_used ?? 0
          const minutesLimit = PLAN_MINUTES_LIMITS[currentPlan]
          const videosPct = Math.min(100, Math.round((videosUsed / videosLimit) * 100))
          const minutesPct = Math.min(100, Math.round((minutesUsed / minutesLimit) * 100))
          const videosColor =
            videosPct >= 90 ? 'from-red-500 to-rose-500' :
            videosPct >= 70 ? 'from-amber-500 to-orange-500' :
            'from-blue-500 to-indigo-500'
          const minutesColor =
            minutesPct >= 90 ? 'from-red-500 to-rose-500' :
            minutesPct >= 70 ? 'from-amber-500 to-orange-500' :
            'from-blue-500 to-indigo-500'
          return (
            <Card className="bg-card/50 border-border">
              <CardContent className="p-5 space-y-5">
                {/* Videos counter */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Film className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Clips générés</span>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{videosUsed}</span>
                      {' / '}
                      {videosLimit === 999 ? '∞' : videosLimit}
                    </span>
                  </div>
                  <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${videosColor} rounded-full transition-all duration-500`}
                      style={{ width: `${videosPct}%` }}
                    />
                  </div>
                  {videosPct >= 90 && currentPlan === 'free' && (
                    <p className="text-xs text-amber-400 font-medium">
                      Tu approches de ta limite mensuelle — passe à Pro pour 50 clips/mois.
                    </p>
                  )}
                </div>

                <Separator />

                {/* Minutes counter */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Minutes de rendu</span>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{minutesUsed}</span>
                      {' / '}
                      {minutesLimit === 5000 ? '∞' : minutesLimit} min
                    </span>
                  </div>
                  <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${minutesColor} rounded-full transition-all duration-500`}
                      style={{ width: `${minutesPct}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })()}
      </Section>

      <Separator />

      {/* ── Brand Templates ── */}
      <Section
        icon={Palette}
        title="Brand Templates"
        description="Personnalisez l'apparence de vos clips avec votre identité visuelle"
      >
        {/* Template list */}
        {templates.length > 0 && (
          <div className="space-y-2">
            {templates.map((t) => (
              <Card key={t.id} className="bg-card/40 border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex gap-1">
                    {t.primary_color && (
                      <div className="w-5 h-5 rounded-full border border-border/50" style={{ backgroundColor: t.primary_color }} />
                    )}
                    {t.secondary_color && (
                      <div className="w-5 h-5 rounded-full border border-border/50" style={{ backgroundColor: t.secondary_color }} />
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground flex-1">{t.name}</p>
                  {t.is_default && (
                    <span className="flex items-center gap-1 text-xs text-yellow-400">
                      <Star className="h-3 w-3" />
                      Défaut
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteTemplate(t.id)}
                    disabled={deletingId === t.id}
                  >
                    {deletingId === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Brand Editor */}
        {showBrandEditor ? (
          <Card className="bg-card/50 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nouveau template</CardTitle>
              <CardDescription>Définissez l&apos;identité visuelle de votre marque</CardDescription>
            </CardHeader>
            <CardContent>
              <BrandEditor
                onSuccess={() => { setShowBrandEditor(false); fetchData() }}
                onCancel={() => setShowBrandEditor(false)}
              />
            </CardContent>
          </Card>
        ) : (
          <Button
            variant="outline"
            className="gap-2 w-full"
            onClick={() => setShowBrandEditor(true)}
          >
            <Plus className="h-4 w-4" />
            Créer un brand template
          </Button>
        )}

        {currentPlan === 'free' && (
          <p className="text-xs text-muted-foreground text-center">
            Les brand templates personnalisés sont disponibles à partir du plan{' '}
            <span className="text-blue-400 font-medium">Pro</span>.
          </p>
        )}
      </Section>

      <Separator />

      {/* ── Stream Notifications ── */}
      <Section
        icon={Bell}
        title="Notifications Streams"
        description="Recevez des alertes quand de nouveaux clips viraux apparaissent"
      >
        <Card className="bg-card/50 border-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Activer les notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Alertes pour les clips avec un velocity score &ge; 80
                </p>
              </div>
              <Switch checked={notifEnabled} onCheckedChange={setNotifEnabled} />
            </div>

            {notifEnabled && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Par jeu</p>
                  <div className="space-y-2">
                    {NOTIF_GAMES.map((game) => (
                      <div key={game} className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted-foreground">{NOTIF_GAME_LABELS[game]}</span>
                        <Switch
                          checked={notifGames[game] ?? true}
                          onCheckedChange={() => toggleNotifGame(game)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </Section>

      <Separator />

      {/* ── Referral Program ── */}
      <Section
        icon={Gift}
        title="Parrainage"
        description="Invite des créateurs et gagne des clips gratuits"
      >
        <Card className="bg-card/50 border-border">
          <CardContent className="p-5 space-y-4">
            {profile?.referral_code ? (
              <>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Ton lien d&apos;invitation
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : 'https://viral-studio-pro.netlify.app'}/signup?ref=${profile.referral_code}`}
                      onFocus={(e) => e.currentTarget.select()}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={() => {
                        const link = `${window.location.origin}/signup?ref=${profile.referral_code}`
                        navigator.clipboard.writeText(link).then(() => {
                          setReferralCopied(true)
                          setTimeout(() => setReferralCopied(false), 2000)
                        })
                      }}
                    >
                      {referralCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copié
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copier
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Code</p>
                    <p className="text-lg font-black font-mono tracking-wider text-primary mt-0.5 truncate">
                      {profile.referral_code}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Invités</p>
                    <p className="text-xl font-black text-foreground mt-0.5">
                      {referralCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-[11px] text-emerald-400 uppercase tracking-wider font-semibold">Clips bonus</p>
                    <p className="text-xl font-black text-emerald-400 mt-0.5">
                      {profile.bonus_videos ?? 0}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground pt-1 space-y-1">
                  <p>
                    <span className="text-emerald-400 font-semibold">+5 clips bonus</span> pour toi à chaque ami inscrit,
                    et <span className="text-emerald-400 font-semibold">+2 clips</span> pour lui en bienvenue.
                  </p>
                  <p className="text-muted-foreground/70">
                    Les clips bonus s&apos;appliquent automatiquement quand tu dépasses ton quota mensuel.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ton code de parrainage sera disponible d&apos;ici quelques instants.
              </p>
            )}
          </CardContent>
        </Card>
      </Section>

      <Separator />

      {/* ── Plan & Billing ── */}
      <Section
        icon={CreditCard}
        title="Plan & Facturation"
        description="Gérez votre abonnement Viral Studio Pro"
      >
        <PricingCard
          currentPlan={currentPlan}
          onUpgrade={handleUpgrade}
          onManageBilling={handleManageBilling}
        />
        {upgradeError && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Échec de la redirection vers Stripe</p>
              <p className="text-muted-foreground mt-0.5">{upgradeError}</p>
            </div>
            <button
              onClick={() => setUpgradeError(null)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Fermer
            </button>
          </div>
        )}
      </Section>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh]" />}>
      <SettingsPageInner />
    </Suspense>
  )
}

function cn_plan(plan: Plan): string {
  if (plan === 'pro') return 'text-blue-400 font-semibold'
  if (plan === 'studio') return 'text-violet-400 font-semibold'
  return 'text-muted-foreground'
}
