"use client"

import { ChevronDown } from 'lucide-react'

export const FAQ_ITEMS = [
  {
    q: 'Is reposting clips allowed?',
    a: "You're responsible for having permission or the necessary rights to use each clip. Viral Animal preserves creator attribution, generates credits automatically, and gives you tools to manage sourcing consistently.",
  },
  {
    q: 'Do I need to record or upload anything?',
    a: "No. The radar finds trending clips for you \u2014 pick one and it's TikTok-ready in three clicks. You can also upload your own videos if you want.",
  },
  {
    q: 'Is the TikTok posting official?',
    a: "Yes. Viral Animal uses TikTok's official Direct Post API and is an approved integration. Your account stays fully in your control.",
  },
  {
    q: 'What happens when I hit my monthly quota?',
    a: 'Your quota resets on the 1st of each month. You can upgrade anytime to unlock more clips \u2014 upgrades apply instantly.',
  },
  {
    q: 'Can I cancel?',
    a: 'Anytime, in one click, from your billing portal. No emails, no phone calls.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="py-16 sm:py-24 px-5" style={{ background: '#0B0F1E' }}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#F8FAFC]">
            Questions clippers actually ask
          </h2>
        </div>

        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <details
              key={i}
              name="faq"
              className="group rounded-xl overflow-hidden"
              style={{
                border: '1px solid rgba(148,163,184,.12)',
                background: 'rgba(15,23,42,.5)',
              }}
            >
              <summary
                className="flex items-center justify-between cursor-pointer px-5 text-sm font-medium text-[#E2E8F0] list-none select-none transition-colors"
                style={{ minHeight: 52, paddingTop: 14, paddingBottom: 14 }}
              >
                {item.q}
                <ChevronDown className="h-4 w-4 shrink-0 ml-4 transition-transform group-open:rotate-180" style={{ color: '#64748B' }} />
              </summary>
              <div
                className="px-5 pb-4 text-sm leading-relaxed"
                style={{ color: '#94A3B8' }}
              >
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
