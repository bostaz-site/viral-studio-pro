"use client"

import { AnimatedSection } from '@/components/landing/animated-section'

const TESTIMONIALS = [
  {
    name: 'Jake',
    handle: '@jakestreams',
    platform: 'Twitch',
    quote: "I went from 200 views per TikTok to 15K average after switching to Viral Animal. The split-screen + karaoke combo is unbeatable.",
    metric: '75x more views',
  },
  {
    name: 'Mia',
    handle: '@mia_clips',
    platform: 'Kick',
    quote: "Used to spend 2 hours editing each clip in CapCut. Now it takes me 60 seconds. My posting frequency went from 2/week to daily.",
    metric: '3.5x more posts',
  },
  {
    name: 'Alex',
    handle: '@alexfps_',
    platform: 'YouTube',
    quote: "The AI hook reordering is insane. It puts the craziest moment first and my retention went through the roof. 10K subs in 2 months.",
    metric: '10K subs gained',
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-20 px-6 border-t border-border/30">
      <AnimatedSection className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Creators Are Blowing Up With This</h2>
          <p className="text-muted-foreground mt-3 text-lg">Real results from real creators.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.handle}
              className="rounded-xl border border-border/50 bg-card/60 p-5 flex flex-col"
            >
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.handle} &middot; {t.platform}</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {t.metric}
                </span>
              </div>
            </div>
          ))}
        </div>
      </AnimatedSection>
    </section>
  )
}
