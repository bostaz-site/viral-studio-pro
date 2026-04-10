import type { Metadata } from 'next'
import Link from 'next/link'
import { Scissors, ArrowRight, Zap, Heart, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'A propos — Viral Studio Pro',
  description: 'Decouvrez l\'histoire derriere Viral Studio Pro. Un outil cree par un createur de contenu, pour les createurs de contenu.',
  openGraph: {
    title: 'A propos — Viral Studio Pro',
    description: 'L\'histoire derriere Viral Studio Pro. Un outil cree par un createur, pour les createurs.',
  },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Scissors className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              VIRAL STUDIO
            </span>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
              Essai gratuit
            </Button>
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-16">
            <p className="text-sm text-primary font-medium mb-3">A propos</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Cree par un streamer fatigue de perdre ses meilleurs moments
            </h1>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
              Je suis Samy. Comme toi, je streamais pendant des heures et mes meilleures reactions restaient enterrees sur Twitch avec 12 viewers.
            </p>
          </div>

          {/* Story */}
          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <p>
              Le probleme etait simple : je voyais des clip channels exploser sur TikTok avec le format split-screen (stream en haut, Subway Surfers en bas, sous-titres karaoke). Sauf que pour faire ca, il fallait soit passer 2 heures sur CapCut, soit payer un editeur.
            </p>
            <p>
              J&apos;ai essaye OpusClip, Eklipse, et tous les outils du marche. Aucun ne faisait le split-screen automatiquement. Aucun ne me disait pourquoi un clip allait marcher ou pas. Aucun ne me laissait m&apos;inspirer des formats trending pour mes propres clips.
            </p>
            <p>
              Alors j&apos;ai decide de le construire moi-meme.
            </p>
            <p className="text-foreground font-medium text-base">
              Viral Studio Pro est ne de cette frustration. Un seul outil qui fait ce qu&apos;aucun autre ne combine : split-screen automatique + sous-titres karaoke + score viral IA + Remake This.
            </p>
          </div>

          {/* Values */}
          <div className="grid sm:grid-cols-3 gap-6 mt-16">
            <div className="rounded-xl border border-border bg-card/60 p-5">
              <Zap className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Rapidite</h3>
              <p className="text-xs text-muted-foreground">5 minutes pour un clip pret a publier. Pas 2 heures sur un logiciel de montage.</p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-5">
              <Target className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Precision</h3>
              <p className="text-xs text-muted-foreground">L&apos;IA analyse chaque clip et te dit exactement quoi ameliorer pour maximiser les vues.</p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-5">
              <Heart className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Pour les createurs</h3>
              <p className="text-xs text-muted-foreground">Construit par quelqu&apos;un qui comprend tes problemes parce qu&apos;il les a vecus.</p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <Link href="/signup">
              <Button size="lg" className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-2">
                Essayer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground/60 mt-3">30 clips offerts, sans carte bancaire</p>
          </div>
        </div>
      </main>
    </div>
  )
}
