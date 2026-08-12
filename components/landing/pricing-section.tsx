"use client"

import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AnimatedSection } from '@/components/landing/animated-section'
import { track } from '@/lib/analytics'
import { isStudioLaunchActive } from '@/lib/plans'

interface PlanConfig {
  id: string
  name: string
  price: string
  priceOriginal?: string
  priceNote: string
  tagline: string
  features: string[]
  highlighted?: boolean
  cta: string
}

const launchActive = isStudioLaunchActive()

const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceNote: '/mo',
    tagline: 'Try the workflow',
    features: [
      '3 videos/month',
      'Watermark included',
      'All caption styles',
      'AI viral score',
      'No credit card',
    ],
    cta: 'Start free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    priceNote: '/mo',
    tagline: 'For casual clippers',
    features: [
      '30 clips/month · no watermark',
      'All caption styles',
      'Hook text overlay',
      'Custom brand template',
      'Trending dashboard',
    ],
    cta: 'Go Pro',
  },
  {
    id: 'studio',
    name: 'Studio',
    price: launchActive ? '$24' : '$29',
    ...(launchActive ? { priceOriginal: '$29' } : {}),
    priceNote: '/mo',
    tagline: 'For serious farmers',
    features: [
      '120 videos/month',
      'Everything in Pro',
      'Auto-distribute farm',
      'Multi-platform (coming)',
      'Priority support',
    ],
    highlighted: true,
    cta: 'Go Studio',
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-16 sm:py-24 px-5 border-t border-border/20">
      <AnimatedSection>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">Simple pricing. Cancel anytime.</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  'rounded-xl border p-5 flex flex-col bg-zinc-900/60',
                  plan.highlighted
                    ? 'border-amber-500/40 shadow-lg shadow-amber-500/5 relative'
                    : 'border-zinc-800'
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500 text-amber-950">
                      {launchActive ? 'Best value \u00B7 Founding launch price' : 'Best value'}
                    </span>
                  </div>
                )}

                <p className="text-xs text-zinc-500 font-medium">{plan.tagline}</p>
                <div className="flex items-baseline gap-1.5 mt-2">
                  {plan.priceOriginal && (
                    <span className="text-base text-zinc-600 line-through">{plan.priceOriginal}</span>
                  )}
                  <span className="text-3xl font-black text-foreground">{plan.price}</span>
                  <span className="text-xs text-zinc-500">{plan.priceNote}</span>
                </div>
                <h3 className="text-lg font-bold text-foreground mt-1">{plan.name}</h3>

                <div className="flex-1 mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-zinc-400">{f}</span>
                    </div>
                  ))}
                </div>

                <Link href="/signup" className="mt-5">
                  <Button
                    size="sm"
                    className={cn(
                      'w-full font-bold',
                      plan.highlighted
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-amber-950'
                        : ''
                    )}
                    variant={plan.highlighted ? 'default' : 'outline'}
                    onClick={() => track('landing_cta_clicked', { placement: 'pricing' })}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] text-zinc-500 mt-6">
            Cancel anytime. Quota resets monthly. No overages ever.
          </p>
        </div>
      </AnimatedSection>
    </section>
  )
}
