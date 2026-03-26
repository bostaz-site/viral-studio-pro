"use client"

import Link from 'next/link'
import { Scissors, Zap, Sparkles, TrendingUp, Check, Clapperboard, Subtitles, MonitorPlay, ArrowRight, Play, Star, Users, Film } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Platform logo SVG components
function TwitchLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
    </svg>
  )
}

function YouTubeLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

function TikTokLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  )
}

function InstagramLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  )
}

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

const TESTIMONIALS = [
  {
    name: 'Lucas "Zephyr" Martin',
    handle: '@zephyr_clips',
    platform: 'TikTok',
    avatar: 'LM',
    color: 'from-purple-500 to-pink-500',
    quote: 'J\'ai gagné 45K followers en 2 mois juste en clippant mes streams avec Viral Studio. Le split-screen Subway Surfers fait x3 sur la rétention.',
    stats: '45K followers en 2 mois',
  },
  {
    name: 'Sarah Chen',
    handle: '@sarahplays_',
    platform: 'Instagram',
    avatar: 'SC',
    color: 'from-blue-500 to-cyan-500',
    quote: 'Avant je passais 2h par clip. Maintenant c\'est 5 minutes. Les sous-titres karaoké sont parfaits, mes Reels font 10x plus de vues.',
    stats: '10x plus de vues',
  },
  {
    name: 'Théo Dubois',
    handle: '@theo_gaming',
    platform: 'YouTube',
    avatar: 'TD',
    color: 'from-red-500 to-orange-500',
    quote: 'Le score viral IA est bluffant. Il a identifié des moments dans mes streams que j\'aurais jamais pensé clipper et c\'est devenu mes vidéos les plus vues.',
    stats: '120K vues sur un clip',
  },
  {
    name: 'Emma "Pixel" Roy',
    handle: '@pixelstreams',
    platform: 'TikTok',
    avatar: 'ER',
    color: 'from-emerald-500 to-teal-500',
    quote: 'L\'outil de split-screen est game-changer. Personne d\'autre ne propose ça. Mes clips Minecraft en split-screen avec mes réactions cartonnent.',
    stats: '200K vues moyennes',
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

          {/* Stats counter */}
          <div className="flex flex-wrap items-center justify-center gap-8 mt-12 pt-8 border-t border-border/20">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-blue-400" />
              <div className="text-left">
                <p className="text-2xl font-black text-foreground">12,847</p>
                <p className="text-xs text-muted-foreground">clips créés</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              <div className="text-left">
                <p className="text-2xl font-black text-foreground">2,340+</p>
                <p className="text-xs text-muted-foreground">créateurs actifs</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <div className="text-left">
                <p className="text-2xl font-black text-foreground">x8.5</p>
                <p className="text-xs text-muted-foreground">vues en moyenne</p>
              </div>
            </div>
          </div>

          {/* Platform logos */}
          <div className="mt-10">
            <p className="text-xs text-muted-foreground/50 uppercase tracking-wider mb-4">Compatible avec</p>
            <div className="flex items-center justify-center gap-8">
              <div className="flex items-center gap-2 text-muted-foreground/40 hover:text-purple-400 transition-colors">
                <TwitchLogo className="h-6 w-6" />
                <span className="text-sm font-medium">Twitch</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground/40 hover:text-red-400 transition-colors">
                <YouTubeLogo className="h-6 w-6" />
                <span className="text-sm font-medium">YouTube</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground/40 hover:text-foreground transition-colors">
                <TikTokLogo className="h-6 w-6" />
                <span className="text-sm font-medium">TikTok</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground/40 hover:text-pink-400 transition-colors">
                <InstagramLogo className="h-6 w-6" />
                <span className="text-sm font-medium">Instagram</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Avant / Après</h2>
            <p className="text-muted-foreground mt-3 text-lg">Un moment de stream brut devient un clip viral optimisé</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Before */}
            <div className="relative">
              <div className="absolute -top-3 left-4 z-10">
                <span className="bg-red-500/90 text-white text-xs font-bold px-3 py-1 rounded-full">AVANT</span>
              </div>
              <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
                  <div className="text-center z-10">
                    <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-3">
                      <Play className="h-8 w-8 text-gray-500 ml-1" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Stream brut — 16:9</p>
                    <p className="text-xs text-gray-600 mt-1">3h47 de stream complet</p>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Format :</span>
                    <span className="text-xs text-gray-400">16:9 horizontal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Sous-titres :</span>
                    <span className="text-xs text-red-400">Aucun</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Score viral :</span>
                    <span className="text-xs text-red-400">N/A</span>
                  </div>
                </div>
              </div>
            </div>

            {/* After */}
            <div className="relative">
              <div className="absolute -top-3 left-4 z-10">
                <span className="bg-emerald-500/90 text-white text-xs font-bold px-3 py-1 rounded-full">APRES</span>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-card/40 overflow-hidden shadow-lg shadow-emerald-500/5">
                <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
                  {/* Split screen mockup */}
                  <div className="absolute inset-0 flex flex-col">
                    {/* Top: stream clip */}
                    <div className="flex-1 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 flex items-center justify-center border-b-2 border-blue-500/30 relative">
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">LIVE</div>
                      <div className="text-center">
                        <p className="text-xs text-blue-300 font-medium">Clip du stream</p>
                        <p className="text-[10px] text-blue-400/60">Moment viral détecté par l&apos;IA</p>
                      </div>
                      {/* Karaoke subtitle mockup */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 rounded-lg px-3 py-1">
                        <p className="text-[10px] font-bold">
                          <span className="text-yellow-400">C&apos;est</span>{' '}
                          <span className="text-yellow-400">absolument</span>{' '}
                          <span className="text-white">incroyable</span>{' '}
                          <span className="text-white/50">ce qui</span>
                        </p>
                      </div>
                    </div>
                    {/* Bottom: satisfying video */}
                    <div className="h-[35%] bg-gradient-to-br from-emerald-900/30 to-teal-900/30 flex items-center justify-center">
                      <p className="text-[10px] text-emerald-400/60 font-medium">Subway Surfers / Minecraft</p>
                    </div>
                  </div>
                  {/* 9:16 frame overlay */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-10 border border-emerald-500/40 rounded-sm flex items-center justify-center">
                    <span className="text-[6px] text-emerald-500/60">9:16</span>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Format :</span>
                    <span className="text-xs text-emerald-400">9:16 vertical (TikTok ready)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Sous-titres :</span>
                    <span className="text-xs text-emerald-400">Karaoké animé (style MrBeast)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Score viral :</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-20 rounded-full bg-gray-700 overflow-hidden">
                        <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-emerald-500 to-green-400" />
                      </div>
                      <span className="text-xs font-bold text-emerald-400">87/100</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Split-screen :</span>
                    <span className="text-xs text-emerald-400">Subway Surfers (auto)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

      {/* Testimonials */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ils créent des clips viraux avec nous</h2>
            <p className="text-muted-foreground mt-3 text-lg">Rejoins +2,300 créateurs qui explosent sur les réseaux</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t) => (
              <Card key={t.handle} className="bg-card/60 border-border hover:border-primary/20 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 text-white text-xs font-bold', t.color)}>
                      {t.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.handle} · {t.platform}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">{t.stats}</span>
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
