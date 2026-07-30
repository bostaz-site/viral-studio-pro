"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ViralAnimalLogo } from '@/components/brand/viral-animal-logo'
import { AnimatedSection } from '@/components/landing/animated-section'
import { track } from '@/lib/analytics'

export function FinalCtaSection() {
  return (
    <section
      className="relative overflow-hidden py-20 sm:py-28 px-5"
      style={{ background: '#020617' }}
    >
      {/* Faint radar echo — 2 barely-visible cyan rings */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: [
            'radial-gradient(circle at 50% 45%, transparent 180px, rgba(56,189,248,.04) 181px, transparent 182px)',
            'radial-gradient(circle at 50% 45%, transparent 300px, rgba(56,189,248,.025) 301px, transparent 302px)',
          ].join(', '),
        }}
      />

      <AnimatedSection>
        <div className="relative max-w-xl mx-auto text-center">
          {/* Wolf — Or Forge, large format with amber glow */}
          <div className="flex justify-center mb-8">
            <div
              className="rounded-full"
              style={{
                filter: 'drop-shadow(0 0 40px rgba(217,119,6,.18)) drop-shadow(0 0 80px rgba(251,191,36,.08))',
              }}
            >
              <ViralAnimalLogo size={200} iconOnly variant="forge" />
            </div>
          </div>

          <p
            className="font-bold text-[#F8FAFC]"
            style={{
              fontSize: 'clamp(26px, 5vw, 40px)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            The radar already found your next clip.
          </p>

          <div className="mt-8">
            <Link href="/signup">
              <Button
                size="lg"
                className="h-12 px-8 text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-amber-950 shadow-lg shadow-amber-500/20"
                onClick={() => track('landing_cta_clicked', { placement: 'final' })}
              >
                Claim your first clip
              </Button>
            </Link>
          </div>

          {/* Trust line — mirrors hero */}
          <p className="mt-5 text-xs font-semibold" style={{ color: '#64748B' }}>
            Free plan &middot; No credit card &middot; TikTok Direct Post approved
          </p>
        </div>
      </AnimatedSection>
    </section>
  )
}
