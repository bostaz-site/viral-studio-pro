"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { Scissors, Sparkles, TrendingUp, Check, Subtitles, MonitorPlay, ArrowRight, Play, Star, Users, Film, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Animated section wrapper
function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Animated counter hook
function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, target, duration])

  return { count, ref }
}

function StatsCounter() {
  const clips = useCountUp(12847)
  const creators = useCountUp(2340)

  return (
    <div ref={clips.ref} className="flex flex-wrap items-center justify-center gap-8 mt-12 pt-8 border-t border-border/20">
      <div className="flex items-center gap-2">
        <Film className="h-5 w-5 text-blue-400" />
        <div className="text-left">
          <p className="text-2xl font-black text-foreground">{clips.count.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-muted-foreground">clips créés</p>
        </div>
      </div>
      <div ref={creators.ref} className="flex items-center gap-2">
        <Users className="h-5 w-5 text-indigo-400" />
        <div className="text-left">
          <p className="text-2xl font-black text-foreground">{creators.count.toLocaleString('fr-FR')}+</p>
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
  )
}

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


const FEATURES = [
  {
    icon: Subtitles,
    title: 'Sous-titres karaoké',
    description: '9 styles de captions animés mot par mot — Hormozi, MrBeast, Gaming, Minimal et plus. Le format qui fait x3 sur la rétention TikTok.',
  },
  {
    icon: MonitorPlay,
    title: 'Split-screen automatique',
    description: 'Combine ton clip de stream en haut avec Subway Surfers, Minecraft parkour ou autre vidéo satisfaisante en bas. Le format signature qui n\'existe nulle part ailleurs.',
  },
  {
    icon: TrendingUp,
    title: 'Score viral IA',
    description: 'Claude IA analyse chaque clip et attribue un score 0-100 avec une explication détaillée : hook, rétention, émotion. Tu sais exactement quel clip va performer.',
  },
  {
    icon: Sparkles,
    title: 'Remake This',
    description: 'Tu vois un clip trending ? Clique "Remake" et l\'IA adapte le format, les sous-titres et le style à ton propre contenu. Inspire-toi des meilleurs sans copier.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Lucas "Zephyr" Martin',
    handle: '@zephyr_clips',
    handleUrl: 'https://www.tiktok.com/@zephyr_clips',
    platform: 'TikTok',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Lucas&backgroundColor=b6e3f4',
    color: 'from-purple-500 to-pink-500',
    quote: 'Avant Viral Studio, personne regardait mes clips. J\'ai commencé à poster avec le split-screen Subway Surfers et les sous-titres karaoké — en 2 mois j\'étais à 45K. C\'est devenu ma routine : je stream, je clippe, je poste.',
    stats: '45K followers en 2 mois',
    rating: 5,
  },
  {
    name: 'Sarah Chen',
    handle: '@sarahplays_',
    handleUrl: 'https://www.instagram.com/sarahplays_',
    platform: 'Instagram',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Sarah&backgroundColor=ffd5dc',
    color: 'from-blue-500 to-cyan-500',
    quote: 'Je suis streameuse Valorant et je détestais passer 2h à éditer un seul clip. Maintenant j\'en fais 5 en 30 min et mes Reels font 10 fois plus de vues qu\'avant. Le gain de temps est juste dingue.',
    stats: '10x plus de vues',
    rating: 5,
  },
  {
    name: 'Théo Dubois',
    handle: '@theo_gaming',
    handleUrl: 'https://www.youtube.com/@theo_gaming',
    platform: 'YouTube',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Theo&backgroundColor=c0aede',
    color: 'from-red-500 to-orange-500',
    quote: 'Le truc qui m\'a scotché c\'est le score viral. Il m\'a sorti un moment dans mon stream que j\'avais même pas remarqué — 120K vues. Depuis je laisse l\'IA choisir mes clips et ça marche mieux que quand je le fais moi-même.',
    stats: '120K vues sur un clip',
    rating: 4,
  },
  {
    name: 'Emma "Pixel" Roy',
    handle: '@pixelstreams',
    handleUrl: 'https://www.tiktok.com/@pixelstreams',
    platform: 'TikTok',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Emma&backgroundColor=d1f4d1',
    color: 'from-emerald-500 to-teal-500',
    quote: 'J\'ai testé OpusClip, Eklipse, tout. Aucun ne fait le split-screen automatique. Avec Viral Studio mes clips Minecraft avec mes réactions en haut cartonnent — c\'est devenu mon format signature.',
    stats: '200K vues moyennes',
    rating: 5,
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

const FAQ_ITEMS = [
  {
    q: 'Comment fonctionnent les crédits ?',
    a: 'Chaque clip consommé coûte environ 3 crédits. Avec les 90 crédits offerts sur le plan Free, vous pouvez créer environ 30 clips complets. Les crédits n\'expirent pas tant que votre compte est actif.',
  },
  {
    q: 'Quels formats de clips puis-je exporter ?',
    a: 'Vous pouvez exporter en 9:16 (TikTok, Reels, Shorts), 1:1 (feed Instagram) et 16:9 (YouTube). Le plan Free est limité au 9:16, les plans Pro et Studio supportent les 3 formats.',
  },
  {
    q: 'Comment fonctionne le split-screen automatique ?',
    a: 'Vous choisissez une vidéo satisfaisante (Subway Surfers, Minecraft parkour, etc.) et l\'outil combine automatiquement votre clip de stream en haut avec la vidéo en bas, au format 9:16 vertical. C\'est le format qui génère le plus de rétention sur TikTok.',
  },
  {
    q: 'Twitch et YouTube Gaming sont-ils les seules plateformes supportées ?',
    a: 'Pour l\'instant, nous supportons les clips Twitch et YouTube Gaming. Vous pouvez aussi uploader directement vos propres vidéos (MP4, MOV, WebM). Le support Kick et d\'autres plateformes arrive bientôt.',
  },
  {
    q: 'Faut-il installer un logiciel ?',
    a: 'Non. Viral Studio Pro fonctionne entièrement dans votre navigateur. Aucune installation requise, aucun logiciel à télécharger. Il vous suffit de créer un compte et de commencer à clipper.',
  },
]

function StickyBar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
      // Show after 25% scroll, hide near pricing (bottom 20%)
      setVisible(scrollPercent > 0.25 && scrollPercent < 0.8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/50 py-2.5 px-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground hidden sm:block">
          <span className="font-semibold text-foreground">30 clips offerts</span> · Sans carte bancaire
        </p>
        <Link href="/signup">
          <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold gap-1.5 h-9 px-6">
            Commencer gratuitement
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

export function LandingPage() {
  // Inject FAQ structured data
  useEffect(() => {
    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    }
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(faqJsonLd)
    script.id = 'faq-jsonld'
    document.head.appendChild(script)
    return () => { document.getElementById('faq-jsonld')?.remove() }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StickyBar />
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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-400 mb-8">
            <MonitorPlay className="h-3.5 w-3.5" />
            Le seul outil avec split-screen automatique
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1]">
            Clips viraux en{' '}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              split-screen
            </span>{' '}
            depuis tes streams
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
            Stream + Subway Surfers/Minecraft en bas + sous-titres karaoké = la formule qui explose sur TikTok. Le seul outil qui fait ça automatiquement à partir de Twitch et YouTube Gaming.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 h-12 px-8 text-base font-semibold gap-2">
                Essayer gratuitement — 30 clips offerts
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4">
            Pas de carte bancaire requise · Prêt en 30 secondes
          </p>

          {/* Animated phone demo */}
          <div className="mt-12 flex justify-center">
            <div className="relative w-[200px] sm:w-[240px]">
              {/* Phone frame */}
              <div className="rounded-[2rem] border-2 border-border/60 bg-gray-900 p-2 shadow-2xl shadow-blue-500/10">
                <div className="rounded-[1.5rem] overflow-hidden bg-black relative" style={{ aspectRatio: '9/16' }}>
                  {/* Top: stream clip area */}
                  <div className="absolute inset-x-0 top-0 h-[60%] bg-gradient-to-br from-indigo-900/60 to-purple-900/50 flex items-center justify-center">
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[9px] font-bold text-white/80">LIVE</span>
                    </div>
                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      <span className="text-[8px] text-white/40">xQc</span>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <Play className="h-5 w-5 text-white/30 ml-0.5" />
                    </div>
                  </div>

                  {/* Karaoke subtitles — animated */}
                  <div className="absolute top-[52%] left-1/2 -translate-x-1/2 z-10 bg-black/80 rounded-xl px-3 py-1.5 backdrop-blur-sm">
                    <p className="text-[11px] sm:text-xs font-black text-center whitespace-nowrap">
                      <span className="text-yellow-400 animate-pulse" style={{ animationDelay: '0s', animationDuration: '2s' }}>C&apos;est</span>{' '}
                      <span className="text-yellow-400 animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '2s' }}>tellement</span>{' '}
                      <span className="text-white animate-pulse" style={{ animationDelay: '0.6s', animationDuration: '2s' }}>INCROYABLE</span>
                    </p>
                  </div>

                  {/* Divider line */}
                  <div className="absolute top-[60%] inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

                  {/* Bottom: satisfying video */}
                  <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-br from-emerald-900/40 to-teal-900/30 flex items-center justify-center">
                    <div className="text-center">
                      <div className="flex items-center gap-1 justify-center mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '0.15s' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '0.3s' }} />
                      </div>
                      <span className="text-[9px] text-emerald-400/70 font-medium">Subway Surfers</span>
                    </div>
                  </div>

                  {/* Score overlay */}
                  <div className="absolute bottom-3 right-3 bg-black/70 rounded-lg px-2 py-1 backdrop-blur-sm border border-emerald-500/30">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-400">92</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating labels — hidden below lg */}
              <div className="absolute -left-28 top-[15%] hidden lg:flex items-center gap-2 opacity-60">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Stream Twitch</span>
                <div className="w-6 h-px bg-border" />
              </div>
              <div className="absolute -left-32 top-[55%] hidden lg:flex items-center gap-2 opacity-60">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Sous-titres karaoké</span>
                <div className="w-6 h-px bg-border" />
              </div>
              <div className="absolute -right-32 top-[75%] hidden lg:flex items-center gap-2 opacity-60">
                <div className="w-6 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Vidéo satisfaisante</span>
              </div>
              <div className="absolute -right-20 top-[92%] hidden lg:flex items-center gap-2 opacity-60">
                <div className="w-4 h-px bg-border" />
                <span className="text-[10px] text-emerald-400 font-medium">Score 92</span>
              </div>
            </div>
          </div>

          {/* Pain point */}
          <p className="text-sm text-muted-foreground/70 mt-10 italic max-w-lg mx-auto">
            Tu passes des heures à streamer. Tes meilleurs moments restent enterrés sur Twitch à 12 viewers. C&apos;est terminé.
          </p>

          {/* Stats counter — animated */}
          <StatsCounter />

          {/* Live activity indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-muted-foreground/60">47 clips créés dans les dernières 24h</span>
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
        <AnimatedSection className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Avant / Après</h2>
            <p className="text-muted-foreground mt-3 text-lg">Un moment de stream brut devient un clip viral optimisé</p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
            {/* Before — 16:9 horizontal */}
            <div className="relative w-full max-w-sm">
              <div className="absolute -top-3 left-4 z-10">
                <span className="bg-red-500/90 text-white text-xs font-bold px-3 py-1 rounded-full">AVANT</span>
              </div>
              <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
                  <div className="text-center z-10">
                    <div className="w-14 h-14 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-2">
                      <Play className="h-6 w-6 text-gray-500 ml-0.5" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Stream brut — 16:9</p>
                    <p className="text-xs text-gray-600 mt-1">3h47 de stream complet</p>
                  </div>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2"><span className="text-gray-500">Format :</span><span className="text-gray-400">16:9 horizontal</span></div>
                  <div className="flex items-center gap-2"><span className="text-gray-500">Sous-titres :</span><span className="text-red-400">Aucun</span></div>
                  <div className="flex items-center gap-2"><span className="text-gray-500">Score viral :</span><span className="text-red-400">N/A</span></div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex flex-col items-center gap-2">
              <ArrowRight className="h-8 w-8 text-primary/40" />
              <span className="text-[10px] text-muted-foreground/40 font-medium">5 min</span>
            </div>
            <div className="md:hidden flex items-center gap-2">
              <ChevronDown className="h-6 w-6 text-primary/40" />
            </div>

            {/* After — 9:16 vertical phone mockup */}
            <div className="relative">
              <div className="absolute -top-3 left-4 z-10">
                <span className="bg-emerald-500/90 text-white text-xs font-bold px-3 py-1 rounded-full">APRÈS</span>
              </div>
              <div className="w-[180px] sm:w-[200px] rounded-[2rem] border-2 border-emerald-500/30 bg-gray-900 p-2 shadow-2xl shadow-emerald-500/10">
                <div className="rounded-[1.5rem] overflow-hidden bg-black relative" style={{ aspectRatio: '9/16' }}>
                  {/* Top: stream clip */}
                  <div className="absolute inset-x-0 top-0 h-[60%] bg-gradient-to-br from-indigo-900/50 to-purple-900/40 flex items-center justify-center">
                    <div className="absolute top-3 left-3 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span className="text-[8px] font-bold text-white/70">LIVE</span>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-blue-300/80 font-medium">Clip du stream</p>
                    </div>
                    {/* Karaoke subtitle */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 rounded-lg px-2.5 py-1">
                      <p className="text-[9px] font-bold whitespace-nowrap">
                        <span className="text-yellow-400">C&apos;est</span>{' '}
                        <span className="text-yellow-400">absolument</span>{' '}
                        <span className="text-white">INCROYABLE</span>
                      </p>
                    </div>
                  </div>
                  {/* Divider */}
                  <div className="absolute top-[60%] inset-x-0 h-0.5 bg-blue-500/30" />
                  {/* Bottom: satisfying video */}
                  <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-br from-emerald-900/30 to-teal-900/20 flex items-center justify-center">
                    <span className="text-[9px] text-emerald-400/60 font-medium">Subway Surfers</span>
                  </div>
                  {/* Score */}
                  <div className="absolute bottom-2 right-2 bg-black/60 rounded-md px-1.5 py-0.5 border border-emerald-500/30">
                    <span className="text-[9px] font-bold text-emerald-400">87</span>
                  </div>
                </div>
              </div>
              {/* Labels */}
              <div className="mt-3 space-y-1.5 text-xs pl-2">
                <div className="flex items-center gap-2"><span className="text-gray-500">Format :</span><span className="text-emerald-400">9:16 TikTok ready</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-500">Sous-titres :</span><span className="text-emerald-400">Karaoké MrBeast</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-500">Split-screen :</span><span className="text-emerald-400">Subway Surfers</span></div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Score :</span>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-16 rounded-full bg-gray-700 overflow-hidden">
                      <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-emerald-500 to-green-400" />
                    </div>
                    <span className="text-xs font-bold text-emerald-400">87/100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* How it works — with mockups */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Comment ça marche</h2>
            <p className="text-muted-foreground mt-3 text-lg">3 étapes pour créer un clip viral</p>
          </div>

          <div className="space-y-16">
            {/* Step 1 — Browse clips */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="inline-block text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Étape 1</span>
                <h3 className="text-2xl font-bold text-foreground mb-3">Choisis un clip de stream</h3>
                <p className="text-muted-foreground leading-relaxed">Parcours les meilleurs moments Twitch et YouTube Gaming triés par score viral. L&apos;IA identifie automatiquement les moments les plus engageants.</p>
              </div>
              {/* Mockup: trending dashboard */}
              <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden shadow-lg">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 bg-card/80">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  <span className="text-[10px] text-muted-foreground/50 ml-2">Streams — Viral Studio Pro</span>
                </div>
                <div className="p-3 space-y-2">
                  {/* Search bar mockup */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/30">
                    <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                    <span className="text-[10px] text-muted-foreground/50">Rechercher un streamer ou un jeu...</span>
                  </div>
                  {/* Clip cards */}
                  {[
                    { name: 'xQc', game: 'Just Chatting', score: 92, color: 'from-purple-500/20 to-purple-600/10' },
                    { name: 'Sardoche', game: 'League of Legends', score: 87, color: 'from-blue-500/20 to-blue-600/10' },
                    { name: 'Kamet0', game: 'Valorant', score: 78, color: 'from-emerald-500/20 to-emerald-600/10' },
                  ].map((clip) => (
                    <div key={clip.name} className={cn('flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r', clip.color)}>
                      <div className="w-14 h-9 rounded bg-gray-800 shrink-0 flex items-center justify-center">
                        <Play className="h-3 w-3 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-foreground truncate">{clip.name} — {clip.game}</p>
                        <p className="text-[8px] text-muted-foreground">il y a 2h · 45s</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-1 w-8 rounded-full bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${clip.score}%` }} />
                        </div>
                        <span className="text-[9px] font-bold text-emerald-400">{clip.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2 — Edit */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Mockup: editor */}
              <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden shadow-lg md:order-1 order-2">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 bg-card/80">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  <span className="text-[10px] text-muted-foreground/50 ml-2">Éditeur — Viral Studio Pro</span>
                </div>
                <div className="p-3 flex gap-3">
                  {/* Preview */}
                  <div className="w-24 shrink-0">
                    <div className="aspect-[9/16] rounded-lg bg-gradient-to-b from-indigo-900/30 to-gray-900 border border-border/30 relative overflow-hidden">
                      <div className="absolute inset-x-0 top-0 h-[60%] bg-gradient-to-br from-purple-900/40 to-indigo-900/40 flex items-center justify-center">
                        <span className="text-[7px] text-blue-300/60">Stream</span>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-br from-emerald-900/30 to-teal-900/30 flex items-center justify-center border-t border-blue-500/20">
                        <span className="text-[7px] text-emerald-400/60">Subway Surfers</span>
                      </div>
                      <div className="absolute bottom-[42%] left-1/2 -translate-x-1/2 bg-black/70 rounded px-1.5 py-0.5">
                        <span className="text-[6px] font-bold text-yellow-400">Incroyable!</span>
                      </div>
                    </div>
                  </div>
                  {/* Controls */}
                  <div className="flex-1 space-y-2">
                    <div className="space-y-1">
                      <span className="text-[8px] text-muted-foreground/60 uppercase tracking-wider">Style sous-titres</span>
                      <div className="grid grid-cols-3 gap-1">
                        {['Hormozi', 'MrBeast', 'Gaming'].map((s) => (
                          <div key={s} className={cn('text-[7px] text-center py-1 rounded border', s === 'MrBeast' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/30 text-muted-foreground/50')}>
                            {s}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] text-muted-foreground/60 uppercase tracking-wider">Split-screen</span>
                      <div className="grid grid-cols-2 gap-1">
                        {['Subway Surfers', 'Minecraft'].map((s) => (
                          <div key={s} className={cn('text-[7px] text-center py-1 rounded border', s === 'Subway Surfers' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-border/30 text-muted-foreground/50')}>
                            {s}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Timeline mockup */}
                    <div className="pt-1">
                      <div className="h-3 rounded bg-muted/30 relative overflow-hidden">
                        <div className="absolute left-[10%] right-[30%] top-0 bottom-0 bg-blue-500/20 border-x-2 border-blue-500/50 rounded" />
                        <div className="absolute left-[35%] top-0 bottom-0 w-0.5 bg-white/60" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="md:order-2 order-1">
                <span className="inline-block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Étape 2</span>
                <h3 className="text-2xl font-bold text-foreground mb-3">Personnalise ton clip</h3>
                <p className="text-muted-foreground leading-relaxed">Sous-titres karaoké (9 styles), split-screen avec vidéo satisfaisante, et analyse IA du score viral. Tout se configure en quelques clics.</p>
              </div>
            </div>

            {/* Step 3 — Export */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="inline-block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Étape 3</span>
                <h3 className="text-2xl font-bold text-foreground mb-3">Exporte et publie</h3>
                <p className="text-muted-foreground leading-relaxed">Télécharge en 9:16 optimisé TikTok/Reels/Shorts ou publie directement sur tes plateformes. Ton clip est prêt en moins de 5 minutes.</p>
              </div>
              {/* Mockup: export */}
              <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden shadow-lg">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 bg-card/80">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  <span className="text-[10px] text-muted-foreground/50 ml-2">Export — Viral Studio Pro</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">clip_xqc_viral_87.mp4</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Prêt</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { platform: 'TikTok', color: 'border-foreground/20 text-foreground/70' },
                      { platform: 'Reels', color: 'border-pink-500/30 text-pink-400' },
                      { platform: 'Shorts', color: 'border-red-500/30 text-red-400' },
                    ].map((p) => (
                      <div key={p.platform} className={cn('text-center py-2 rounded-lg border text-[10px] font-medium', p.color)}>
                        {p.platform}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-medium text-center">
                      Télécharger MP4
                    </div>
                    <div className="flex-1 py-1.5 rounded-lg border border-border/30 text-[10px] font-medium text-center text-muted-foreground">
                      Publier
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mid-page CTA */}
          <div className="text-center mt-16 pt-10 border-t border-border/20">
            <p className="text-muted-foreground mb-4">Prêt à créer ton premier clip split-screen ?</p>
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 h-11 px-8 font-semibold gap-2">
                Créer mon compte gratuit
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground/50 mt-3">90 crédits offerts = ~30 clips complets</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-card/30 border-t border-border/30">
        <AnimatedSection className="max-w-5xl mx-auto">
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
        </AnimatedSection>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 border-t border-border/30">
        <AnimatedSection className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ils créent des clips viraux avec nous</h2>
            <p className="text-muted-foreground mt-3 text-lg">Rejoins +2,340 créateurs qui explosent sur les réseaux</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t) => (
              <Card key={t.handle} className="bg-card/60 border-border hover:border-primary/20 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.photoUrl}
                      alt={t.name}
                      className="w-10 h-10 rounded-full shrink-0 bg-muted"
                      width={40}
                      height={40}
                    />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{t.name}</p>
                      <span className="text-xs text-primary">
                        {t.handle}
                      </span>
                      <span className="text-xs text-muted-foreground"> · {t.platform}</span>
                    </div>
                  </div>
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={cn('h-3.5 w-3.5', i < t.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-muted text-muted')} />
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

          {/* Post-testimonials CTA */}
          <div className="text-center mt-12">
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 h-11 px-8 font-semibold gap-2">
                Rejoindre +2,340 créateurs
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </AnimatedSection>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-card/30 border-t border-border/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Questions fréquentes</h2>
            <p className="text-muted-foreground mt-3 text-lg">Tout ce que tu dois savoir avant de commencer</p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <details key={i} className="group rounded-xl border border-border bg-card/60 overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer px-6 py-4 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors list-none">
                  {item.q}
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </div>
              </details>
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
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      Populaire
                    </span>
                    <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                      Prix de lancement
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
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Scissors className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                  VIRAL STUDIO
                </span>
              </div>
              <p className="text-xs text-muted-foreground/70 leading-relaxed max-w-sm">
                Crée des clips viraux à partir de streams Twitch et YouTube Gaming. Sous-titres karaoké, split-screen et score viral IA.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Produit</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <Link href="/signup" className="block hover:text-foreground transition-colors">Créer un compte</Link>
                <Link href="/login" className="block hover:text-foreground transition-colors">Se connecter</Link>
                <Link href="/pricing" className="block hover:text-foreground transition-colors">Tarifs</Link>
              </div>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Légal</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <Link href="/privacy" className="block hover:text-foreground transition-colors">Confidentialité</Link>
                <Link href="/terms" className="block hover:text-foreground transition-colors">Conditions d&apos;utilisation</Link>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground/50">
              &copy; {new Date().getFullYear()} Viral Studio Pro — Fait avec passion par Samy
            </p>
            <p className="text-xs text-muted-foreground/40">
              Propulsé par Claude IA, Supabase et FFmpeg
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
