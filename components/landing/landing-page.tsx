"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ViralAnimalLogo } from '@/components/brand/viral-animal-logo'
import { HeroSection } from '@/components/landing/hero-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { BeforeAfterSection } from '@/components/landing/before-after-section'
import { FeaturesGrid } from '@/components/landing/features-grid'
import { FaqSection, FAQ_ITEMS } from '@/components/landing/faq-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { FinalCtaSection } from '@/components/landing/final-cta-section'
import { ExitIntentPopup } from '@/components/landing/exit-intent-popup'

export function LandingPage() {
  // Inject FAQ structured data for SEO
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
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(faqJsonLd)
    script.id = 'faq-jsonld'
    document.head.appendChild(script)
    return () => { document.getElementById('faq-jsonld')?.remove() }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-5">
          <Link href="/" className="flex items-center gap-2">
            <ViralAnimalLogo size={28} iconOnly variant="forge" />
            <span className="text-sm font-black tracking-tight bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
              VIRAL ANIMAL
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-amber-950 font-bold">
                Start free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* S1: Hero */}
      <HeroSection />

      {/* S2: Radar (signature) */}
      <HowItWorksSection />

      {/* S3: Transformation */}
      <BeforeAfterSection />

      {/* S4: The Farm */}
      <FeaturesGrid />

      {/* S5: Pricing */}
      <PricingSection />

      {/* S6: FAQ */}
      <FaqSection />

      {/* S7: Final CTA */}
      <FinalCtaSection />

      {/* Newsletter */}
      <FooterNewsletter />

      {/* Footer */}
      <footer className="border-t border-border/20 py-10 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ViralAnimalLogo size={20} iconOnly variant="forge" />
                <span className="text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                  VIRAL ANIMAL
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xs">
                Turn Twitch &amp; Kick clips into viral TikToks. Karaoke captions, AI scoring, auto-distribution.
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Product</p>
              <div className="space-y-1.5 text-[11px] text-zinc-500">
                <Link href="/signup" className="block hover:text-foreground transition-colors">Create account</Link>
                <Link href="/login" className="block hover:text-foreground transition-colors">Log in</Link>
                <Link href="/pricing" className="block hover:text-foreground transition-colors">Pricing</Link>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Legal</p>
              <div className="space-y-1.5 text-[11px] text-zinc-500">
                <Link href="/privacy" className="block hover:text-foreground transition-colors">Privacy</Link>
                <Link href="/terms" className="block hover:text-foreground transition-colors">Terms</Link>
                <a href="mailto:support@viralanimal.com" className="block hover:text-foreground transition-colors">Contact</a>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-border/10 text-center">
            <p className="text-[10px] text-zinc-600">
              &copy; {new Date().getFullYear()} Viral Animal
            </p>
          </div>
        </div>
      </footer>

      <ExitIntentPopup />
    </div>
  )
}

// ─── Newsletter CTA ────────────────────────────────────────────────
function FooterNewsletter() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setStatus('loading')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'landing_footer' }),
      })
      if (!res.ok) { setStatus('error'); return }
      setStatus('done')
      setEmail('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className="py-14 px-5 border-t border-border/20">
      <div className="max-w-md mx-auto text-center">
        <h3 className="text-lg font-bold tracking-tight">3 viral hooks a week, straight to your inbox</h3>
        <p className="text-xs text-zinc-500 mt-1.5">Free, no spam. 1-click unsubscribe.</p>
        {status === 'done' ? (
          <p className="mt-5 text-xs text-emerald-400 font-medium">You&apos;re in!</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 flex items-center gap-2">
            <input
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-9 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 text-xs text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
            />
            <Button type="submit" size="sm" disabled={status === 'loading'} className="h-9 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-amber-950 font-bold text-xs gap-1.5">
              <Send className="h-3 w-3" />
              {status === 'loading' ? '...' : 'Subscribe'}
            </Button>
          </form>
        )}
        {status === 'error' && <p className="mt-2 text-[10px] text-red-400">Something went wrong, try again.</p>}
      </div>
    </section>
  )
}
