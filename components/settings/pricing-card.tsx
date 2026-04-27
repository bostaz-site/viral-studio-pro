"use client"

import { useState } from 'react'
import { Check, Loader2, Zap, Crown, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Plan = 'free' | 'pro' | 'studio'

interface PricingCardProps {
  currentPlan: Plan
  onUpgrade: (plan: 'pro' | 'studio') => Promise<void>
  onManageBilling: () => Promise<void>
}

interface PlanConfig {
  id: Plan
  name: string
  price: string | null
  priceOriginal?: string
  priceNote: string
  icon: React.ElementType
  color: string
  features: string[]
  cta: string
  highlighted?: boolean
}

const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceNote: '/month',
    icon: Zap,
    color: 'text-muted-foreground',
    features: [
      '3 videos/month',
      'Clips up to 60s',
      'Auto split-screen',
      'Virality Score',
      'Watermark included',
    ],
    cta: 'Current plan',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    priceNote: '/month',
    icon: Crown,
    color: 'text-blue-400',
    highlighted: true,
    features: [
      '30 videos/month',
      'Clips up to 2 min',
      'Auto split-screen',
      'Virality Score + Remake',
      'No watermark',
      'Custom brand template',
      'Export 9:16 + 1:1 + 16:9',
      'Trending dashboard',
    ],
    cta: 'Upgrade to Pro',
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '$24',
    priceOriginal: '$29',
    priceNote: '/month',
    icon: Sparkles,
    color: 'text-violet-400',
    features: [
      '120 videos/month (90 + 30 bonus)',
      'Everything in Pro',
      'Multi-platform distribution',
      'ElevenLabs voiceover',
      'API access',
      'Priority support',
      'White-label',
    ],
    cta: 'Upgrade to Studio',
  },
]

export function PricingCard({ currentPlan, onUpgrade, onManageBilling }: PricingCardProps) {
  const [loadingPlan, setLoadingPlan] = useState<'pro' | 'studio' | 'portal' | null>(null)

  const handleUpgrade = async (plan: 'pro' | 'studio') => {
    setLoadingPlan(plan)
    try {
      await onUpgrade(plan)
    } finally {
      setLoadingPlan(null)
    }
  }

  const handlePortal = async () => {
    setLoadingPlan('portal')
    try {
      await onManageBilling()
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {PLANS.map((plan) => {
        const Icon = plan.icon
        const isCurrent = currentPlan === plan.id
        const isUpgrade = plan.id !== 'free' && !isCurrent && (
          plan.id === 'studio' || currentPlan === 'free'
        )
        const isDowngrade = plan.id !== 'free' && !isCurrent && !isUpgrade

        return (
          <Card
            key={plan.id}
            className={cn(
              'relative flex flex-col bg-card/60 border-border transition-all duration-200',
              plan.highlighted && 'border-primary/40 shadow-lg shadow-primary/5',
              isCurrent && 'ring-1 ring-primary/30'
            )}
          >
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  Popular
                </span>
              </div>
            )}

            <CardHeader className="pb-3 pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('h-5 w-5', plan.color)} />
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {isCurrent && (
                  <span className="ml-auto text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                    Current
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                {plan.priceOriginal && (
                  <span className="text-lg text-muted-foreground/60 line-through">{plan.priceOriginal}</span>
                )}
                <span className="text-3xl font-black text-foreground">{plan.price}</span>
                <CardDescription>{plan.priceNote}</CardDescription>
              </div>
              {plan.priceOriginal && (
                <p className="text-[11px] text-amber-400 font-medium">Launch price</p>
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
              {isCurrent ? (
                currentPlan !== 'free' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handlePortal}
                    disabled={loadingPlan === 'portal'}
                  >
                    {loadingPlan === 'portal' ? (
                      <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading…</>
                    ) : (
                      'Manage subscription'
                    )}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="w-full" disabled>
                    Current plan
                  </Button>
                )
              ) : plan.id !== 'free' ? (
                <Button
                  size="sm"
                  className={cn(
                    'w-full',
                    plan.highlighted
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                      : ''
                  )}
                  variant={plan.highlighted ? 'default' : 'outline'}
                  onClick={() => handleUpgrade(plan.id as 'pro' | 'studio')}
                  disabled={!!loadingPlan || isDowngrade}
                >
                  {loadingPlan === plan.id ? (
                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Redirecting…</>
                  ) : isDowngrade ? (
                    'Contact support'
                  ) : (
                    plan.cta
                  )}
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
