"use client"

import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LaunchCountdown } from '@/components/landing/launch-countdown'

interface PlanConfig {
  id: string
  name: string
  price: string
  priceOriginal?: string
  priceNote: string
  trialNote?: string
  features: string[]
  highlighted?: boolean
  cta: string
}

const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceNote: '/mo',
    features: [
      '3 videos/month',
      'Clips up to 60s',
      'Auto split-screen',
      'AI viral score',
      'Viral Animal watermark',
    ],
    cta: 'Start Free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    priceNote: '/mo',
    trialNote: '7 days free, cancel anytime',
    highlighted: true,
    features: [
      '30 videos/month',
      'Clips up to 2 min',
      'Auto split-screen',
      'Viral score + Remake This',
      'No watermark',
      'Custom brand templates',
      'Export 9:16 + 1:1 + 16:9',
    ],
    cta: 'Start 7-Day Free Trial',
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '$24',
    priceOriginal: '$29',
    priceNote: '/mo',
    features: [
      '120 videos/month (90 + 30 bonus)',
      'Everything in Pro',
      'Multi-platform distribution',
      'ElevenLabs voiceovers',
      'API access',
      'Priority support',
    ],
    cta: 'Upgrade to Studio',
  },
]

export function PricingSection() {
  return (
    <section className="py-20 px-6 border-t border-border/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-sm text-muted-foreground/50 mb-6 italic">All the biggest creators started free. Your turn.</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Pick Your Plan, Start Clipping</h2>
          <p className="text-muted-foreground mt-3 text-lg">Free forever &middot; Upgrade anytime &middot; <Link href="/pricing" className="text-primary hover:underline">See full comparison</Link></p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                'relative flex flex-col bg-card/60 border-border transition-all duration-200',
                plan.highlighted && 'border-primary/40 shadow-lg shadow-primary/5 scale-[1.02]',
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                  <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                    Launch Price
                  </span>
                </div>
              )}

              <CardHeader className="pb-3 pt-6">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-2 mt-2">
                  {plan.priceOriginal && (
                    <span className="text-lg text-muted-foreground/60 line-through">{plan.priceOriginal}</span>
                  )}
                  <span className="text-3xl font-black text-foreground">{plan.price}</span>
                  <CardDescription>{plan.priceNote}</CardDescription>
                </div>
                {plan.id === 'studio' && plan.priceOriginal && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    <p className="text-[11px] text-amber-400 font-semibold">Launch Price</p>
                    <LaunchCountdown />
                  </div>
                )}
                {plan.trialNote && (
                  <p className="text-[11px] text-emerald-400 font-medium mt-1.5">{plan.trialNote}</p>
                )}
              </CardHeader>

              <CardContent className="flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </CardContent>

              <CardFooter className="pt-4">
                <Link href="/signup" className="w-full">
                  <Button
                    size="sm"
                    className={cn(
                      'w-full',
                      plan.highlighted
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                        : ''
                    )}
                    variant={plan.highlighted ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
