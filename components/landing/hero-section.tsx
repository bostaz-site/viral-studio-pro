"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

export function HeroSection() {
  return (
    <section className="relative pt-28 pb-8 sm:pt-36 sm:pb-12 px-5">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] text-foreground">
          Clips blowing up,{' '}
          <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
            found before the crowd.
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Turn them into TikTok-ready posts in one click — captions, vertical crop, hook and automatic credit included.
        </p>

        <p className="mt-3 text-xs sm:text-sm text-zinc-500 font-medium">
          No recording. No downloading. No manual posting.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup">
            <Button
              size="lg"
              className="w-56 h-12 text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-amber-950 shadow-lg shadow-amber-500/20"
              onClick={() => track('landing_cta_clicked', { placement: 'hero' })}
            >
              Start farming free
            </Button>
          </Link>
          <button
            onClick={() => {
              document.getElementById('radar')?.scrollIntoView({ behavior: 'smooth' })
              track('landing_cta_clicked', { placement: 'hero_watch' })
            }}
            className="h-12 px-6 text-sm font-semibold text-zinc-400 hover:text-white border border-zinc-700/60 hover:border-zinc-500 rounded-lg transition-colors"
          >
            Watch it work
          </button>
        </div>

        {/* Trust */}
        <p className="mt-6 text-[11px] text-zinc-500 tracking-wide">
          Free plan &middot; No credit card &middot; TikTok Direct Post approved
        </p>
      </div>

      {/* Hero visual — poster placeholder, video TODO */}
      <div className="mt-10 sm:mt-14 max-w-3xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/80 aspect-video flex items-center justify-center">
          {/* TODO: <video muted playsInline loop preload="none" poster="/landing/hero-poster.webp"> */}
          <div className="flex items-center gap-6 sm:gap-10 p-6 sm:p-10">
            {/* Before — 16:9 mockup */}
            <div className="flex-1 aspect-video rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-700/30 to-zinc-900/50" />
              <div className="relative text-center">
                <p className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">Raw clip</p>
                <p className="text-[9px] text-zinc-500 mt-0.5">16:9 horizontal</p>
              </div>
            </div>
            {/* Arrow */}
            <div className="text-amber-500 text-xl sm:text-2xl font-black shrink-0">&rarr;</div>
            {/* After — phone */}
            <div className="w-16 sm:w-24 shrink-0">
              <div className="aspect-[9/16] rounded-xl bg-zinc-800 border-2 border-zinc-600 flex flex-col items-center justify-end p-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-700/20 to-zinc-900/60" />
                <div className="relative space-y-0.5 mb-2 w-full">
                  <div className="landing-caption-pop h-1.5 bg-white/90 rounded-full w-3/4 mx-auto" style={{ animationDelay: '0s' }} />
                  <div className="landing-caption-pop h-1.5 bg-amber-400/80 rounded-full w-1/2 mx-auto" style={{ animationDelay: '0.3s' }} />
                  <div className="landing-caption-pop h-1.5 bg-white/70 rounded-full w-2/3 mx-auto" style={{ animationDelay: '0.6s' }} />
                </div>
                <p className="relative text-[7px] sm:text-[8px] text-zinc-400 font-bold">9:16 TikTok</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
