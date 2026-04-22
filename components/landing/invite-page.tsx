'use client'

import Link from 'next/link'
import { Captions, MonitorPlay, Share2, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

const FEATURES = [
  {
    icon: Captions,
    title: 'Auto Captions',
    description: 'Karaoke-style subtitles generated instantly',
    color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400',
  },
  {
    icon: MonitorPlay,
    title: 'Split-Screen',
    description: 'Gameplay footage below for maximum retention',
    color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-400',
  },
  {
    icon: Share2,
    title: 'Multi-Platform',
    description: 'Publish to TikTok, YouTube Shorts, and Reels',
    color: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
  },
]

export function InvitePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-primary">100% Free to Start</span>
      </div>

      {/* Hero */}
      <h1 className="text-4xl md:text-5xl font-black text-center tracking-tight text-foreground max-w-2xl leading-tight">
        Turn Your Streams Into{' '}
        <span className="bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
          Viral Clips
        </span>
      </h1>
      <p className="text-lg text-muted-foreground text-center mt-4 max-w-md">
        Auto captions, split-screen, AI hook reorder — one click to make any clip go viral.
      </p>

      {/* CTA */}
      <Link href="/signup" className="mt-8">
        <Button size="lg" className="gap-2 h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-blue-500/20">
          Start Free
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 max-w-3xl w-full">
        {FEATURES.map(f => (
          <div
            key={f.title}
            className="rounded-2xl border border-border bg-card/50 p-6 text-center"
          >
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br border mb-4 ${f.color}`}>
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">{f.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
          </div>
        ))}
      </div>

      {/* Social proof */}
      <p className="text-sm text-muted-foreground mt-12">
        Join <span className="font-bold text-foreground">500+</span> creators already using Viral Animal
      </p>

      {/* Footer CTA */}
      <div className="mt-8 flex items-center gap-4">
        <Link href="/signup">
          <Button variant="outline" className="gap-1.5">
            Create Free Account <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Learn more
        </Link>
      </div>
    </div>
  )
}
