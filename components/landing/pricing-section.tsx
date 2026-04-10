"use client"

import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PlanConfig {
  name: string
  price: string
  priceNote: string
  trialNote?: string
  features: string[]
  highlighted?: boolean
  cta: string
}

const PLANS: PlanConfig[] = [
  {
    name: 'Free',
    price: '0\u20ac',
    priceNote: '/mois',
    features: [
      '3 vid\u00e9os / mois',
      'Clips jusqu\'\u00e0 60s',
      'Split-screen automatique',
      'Score viral IA',
      'Watermark Viral Studio',
    ],
    cta: 'Commencer gratuitement',
  },
  {
    name: 'Pro',
    price: '29\u20ac',
    priceNote: '/mois',
    trialNote: '7 jours gratuits, annule quand tu veux',
    highlighted: true,
    features: [
      '50 vid\u00e9os / mois',
      'Clips jusqu\'\u00e0 10 min',
      'Split-screen automatique',
      'Score viral + Remake This',
      'Sans watermark',
      'Brand Template custom',
      'Export 9:16 + 1:1 + 16:9',
    ],
    cta: 'D\u00e9marrer les 7 jours gratuits',
  },
  {
    name: 'Studio',
    price: '79\u20ac',
    priceNote: '/mois',
    features: [
      'Vid\u00e9os illimit\u00e9es',
      'Tout Pro inclus',
      'Distribution multi-plateforme',
      'Voix-off ElevenLabs',
      'API access',
      'Support prioritaire',
    ],
    cta: 'Passer Studio',
  },
]

export function PricingSection() {
  return (
    <section className="py-20 px-6 border-t border-border/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-sm text-muted-foreground/50 mb-6 italic">Ils ont tous commenc&eacute; avec le plan gratuit. &Agrave; toi de jouer.</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Choisis ton plan, commence &agrave; clipper</h2>
          <p className="text-muted-foreground mt-3 text-lg">Gratuit pour toujours &middot; Upgrade quand tu veux &middot; <Link href="/pricing" className="text-primary hover:underline">Voir la comparaison compl&egrave;te</Link></p>
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
                    Populaire
                  </span>
                  <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                    Prix de lancement
                  </span>
                </div>
              )}

              <CardHeader className="pb-3 pt-6">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black text-foreground">{plan.price}</span>
                  <CardDescription>{plan.priceNote}</CardDescription>
                </div>
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
