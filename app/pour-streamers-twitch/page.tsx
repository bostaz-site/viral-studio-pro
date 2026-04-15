import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Play,
  Sparkles,
  Scissors,
  Type,
  Layers,
  Zap,
  Clock,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageViewTracker } from '@/components/analytics/page-view-tracker'

export const metadata: Metadata = {
  title: 'Clips Twitch viraux — transforme tes meilleurs moments en TikToks',
  description:
    'Viral Studio Pro découpe automatiquement tes streams Twitch en clips verticaux 9:16 avec sous-titres karaoké, split-screen et score viral. Essai gratuit — 3 clips/mois sans carte.',
  keywords: [
    'clips twitch viraux',
    'twitch clip tiktok',
    'clip twitch vertical',
    'sous-titres twitch clip',
    'split-screen twitch',
    'streamer clips viraux',
    'clips twitch reels',
    'faire des clips twitch',
    'meilleurs moments twitch',
    'clipping twitch automatique',
  ],
  openGraph: {
    title: 'Clips Twitch viraux — Viral Studio Pro',
    description:
      'Transforme tes streams Twitch en clips TikTok / Reels / Shorts en 5 minutes.',
    url: 'https://viral-studio-pro.netlify.app/pour-streamers-twitch',
  },
  alternates: {
    canonical: 'https://viral-studio-pro.netlify.app/pour-streamers-twitch',
  },
}

// ─── Pain / solution data ────────────────────────────────────────────────────

const PAINS = [
  {
    pain: 'Tu streames 4h et personne voit tes meilleurs moments',
    solution: 'On détecte les pics automatiquement et on découpe le clip prêt à poster',
    icon: Clock,
  },
  {
    pain: 'Tes clips sont en 16:9, TikTok/Reels veut du 9:16',
    solution: 'Reframe vertical automatique — le sujet reste toujours centré',
    icon: Layers,
  },
  {
    pain: 'Pas le temps de faire des sous-titres à la main',
    solution: 'Sous-titres karaoké mot-par-mot, 9 styles disponibles, appliqués en 1 clic',
    icon: Type,
  },
  {
    pain: 'Les viewers scrollent si les 2 premières secondes sont plates',
    solution: 'Split-screen gameplay (Subway Surfers, Minecraft) pour doubler la rétention dès la seconde 1',
    icon: TrendingUp,
  },
]

const STEPS = [
  {
    step: '1',
    title: 'Choisis ton clip Twitch',
    description:
      'Browse notre bibliothèque de clips tendance ou uploade ton propre clip directement depuis Twitch.',
    icon: Play,
  },
  {
    step: '2',
    title: 'Booste la viralité',
    description:
      'Sous-titres karaoké, split-screen, score viral IA. Tout se configure dans un seul éditeur visuel.',
    icon: Sparkles,
  },
  {
    step: '3',
    title: 'Exporte et publie',
    description:
      'Télécharge ta vidéo 9:16 optimisée. Poste-la sur TikTok, Reels, Shorts — le clip est techniquement neuf.',
    icon: Scissors,
  },
]

const NICHES = [
  { name: 'FPS', examples: 'Valorant, CS2, Apex', icon: '🎯' },
  { name: 'MOBA', examples: 'LoL, Dota 2', icon: '⚔️' },
  { name: 'Battle Royale', examples: 'Fortnite, Warzone', icon: '🪂' },
  { name: 'IRL / Just Chatting', examples: 'Réactions, drama, debates', icon: '🎙️' },
  { name: 'Speedrun', examples: 'GDQ moments, WR splits', icon: '⏱️' },
  { name: 'Horreur', examples: 'Jump scares, co-op panic', icon: '👻' },
]

// ─── Component ───────────────────────────────────────────────────────────────

function TwitchLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
    </svg>
  )
}

export default function PourStreamersTwitchPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Clips Twitch viraux — Viral Studio Pro',
    description:
      'Transforme tes streams Twitch en clips TikTok / Reels / Shorts optimisés pour la viralité.',
    url: 'https://viral-studio-pro.netlify.app/pour-streamers-twitch',
    mainEntity: {
      '@type': 'SoftwareApplication',
      name: 'Viral Studio Pro',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageViewTracker event="page_view" />

      {/* Nav */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent"
          >
            VIRAL STUDIO
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/demo">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Play className="h-3.5 w-3.5" />
                Démo
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="gap-1.5">
                Essai gratuit
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-20 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-950/20 via-transparent to-transparent" />
        <div className="absolute top-10 left-1/3 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/5 text-xs font-semibold mb-6">
            <TwitchLogo className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-purple-300">Optimisé pour les streamers Twitch</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-5">
            Tes meilleurs moments Twitch méritent{' '}
            <span className="bg-gradient-to-r from-purple-400 to-violet-500 bg-clip-text text-transparent">
              des millions de vues
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            Viral Studio Pro transforme tes clips Twitch en vidéos verticales TikTok-ready
            avec sous-titres karaoké, split-screen et score viral — en moins de 5 minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-lg shadow-purple-500/25 h-12 px-8 text-base font-bold gap-2"
              >
                Commencer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button variant="ghost" size="lg" className="h-12 px-6 text-base text-muted-foreground hover:text-foreground gap-2">
                <Play className="h-4 w-4" />
                Voir la démo live
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4">
            3 clips/mois gratuits — sans carte bancaire — annulable en 1 clic
          </p>
        </div>
      </section>

      {/* Pain → Solution */}
      <section className="py-16 px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tight">
              Le problème, c&apos;est pas ton stream
            </h2>
            <p className="text-muted-foreground mt-2 text-lg">
              C&apos;est le format. Voilà ce qu&apos;on résout.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {PAINS.map((p) => (
              <div
                key={p.pain}
                className="rounded-xl border border-border bg-card/40 p-6 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-red-500/10 p-2 text-red-400">
                    <p.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-300/90">{p.pain}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 pl-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{p.solution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 border-t border-border/30 bg-card/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tight">
              3 étapes. 5 minutes. Clip prêt.
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-violet-500/10 flex items-center justify-center mb-4 border border-purple-500/20">
                  <s.icon className="h-5 w-5 text-purple-400" />
                </div>
                <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">
                  Étape {s.step}
                </p>
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Niches */}
      <section className="py-16 px-6 border-t border-border/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black tracking-tight">
              Ça marche pour ta niche
            </h2>
            <p className="text-muted-foreground mt-2">
              Que tu streames du ranked, du Just Chatting ou du speedrun.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NICHES.map((n) => (
              <div
                key={n.name}
                className="rounded-lg border border-border bg-card/40 px-4 py-3.5 flex items-center gap-3"
              >
                <span className="text-2xl">{n.icon}</span>
                <div>
                  <p className="font-bold text-sm">{n.name}</p>
                  <p className="text-[11px] text-muted-foreground">{n.examples}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features recap */}
      <section className="py-16 px-6 border-t border-border/30 bg-card/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black tracking-tight">
              Tout ce dont tu as besoin pour clipper
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Type, title: 'Sous-titres karaoké', desc: '9 styles, mot-par-mot, positionnés automatiquement' },
              { icon: Layers, title: 'Split-screen', desc: 'Gameplay satisfaisant en bas (Subway Surfers, Minecraft, Parkour)' },
              { icon: Sparkles, title: 'Score viral IA', desc: 'Score 0-100 qui prédit le potentiel de rétention du clip' },
              { icon: Zap, title: 'Rendu 9:16 instant', desc: 'Format vertical TikTok / Reels / Shorts en 1 clic' },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-4"
              >
                <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-sm">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-link to YouTube landing */}
      <section className="py-12 px-6 border-t border-border/30">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-muted-foreground mb-2">Tu publies aussi sur YouTube ?</p>
          <Link href="/pour-clippeurs-youtube" className="text-sm text-primary hover:underline font-semibold">
            Voir notre page dédiée aux clippeurs YouTube →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Prêt à faire exploser tes clips ?
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            3 clips par mois offerts. Commence maintenant, sans carte bancaire, en 30 secondes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white h-12 px-8 text-base font-bold gap-2"
              >
                Commencer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="ghost" size="lg" className="h-12 px-6 text-base text-muted-foreground gap-2">
                Voir les tarifs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>Viral Studio Pro — Clips Twitch viraux en 5 minutes</p>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Tarifs</Link>
            <Link href="/demo" className="hover:text-foreground transition-colors">Démo</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
