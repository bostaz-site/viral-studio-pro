"use client"

import { useEffect } from 'react'
import Link from 'next/link'
import { Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HeroSection } from '@/components/landing/hero-section'
import { BeforeAfterSection } from '@/components/landing/before-after-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { FeaturesGrid } from '@/components/landing/features-grid'

export function LandingPage() {
  // Inject HowTo structured data for SEO
  useEffect(() => {
    const howToJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Comment cr\u00e9er un clip viral split-screen depuis un stream',
      description: 'Transforme tes meilleurs moments de stream Twitch ou YouTube Gaming en clips viraux 9:16 avec sous-titres karaok\u00e9 et split-screen automatique.',
      step: [
        { '@type': 'HowToStep', name: 'Choisis un clip de stream', text: 'Parcours les meilleurs moments Twitch et YouTube Gaming tri\u00e9s par score viral.', position: 1 },
        { '@type': 'HowToStep', name: 'Personnalise ton clip', text: 'Ajoute des sous-titres karaok\u00e9, choisis une vid\u00e9o satisfaisante pour le split-screen.', position: 2 },
        { '@type': 'HowToStep', name: 'Exporte', text: 'T\u00e9l\u00e9charge en 9:16 optimis\u00e9 pour TikTok, Reels et Shorts.', position: 3 },
      ],
    }

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(howToJsonLd)
    script.id = 'howto-jsonld'
    document.head.appendChild(script)

    return () => {
      document.getElementById('howto-jsonld')?.remove()
    }
  }, [])

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

      <HeroSection />
      <BeforeAfterSection />
      <HowItWorksSection />
      <FeaturesGrid />

      {/* Footer */}
      <footer className="border-t border-border/30 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
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
                Cr&eacute;e des clips viraux &agrave; partir de streams Twitch et YouTube Gaming. Sous-titres karaok&eacute;, split-screen et score viral IA.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Produit</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <Link href="/signup" className="block hover:text-foreground transition-colors">Cr&eacute;er un compte</Link>
                <Link href="/login" className="block hover:text-foreground transition-colors">Se connecter</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Contact</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <a href="mailto:support@viralstudio.pro" className="block hover:text-foreground transition-colors">Contact</a>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground/50">
              &copy; {new Date().getFullYear()} Viral Studio Pro — Fait avec passion par Samy
            </p>
            <p className="text-xs text-muted-foreground/40">
              Propuls&eacute; par Claude IA, Supabase et FFmpeg
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
