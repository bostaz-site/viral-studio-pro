import Link from 'next/link'
import { Scissors, ArrowLeft, Clock, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Split-screen Subway Surfers : pourquoi ça explose sur TikTok',
  description: 'Pourquoi le format split-screen avec Subway Surfers en bas génère 3x plus de rétention sur TikTok. La science derrière le format viral gaming.',
}

export default function ArticlePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Scissors className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">VIRAL STUDIO</span>
          </Link>
          <Link href="/blog" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Blog</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-6">
          <div className="flex items-center gap-1"><User className="h-3 w-3" /> Samy</div>
          <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> 6 min de lecture</div>
          <span>29 mars 2026</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-6">Split-screen Subway Surfers : pourquoi ça explose sur TikTok</h1>

        <div className="prose prose-invert prose-sm max-w-none space-y-6">
          <p className="text-lg text-muted-foreground leading-relaxed">
            Tu as forcément vu ce format sur TikTok : un clip de stream ou un podcast en haut, et Subway Surfers qui tourne en bas. Ça a l&apos;air absurde, et pourtant c&apos;est le format le plus efficace pour la rétention. Voici pourquoi.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">La science du dual-stimulus</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le cerveau humain est câblé pour suivre le mouvement. Quand il y a du mouvement dans la partie basse de l&apos;écran (Subway Surfers, Minecraft parkour, satisfying videos), ton cerveau ne peut pas détourner le regard — même si le contenu principal est en haut.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            C&apos;est ce qu&apos;on appelle le <strong className="text-foreground">dual-stimulus effect</strong>. Le spectateur regarde le clip en haut pour le contenu, et le jeu en bas pour la stimulation visuelle. Résultat : il ne scroll pas.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">Les chiffres qui parlent</h2>
          <p className="text-muted-foreground leading-relaxed">
            D&apos;après notre analyse sur plus de 12 000 clips créés avec <Link href="/" className="text-primary hover:underline">Viral Studio Pro</Link> :
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">x3 rétention moyenne</strong> par rapport aux clips sans split-screen</li>
            <li><strong className="text-foreground">+65% de watch-through rate</strong> (spectateurs qui regardent jusqu&apos;à la fin)</li>
            <li><strong className="text-foreground">x2.1 engagement</strong> (likes + commentaires + partages)</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            L&apos;algorithme TikTok récompense le watch time. Plus de rétention = plus de push algorithmique = plus de vues organiques. C&apos;est un cercle vertueux.
          </p>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">Quel jeu choisir pour le split-screen ?</h2>
          <p className="text-muted-foreground leading-relaxed">
            Tous les jeux ne se valent pas. Voici ce qui marche le mieux par niche :
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Subway Surfers</strong> : le classique. Marche pour tout : gaming, podcast, réactions. Le mouvement latéral continu est hypnotique</li>
            <li><strong className="text-foreground">Minecraft parkour</strong> : parfait pour le gaming et les clips de stream. Le first-person view crée une immersion</li>
            <li><strong className="text-foreground">Satisfying videos</strong> (slime, soap cutting) : idéal pour le contenu éducatif et business</li>
            <li><strong className="text-foreground">GTA driving</strong> : bonne alternative pour les audiences plus âgées</li>
          </ul>

          <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">Comment faire un split-screen automatiquement</h2>
          <p className="text-muted-foreground leading-relaxed">
            Avant, il fallait ouvrir Premiere Pro, importer deux vidéos, les aligner manuellement, ajouter les sous-titres... 2 heures de travail par clip.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Avec <Link href="/" className="text-primary hover:underline">Viral Studio Pro</Link>, c&apos;est automatique : tu choisis ton clip, tu sélectionnes Subway Surfers ou Minecraft, et l&apos;outil génère le split-screen en quelques secondes. Les sous-titres karaoké sont ajoutés automatiquement.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            C&apos;est le seul outil qui propose cette fonctionnalité. OpusClip et Eklipse ne font que des clips classiques — pas de split-screen.
          </p>

          <div className="mt-12 p-6 rounded-xl bg-primary/5 border border-primary/20 text-center">
            <p className="text-foreground font-semibold mb-3">Teste le split-screen automatique</p>
            <p className="text-sm text-muted-foreground mb-4">30 clips offerts · Sans carte bancaire · Le seul outil qui le fait</p>
            <Link href="/signup">
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold">
                Commencer gratuitement
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/30 py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Viral Studio Pro</p>
          <div className="flex gap-4">
            <Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
