"use client"

import { useEffect, useState } from 'react'
import { Wand2, Zap, Download, X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'vsp.onboarding.welcome.v1'

interface Step {
  icon: React.ComponentType<{ className?: string }>
  accent: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: Wand2,
    accent: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400',
    title: '1. Pick a clip',
    body: "Browse the trending Twitch clip library or upload your own. Filter by niche (IRL, FPS, MOBA, etc.) to find the right content.",
  },
  {
    icon: Zap,
    accent: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-400',
    title: '2. Click "Make Viral"',
    body: "One click applies the best settings: karaoke captions, AI hook (big moment first), smart zoom, audio enhance, and streamer tag. Rendered in under 90 seconds.",
  },
  {
    icon: Download,
    accent: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
    title: '3. Download and post',
    body: "Your 9:16 video is ready to post on TikTok, Reels, or Shorts. No watermark on paid plans.",
  },
]

export function WelcomeModal() {
  const [open, setOpen] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const done = window.localStorage.getItem(STORAGE_KEY)
      if (!done) setOpen(true)
    } catch {
      // localStorage unavailable — just skip onboarding
    }
  }, [])

  const close = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore
    }
    setOpen(false)
  }

  if (!open) return null

  const step = STEPS[stepIdx]
  const Icon = step.icon
  const isLast = stepIdx === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />

      {/* Modal card */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-8 animate-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Welcome badge (only step 0) */}
        {stepIdx === 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-semibold text-orange-400 mb-4">
            <Sparkles className="h-3 w-3" />
            Welcome to Viral Animal
          </div>
        )}

        {/* Icon */}
        <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br border mb-5', step.accent)}>
          <Icon className="h-7 w-7" />
        </div>

        {/* Title + body */}
        <h2 className="text-2xl font-black tracking-tight text-foreground">{step.title}</h2>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{step.body}</p>

        {/* Step dots */}
        <div className="flex items-center gap-1.5 mt-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === stepIdx ? 'w-8 bg-orange-400' : 'w-1.5 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center justify-between gap-3 mt-6">
          {stepIdx > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStepIdx((i) => i - 1)}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={close} className="text-muted-foreground">
              Skip
            </Button>
          )}

          {isLast ? (
            <Button
              onClick={close}
              className="gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              onClick={() => setStepIdx((i) => i + 1)}
              className="gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold"
            >
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
