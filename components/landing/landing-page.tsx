"use client"

import Link from 'next/link'
import { Scissors, Zap, Sparkles, TrendingUp, Check, Clapperboard, Subtitles, MonitorPlay, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: Clapperboard,
    title: 'Choisis un clip de stream',
    description: 'Parcours les meilleurs moments Twitch et YouTube Gaming triés par score viral.',
    color: 'from-purple-500 to-indigo-600',
  },
  {
    icon: Subtitles,
    title: 'Ajoute sous-titres + réaction + vidéo satisfaisante',
    description: 'Sous-titres karaoké, split-screen et analyse IA pour maximiser la rétention.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: MonitorPlay,
    title: 'Exporte et publie',
    description: 'Télécharge en 9:16 optimisé TikTok/Reels/Shorts ou publie directement.',
    color: 'from-cyan-500 to-emerald-500',
  },
]

const FEATURES = [
  {
    icon: Subtitles,
    title: 'Sous-titres karaoké',
    description: '9 styles de captions animés (Hormozi, MrBeast, Gaming, etc.)',
  },
  {
    icon: MonitorPlay,
    title: 'Split-screen automatique',
    description: 'Combine le clip du stream avec une vidéo satisfaisante (Subway Surfers, Minecraft, etc.)',
  },
  {
    icon: TrendingUp,
    title: 'Score viral IA',
    description: 'Chaque clip reçoit un score 0-100 avec explication détaillée par Claude IA.',
  },
  {
    icon: Sparkles,
    title: '9 styles de captions',
    description: 'Templates pro prêts à l\'emploi pour des sous-titres qui captent l\'attention.',
  },
]

interface PlanConfig {
  name: string
  price: string
  priceNote: string
  features: string[]
  highlighted?: boolean
  cta: string
}

const PLANS: PlanConfig[] = [
  {
    name: 'Free',
    price: '0€',
    priceNote: '/mois',
    features: [
      '3 vidéos / mois',
      '90 crédits offerts',
      'Clips jusqu\'à 60s',
      'Score viral IA',
      'Watermark Viral Studio',
    ],
    cta: 'Commencer gratuitement',
  },
  {
    name: 'Pro',
    price: '29€',
    priceNote: '/mois',
    highlighted: true,
    features: [
      '50 vidéos / mois',
      'Clips jusqu\'à 10 min',
      'Score viral + Remake This',
      'Sans watermark',
      'Brand Template custom',
      'Export 9:16 + 1:1 + 16:9',
      'Dashboard Streams complet',
    ],
    cta: 'Passer Pro',
  },
  {
    name: 'Studio',
    price: '79€',
    priceNote: '/mois',
    features: [
      'Vidéos illimitées',
      'Tout Pro inclus',
      'Split-screen automatique',
      'Distribution multi-plateforme',
      'Voix-off ElevenLabs',
      'API access',
      'Support prioritaire',
    ],
    cta: 'Passer Studio',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Scissors className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              VIRAL STUDIO
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Se connecter</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
                Essai gratuit
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm text-primary mb-8">
            <Zap className="h-3.5 w-3.5" />
            Propulsé par l&apos;IA Claude
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1]">
            Transforme les meilleurs{' '}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              moments de streams
            </span>{' '}
            en clips viraux
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
            Sélectionne un clip Twitch ou YouTube Gaming, ajoute des sous-titres karaoké et une vidéo satisfaisante, exporte en 1 clic pour TikTok, Reels et Shorts.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 h-12 px-8 text-base font-semibold gap-2">
                Essayer gratuitement — 90 crédits offerts
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4">
            Pas de carte bancaire requise · Prêt en 30 secondes
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Comment ça marche</h2>
            <p className="text-muted-foreground mt-3 text-lg">3 étapes pour créer un clip viral</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative text-center">
                {/* Step number */}
                <div className="flex items-center justify-center mb-6">
                  <div className={cn('w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg', step.color)}>
                    <step.icon className="h-7 w-7 text-white" />
                  </div>
                </div>
                <span className="inline-block text-xs font-bold text-muted-foreground/50 uppercase tracking-wider mb-2">
                  Étape {i + 1}
                </span>
                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-card/30 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Fonctionnalités</h2>
            <p className="text-muted-foreground mt-3 text-lg">Tout ce qu&apos;il faut pour créer des clips qui explosent</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((feat) => (
              <Card key={feat.title} className="bg-card/60 border-border hover:border-primary/20 transition-colors">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                    <feat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{feat.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feat.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Tarifs simples</h2>
            <p className="text-muted-foreground mt-3 text-lg">Commencez gratuitement, upgradez quand vous voulez</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className={cn(
                  'relative flex flex-col bg-card/60 border-border transition-all duration-200',
                  plan.highlighted && 'border-primary/40 shadow-lg shadow-primary/5 scale-[1.02]',
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      Populaire
                    </span>
                  </div>
                )}

                <CardHeader className="pb-3 pt-6">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-black text-foreground">{plan.price}</span>
                    <CardDescription>{plan.priceNote}</CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </CardContent>

                <CardFooter className="pt-4">
                  <Link href="/signup" className="w-full">
                    <Button
                      size="sm"
                      className={cn(
                        'w-full',
                        plan.highlighted
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                          : ''
                      )}
                      variant={plan.highlighted ? 'default' : 'outline'}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Scissors className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              VIRAL STUDIO
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">Se connecter</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Créer un compte</Link>
          </div>
          <p className="text-xs text-muted-foreground/50">
            &copy; {new Date().getFullYear()} Viral Studio Pro
          </p>
        </div>
      </footer>
    </div>
  )
}
