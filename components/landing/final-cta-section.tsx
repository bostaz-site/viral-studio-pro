"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ViralAnimalLogo } from '@/components/brand/viral-animal-logo'
import { AnimatedSection } from '@/components/landing/animated-section'
import { track } from '@/lib/analytics'

export function FinalCtaSection() {
  return (
    <section className="py-20 sm:py-28 px-5 border-t border-border/20">
      <AnimatedSection>
        <div className="max-w-xl mx-auto text-center">
          {/* Large wolf logo */}
          <div className="flex justify-center mb-6">
            <ViralAnimalLogo size={80} iconOnly variant="forge" />
          </div>

          <p className="text-lg sm:text-xl font-bold text-foreground">
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
        </div>
      </AnimatedSection>
    </section>
  )
}
