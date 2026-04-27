"use client"

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

export function FinalCtaSection() {
  return (
    <section className="py-20 px-6 border-t border-border/30 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
          Stop Scrolling. Start Going Viral.
        </h2>
        <p className="text-lg text-muted-foreground mt-4 max-w-lg mx-auto">
          Your next clip could be the one that blows up. The only thing between you and viral is one click.
        </p>
        <Link href="/signup" onClick={() => track('cta_hero_click', { location: 'final_cta' })}>
          <Button size="lg" className="mt-8 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 h-14 px-10 text-lg font-bold gap-2">
            Start for Free
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <p className="text-xs text-muted-foreground/60 mt-4">
          No credit card &middot; 3 free clips &middot; Cancel anytime
        </p>
      </div>
    </section>
  )
}
