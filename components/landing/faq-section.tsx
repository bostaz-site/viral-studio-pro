"use client"

import { ChevronDown } from 'lucide-react'

export const FAQ_ITEMS = [
  {
    q: 'Do I need to record or upload anything?',
    a: 'No. The radar browses Twitch & Kick clips for you and surfaces the best ones. You can also upload your own videos if you prefer.',
  },
  {
    q: 'How does TikTok posting work?',
    a: 'We use TikTok\'s official Direct Post API (approved). Your clip goes straight to your TikTok account — no workarounds, no third-party hacks.',
  },
  {
    q: 'What about clip rights and creator credit?',
    a: 'You\'re responsible for having permission or the necessary rights to use each clip. Viral Animal preserves creator attribution, generates credits automatically, and gives you tools to manage sourcing consistently.',
  },
  {
    q: 'When does my quota reset?',
    a: 'On the 1st of each month. Unused clips don\'t roll over. Free: 3/month, Pro: 30/month, Studio: 120/month.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — one click from your settings page (Stripe portal). No contract, no lock-in. You keep access until the end of your billing period.',
  },
]

export function FaqSection() {
  return (
    <section className="py-16 sm:py-24 px-5 border-t border-border/20">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">Questions</h2>
        </div>

        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="group rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer px-5 py-3.5 text-sm font-medium text-foreground hover:bg-zinc-800/40 transition-colors list-none">
                {item.q}
                <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0 ml-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
