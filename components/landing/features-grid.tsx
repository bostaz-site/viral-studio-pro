"use client"

import { AnimatedSection } from '@/components/landing/animated-section'

const TICKER_LINES = [
  { time: '17:02', text: 'Posted to TikTok' },
  { time: '15:14', text: 'Caption optimized' },
  { time: '13:47', text: 'New early signal detected' },
]

export function FeaturesGrid() {
  return (
    <section className="py-16 sm:py-24 px-5 border-t border-border/20">
      <AnimatedSection>
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">The farm runs while you sleep.</h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-xl mx-auto">
            Queue your clips. The system picks the optimal time and posts automatically.
          </p>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.15}>
        <div className="max-w-md mx-auto">
          {/* Mini brain + panel mockup */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-4">
            {/* Brain placeholder — static SVG */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full border border-cyan-500/20 bg-zinc-800/80 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(56,189,248,.5)" strokeWidth="1.5">
                  <path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6l-.7.5V18h-6v-2.5l-.7-.5A7 7 0 0 1 12 2z"/>
                  <path d="M9 18h6v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-2z"/>
                  <circle cx="12" cy="9" r="1.5" fill="rgba(56,189,248,.4)"/>
                </svg>
              </div>
            </div>

            {/* Panel */}
            <div className="rounded-lg border border-cyan-500/15 bg-zinc-900 p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/60 mb-1">Next Post</p>
              <p className="text-2xl font-black text-foreground tabular-nums">2h 18m</p>
              <p className="text-[10px] text-zinc-500 mt-1">Tonight &middot; 7:18 PM &middot; High-activity window</p>
            </div>

            {/* Ticker */}
            <div className="space-y-1.5 landing-ticker-loop">
              {TICKER_LINES.map((line, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-zinc-600 tabular-nums w-10 shrink-0">{line.time}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/40 shrink-0" />
                  <span className="text-zinc-400">{line.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Platform note */}
          <p className="text-center text-[11px] text-zinc-500 mt-4">
            TikTok live today. YouTube Shorts &amp; Instagram Reels coming soon.
          </p>
        </div>
      </AnimatedSection>
    </section>
  )
}
