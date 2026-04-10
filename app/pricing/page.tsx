"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  Zap,
  Crown,
  Rocket,
  ArrowRight,
  Scissors,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PricingTier {
  id: string
  name: string
  price: number
  period: string
  description: string
  icon: typeof Zap
  features: string[]
  highlighted: boolean
  trialNote?: string
  cta: string
  accentColor: string
}

const TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'pour toujours',
    description: 'Parfait pour tester et créer tes premiers clips viraux.',
    icon: Scissors,
    features: [
      '3 vidéos par mois',
      'Clips jusqu\u2019à 60 secondes',
      'Transcription IA (Whisper)',
      'Score viral + analyse hooks',
      '1 format (9:16 vertical)',
      'Watermark Viral Studio',
    ],
    highlighted: false,
    cta: 'Commencer gratuitement',
    accentColor: 'from-slate-500 to-slate-600',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    period: '/mois',
    description: 'Pour les créateurs sérieux qui veulent scaler leur contenu.',
    icon: Zap,
    features: [
      '50 vidéos par mois',
      'Clips jusqu\u2019à 10 minutes',
      'Sans watermark',
      'Branding personnalisé (logo, couleurs)',
      '3 formats d\u2019export',
      'Dashboard Trending complet',
      'Remake This illimité',
      'Suppression des silences auto',
    ],
    highlighted: true,
    trialNote: '7 jours gratuits, sans engagement',
    cta: 'D\u00e9marrer les 7 jours gratuits',
    accentColor: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 79,
    period: '/mois',
    description: 'L\u2019arsenal complet pour les agences et power users.',
    icon: Crown,
    features: [
      'Vidéos illimitées',
      'Tout le plan Pro inclus',
      'Split-screen automatique',
      'Distribution multi-plateforme',
      'Voix-off IA (ElevenLabs)',
      'Accès API',
      'White-label (votre marque)',
      'Support prioritaire',
    ],
    highlighted: false,
    cta: 'Passer au Studio',
    accentColor: 'from-purple-500 to-pink-600',
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'free') {
      router.push('/login')
      return
    }

    setLoadingPlan(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json() as { data: { url: string } | null; error: string | null }

      if (data.data?.url) {
        window.location.href = data.data.url
      } else {
        // Not logged in — redirect to signup
        router.push(`/login?redirect=pricing&plan=${planId}`)
      }
    } catch {
      router.push(`/login?redirect=pricing&plan=${planId}`)
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
            VIRAL STUDIO
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Se connecter</Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="gap-1.5">
                <Rocket className="h-3.5 w-3.5" />
                Essai gratuit
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-20 pb-12 px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-sm text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Lancez-vous gratuitement, upgradez quand vous êtes prêt
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Des clips viraux,{' '}
            <span className="bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
              à votre échelle
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Choisissez le plan qui correspond à vos ambitions. Pas de surprise, pas d&apos;engagement.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {TIERS.map((tier) => {
            const TierIcon = tier.icon
            return (
              <Card
                key={tier.id}
                className={cn(
                  'relative overflow-hidden transition-all duration-300 hover:shadow-xl',
                  tier.highlighted
                    ? 'border-primary/50 shadow-lg shadow-primary/10 scale-[1.02]'
                    : 'border-border bg-card/60 hover:border-primary/30'
                )}
              >
                {tier.highlighted && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
                )}

                <CardContent className="p-6 flex flex-col h-full">
                  {/* Badge */}
                  {tier.highlighted && (
                    <span className="inline-flex self-start items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 mb-4">
                      <TrendingUp className="h-3 w-3" />
                      Populaire
                    </span>
                  )}

                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn('p-2.5 rounded-xl bg-gradient-to-br text-white', tier.accentColor)}>
                      <TierIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{tier.name}</h3>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-4xl font-black tracking-tight">{tier.price}€</span>
                    <span className="text-muted-foreground ml-1">{tier.period}</span>
                    {tier.trialNote && (
                      <p className="text-xs text-emerald-400 font-medium mt-1.5">{tier.trialNote}</p>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-6">{tier.description}</p>

                  {/* Features */}
                  <div className="space-y-3 flex-1 mb-6">
                    {tier.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <Button
                    className={cn(
                      'w-full gap-2 h-11',
                      tier.highlighted
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
                        : ''
                    )}
                    variant={tier.highlighted ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(tier.id)}
                    disabled={loadingPlan === tier.id}
                  >
                    {loadingPlan === tier.id ? 'Chargement…' : tier.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <p>Viral Studio Pro — Transformez vos vidéos en clips viraux avec l&apos;IA</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-foreground transition-colors">Connexion</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
