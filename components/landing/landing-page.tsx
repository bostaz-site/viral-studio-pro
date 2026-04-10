"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Scissors, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HeroSection } from '@/components/landing/hero-section'
import { BeforeAfterSection } from '@/components/landing/before-after-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { FeaturesGrid } from '@/components/landing/features-grid'
import { TestimonialsSection } from '@/components/landing/testimonials-section'
import { ComparisonSection } from '@/components/landing/comparison-section'
import { FaqSection, FAQ_ITEMS } from '@/components/landing/faq-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { RoiCalculatorSection } from '@/components/landing/roi-calculator-section'
import { ExitIntentPopup } from '@/components/landing/exit-intent-popup'

export function LandingPage() {
  // Inject FAQ + HowTo structured data for SEO
  useEffect(() => {
    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    }
    const howToJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Comment cr\u00e9er un clip viral split-screen depuis un stream',
      description: 'Transforme tes meilleurs moments de stream Twitch ou YouTube Gaming en clips viraux 9:16 avec sous-titres karaok\u00e9 et split-screen automatique.',
      step: [
        { '@type': 'HowToStep', name: 'Choisis un clip de stream', text: 'Parcours les meilleurs moments Twitch et YouTube Gaming tri\u00e9s par score viral. L\'IA identifie automatiquement les moments les plus engageants.', position: 1 },
        { '@type': 'HowToStep', name: 'Personnalise ton clip', text: 'Ajoute des sous-titres karaok\u00e9 (9 styles), choisis une vid\u00e9o satisfaisante pour le split-screen et v\u00e9rifie le score viral IA.', position: 2 },
        { '@type': 'HowToStep', name: 'Exporte et publie', text: 'T\u00e9l\u00e9charge en 9:16 optimis\u00e9 pour TikTok, Reels et Shorts ou publie directement. Ton clip est pr\u00eat en moins de 5 minutes.', position: 3 },
      ],
    }

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(faqJsonLd)
    script.id = 'faq-jsonld'
    document.head.appendChild(script)

    const script2 = document.createElement('script')
    script2.type = 'application/ld+json'
    script2.textContent = JSON.stringify(howToJsonLd)
    script2.id = 'howto-jsonld'
    document.head.appendChild(script2)

    return () => {
      document.getElementById('faq-jsonld')?.remove()
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
      <TestimonialsSection />
      <ComparisonSection />
      <RoiCalculatorSection />
      <FaqSection />
      <PricingSection />

      {/* Newsletter CTA */}
      <FooterNewsletter />

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
              {/* Social links */}
              <div className="flex items-center gap-3 mt-4">
                <a href="https://twitter.com/viralstudiopro" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="Twitter">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://tiktok.com/@viralstudiopro" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="TikTok">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.16z"/></svg>
                </a>
                <a href="https://discord.gg/viralstudio" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="Discord">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
                </a>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Produit</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <Link href="/signup" className="block hover:text-foreground transition-colors">Cr&eacute;er un compte</Link>
                <Link href="/login" className="block hover:text-foreground transition-colors">Se connecter</Link>
                <Link href="/pricing" className="block hover:text-foreground transition-colors">Tarifs</Link>
                <Link href="/blog" className="block hover:text-foreground transition-colors">Blog</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">L&eacute;gal</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <Link href="/about" className="block hover:text-foreground transition-colors">&Agrave; propos</Link>
                <Link href="/privacy" className="block hover:text-foreground transition-colors">Confidentialit&eacute;</Link>
                <Link href="/terms" className="block hover:text-foreground transition-colors">Conditions d&apos;utilisation</Link>
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

      <ExitIntentPopup />
    </div>
  )
}

// ─── Newsletter CTA Section ────────────────────────────────────────────────
function FooterNewsletter() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setStatus('loading')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'landing_footer' }),
      })
      const json = (await res.json().catch(() => null)) as
        | { data: unknown; error: string | null; message: string }
        | null

      if (!res.ok) {
        setStatus('error')
        setErrorMsg(json?.message ?? 'Erreur, réessaie.')
        return
      }
      setStatus('done')
      setEmail('')
    } catch {
      setStatus('error')
      setErrorMsg('Connexion impossible, réessaie.')
    }
  }

  return (
    <section className="py-16 px-6 border-t border-border/30 bg-gradient-to-b from-transparent to-primary/5">
      <div className="max-w-xl mx-auto text-center">
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
          3 hooks viraux par semaine, direct dans ta boite
        </h3>
        <p className="text-sm text-muted-foreground mt-2">
          Les tendances, les formats qui marchent, et des tips pour exploser sur TikTok. Gratuit, pas de spam.
        </p>
        {status === 'done' ? (
          <p className="mt-6 text-sm text-green-400 font-medium">
            Tu es inscrit ! Check ta boite bient&ocirc;t.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex items-center gap-2 max-w-md mx-auto">
            <input
              type="email"
              required
              placeholder="ton@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-10 rounded-lg border border-border bg-card/80 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button
              type="submit"
              size="sm"
              disabled={status === 'loading'}
              className="h-10 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              {status === 'loading' ? '...' : "S'inscrire"}
            </Button>
          </form>
        )}
        {status === 'error' && (
          <p className="mt-2 text-xs text-red-400">{errorMsg ?? 'Erreur, réessaie.'}</p>
        )}
        <p className="text-[10px] text-muted-foreground/40 mt-3">
          D&eacute;sinscription en 1 clic. On respecte ta boite.
        </p>
      </div>
    </section>
  )
}
