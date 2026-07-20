"use client"

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { AnimatedSection } from '@/components/landing/animated-section'

const CHECKLIST = [
  'Vertical crop optimized',
  'Hook added',
  'Captions synchronized',
  'Creator credited',
]

export function BeforeAfterSection() {
  const [visibleChecks, setVisibleChecks] = useState(0)
  const [showVerdict, setShowVerdict] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggered = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !triggered.current) {
        triggered.current = true
        CHECKLIST.forEach((_, i) => {
          setTimeout(() => setVisibleChecks(i + 1), (i + 1) * 400)
        })
        setTimeout(() => setShowVerdict(true), (CHECKLIST.length + 1) * 400)
      }
    }, { threshold: 0.4 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section className="py-16 sm:py-24 px-5 border-t border-border/20">
      <AnimatedSection>
        <div className="max-w-4xl mx-auto text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">One click. TikTok-ready.</h2>
        </div>
      </AnimatedSection>

      <div ref={ref} className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-6 sm:gap-10 items-center">
        {/* Before / After visual */}
        <AnimatedSection>
          <div className="flex items-center gap-4">
            {/* Before — 16:9 */}
            <div className="flex-1 aspect-video rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Raw 16:9</p>
            </div>
            <div className="text-amber-500 font-black shrink-0">&rarr;</div>
            {/* After — phone */}
            <div className="w-20 shrink-0">
              <div className="aspect-[9/16] rounded-xl bg-zinc-800 border-2 border-zinc-600 relative overflow-hidden flex flex-col items-center justify-end p-2">
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-700/20 to-zinc-900/60" />
                {/* Captions mockup */}
                <div className="relative space-y-0.5 mb-2 w-full">
                  <div className="landing-caption-pop h-1.5 bg-white/90 rounded-full w-3/4 mx-auto" style={{ animationDelay: '0s' }} />
                  <div className="landing-caption-pop h-1.5 bg-amber-400/80 rounded-full w-1/2 mx-auto" style={{ animationDelay: '0.4s' }} />
                  <div className="landing-caption-pop h-1.5 bg-white/70 rounded-full w-2/3 mx-auto" style={{ animationDelay: '0.8s' }} />
                </div>
                <p className="relative text-[7px] text-zinc-400 font-bold">9:16</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Checklist panel */}
        <AnimatedSection delay={0.15}>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
            {/* Score bar */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Blowup Chance</span>
              <span className="text-lg font-black text-foreground">94</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">High potential</span>
            </div>

            {/* Checklist */}
            <div className="space-y-2.5">
              {CHECKLIST.map((item, i) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 transition-all duration-300"
                  style={{ opacity: visibleChecks > i ? 1 : 0.3, transform: visibleChecks > i ? 'translateX(0)' : 'translateX(-4px)' }}
                >
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${visibleChecks > i ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                    {visibleChecks > i && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-xs text-zinc-300">{item}</span>
                </div>
              ))}
            </div>

            {/* Verdict */}
            {showVerdict && (
              <div className="mt-4 pt-3 border-t border-zinc-700/50 text-center animate-[scorePop_0.4s_ease-out]">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Viral Ready</span>
              </div>
            )}
          </div>
        </AnimatedSection>
      </div>

      {/* Micro-features */}
      <AnimatedSection delay={0.3}>
        <div className="max-w-3xl mx-auto mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] text-zinc-500">
          <span>Karaoke captions (5 styles)</span>
          <span className="text-zinc-700">&middot;</span>
          <span>AI hook + smart zoom</span>
          <span className="text-zinc-700">&middot;</span>
          <span>Automatic creator credit</span>
        </div>
      </AnimatedSection>
    </section>
  )
}
