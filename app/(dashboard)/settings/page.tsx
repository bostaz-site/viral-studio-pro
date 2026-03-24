"use client"

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Palette, CreditCard, Plus, Trash2, Star, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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
}

type Plan = 'free' | 'pro' | 'studio'

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

  // Profile editing
  const [fullName, setFullName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    setUser(currentUser)
    if (!currentUser) { router.push('/login'); return }

    const templatesRes = await fetch('/api/brand-templates').then((r) => r.json())

    // Fetch profile from Supabase directly
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, email, full_name, plan')
      .eq('id', currentUser.id)
      .single()

    setProfile(profileData as Profile | null)
    setFullName(profileData?.full_name ?? currentUser.user_metadata?.full_name ?? '')
    setTemplates((templatesRes?.data as BrandTemplate[]) ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

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
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json() as { data: { url: string } | null }
    if (data.data?.url) window.location.href = data.data.url
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
