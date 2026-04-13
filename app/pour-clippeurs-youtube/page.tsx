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
  title: 'YouTube Shorts depuis tes vidéos — clips verticaux automatiques',
  description:
    'Transforme tes vidéos YouTube en Shorts viraux avec sous-titres karaoké, split-screen et score viral IA. Essai gratuit — 3 clips/mois sans carte bancaire.',
  keywords: [
    'youtube shorts maker',
    'convertir youtube en shorts',
    'clip youtube vertical',
    'youtube shorts sous-titres',
    'split-screen youtube',
    'créer shorts youtube',
    'youtube clip tiktok',
    'youtube shorts automatique',
    'youtube shorts outil',
    'meilleurs moments youtube shorts',
  ],
  openGraph: {
    title: 'YouTube Shorts viraux — Viral Studio Pro',
    description:
      'Transforme tes vidéos YouTube en Shorts verticaux en 5 minutes.',
    url: 'https://viral-studio-pro.netlify.app/pour-clippeurs-youtube',
  },
  alternates: {
    canonical: 'https://viral-studio-pro.netlify.app/pour-clippeurs-youtube',
  },
}

// ─── Data ────────────────────────────────────────────────────────────────────

const PAINS = [
  {
    pain: 'Tes longues vidéos font zéro impression sur Shorts',
    solution: 'On détecte les moments forts et on découpe le Shorts prêt à publier',
    icon: Clock,
  },
  {
    pain: 'Shorts demande du 9:16, tes vidéos sont en 16:9',
    solution: 'Reframe vertical intelligent — le sujet reste toujours centré',
    icon: Layers,
  },
  {
    pain: 'Sans sous-titres, 85% des viewers scrollent',
    solution: 'Sous-titres karaoké mot-par-mot, 9 styles, appliqués en 1 clic',
    icon: Type,
  },
  {
    pain: 'Tu perds des heures à monter un seul Short',
    solution: 'Upload → style → export : 5 minutes max, split-screen inclus',
    icon: TrendingUp,
  },
]

const STEPS = [
  {
    step: '1',
    title: 'Uploade ta vidéo',
    description:
      'Importe directement depuis ton ordi ou colle un lien YouTube. On accepte toutes les durées.',
    icon: Play,
  },
  {
    step: '2',
    title: 'Choisis le style',
    description:
      'Sous-titres Hormozi, Karaoké, Minimal. Split-screen avec gameplay satisfaisant. Score viral IA.',
    icon: Sparkles,
  },
  {
    step: '3',
    title: 'Exporte en 9:16',
    description:
      'Télécharge ton Short optimisé. Poste-le sur YouTube Shorts, TikTok et Reels — même clip, 3 plateformes.',
    icon: Scissors,
  },
]

const USE_CASES = [
  { name: 'Gaming', examples: 'Highlights, kills, fails, speedruns', icon: '🎮' },
  { name: 'Éducation', examples: 'Tutoriels, explainers, how-to', icon: '📚' },
  { name: 'Vlogs', examples: 'Voyages, daily vlogs, réactions', icon: '📷' },
  { name: 'Podcasts', examples: 'Interviews, débats, best-of', icon: '🎙️' },
  { name: 'Cuisine', examples: 'Recettes rapides, plating, ASMR', icon: '🍳' },
  { name: 'Fitness', examples: 'Exercices, transformations, tips', icon: '💪' },
]

// ─── Component ───────────────────────────────────────────────────────────────

function YouTubeLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

export default function PourClippeursYouTubePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'YouTube Shorts viraux — Viral Studio Pro',
    description:
      'Transforme tes vidéos YouTube en Shorts verticaux optimisés avec sous-titres et split-screen.',
    url: 'https://viral-studio-pro.netlify.app/pour-clippeurs-youtube',
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
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/15 via-transparent to-transparent" />
        <div className="absolute top-10 right-1/3 w-80 h-80 bg-red-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/5 text-xs font-semibold mb-6">
            <YouTubeLogo className="h-3.5 w-3.5 text-red-400" />
            <span className="text-red-300">Optimisé pour YouTube Shorts</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-5">
            Tes vidéos YouTube{' '}
            <span className="bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">
              deviennent des Shorts viraux
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            Viral Studio Pro extrait tes meilleurs moments et les transforme en Shorts 9:16
            avec sous-titres karaoké et split-screen — prêts à poster en 5 minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg shadow-red-500/25 h-12 px-8 text-base font-bold gap-2"
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
              Tes vidéos longues ne performent pas sur Shorts ?
            </h2>
            <p className="text-muted-foreground mt-2 text-lg">
              Normal. Le format est différent. On s&apos;en occupe.
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
                  <p className="text-sm font-semibold text-red-300/90">{p.pain}</p>
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
              3 étapes. 5 minutes. Short prêt.
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-red-500/20 to-rose-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                  <s.icon className="h-5 w-5 text-red-400" />
                </div>
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">
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

      {/* Use cases */}
      <section className="py-16 px-6 border-t border-border/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black tracking-tight">
              Quel que soit ton type de contenu
            </h2>
            <p className="text-muted-foreground mt-2">
              Gaming, éducation, vlogs, podcasts — le format Short marche partout.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((n) => (
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

      {/* Features */}
      <section className="py-16 px-6 border-t border-border/30 bg-card/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black tracking-tight">
              Tout inclus, même en gratuit
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Type, title: 'Sous-titres karaoké', desc: '9 styles disponibles, mot-par-mot, placement automatique' },
              { icon: Layers, title: 'Split-screen gameplay', desc: 'Subway Surfers, Minecraft, Parkour — double la rétention' },
              { icon: Sparkles, title: 'Score viral IA', desc: 'Prédit le potentiel de rétention de chaque clip (0-100)' },
              { icon: Zap, title: 'Export multi-plateforme', desc: '1 clip = YouTube Shorts + TikTok + Reels prêts à poster' },
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

      {/* Cross-link to Twitch landing */}
      <section className="py-12 px-6 border-t border-border/30">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-muted-foreground mb-2">Tu streames aussi sur Twitch ?</p>
          <Link href="/pour-streamers-twitch" className="text-sm text-primary hover:underline font-semibold">
            Voir notre page dédiée aux streamers Twitch →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Prêt à transformer tes vidéos en Shorts ?
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            3 clips par mois offerts. Pas de carte bancaire. Résultat en 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white h-12 px-8 text-base font-bold gap-2"
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
          <p>Viral Studio Pro — YouTube Shorts en 5 minutes</p>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Tarifs</Link>
            <Link href="/demo" className="hover:text-foreground transition-colors">Démo</Link>
            <Link href="/pour-streamers-twitch" className="hover:text-foreground transition-colors">Twitch</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
