import type { Metadata } from 'next'
import Link from 'next/link'
import { Scissors, ArrowRight, Zap, Heart, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'About — Viral Animal',
  description: 'Discover the story behind Viral Animal. A tool built by a content creator, for content creators.',
  openGraph: {
    title: 'About — Viral Animal',
    description: 'The story behind Viral Animal. A tool built by a creator, for creators.',
  },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Scissors className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              VIRAL ANIMAL
            </span>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
              Free trial
            </Button>
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-16">
            <p className="text-sm text-primary font-medium mb-3">About</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Built by a streamer tired of losing his best moments
            </h1>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
              I'm Samy. Like you, I streamed for hours but my best reactions stayed buried on Twitch with 12 viewers.
            </p>
          </div>

          {/* Story */}
          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <p>
              The problem was simple: I saw clip channels exploding on TikTok with split-screen format (stream on top, Subway Surfers at bottom, karaoke captions). But to do that, you either spent 2 hours in CapCut or paid an editor.
            </p>
            <p>
              I tried OpusClip, Eklipse, and every tool on the market. None did automatic split-screen. None told me why a clip would work or not. None let me get inspired by trending formats for my own clips.
            </p>
            <p>
              So I decided to build it myself.
            </p>
            <p className="text-foreground font-medium text-base">
              Viral Animal was born from that frustration. A single tool that does what no other combines: automatic split-screen + karaoke captions + AI viral score + Remake This.
            </p>
          </div>

          {/* Values */}
          <div className="grid sm:grid-cols-3 gap-6 mt-16">
            <div className="rounded-xl border border-border bg-card/60 p-5">
              <Zap className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Speed</h3>
              <p className="text-xs text-muted-foreground">5 minutes to a ready-to-post clip. Not 2 hours in editing software.</p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-5">
              <Target className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Precision</h3>
              <p className="text-xs text-muted-foreground">AI analyzes every clip and tells you exactly what to improve to maximize views.</p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-5">
              <Heart className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">For creators</h3>
              <p className="text-xs text-muted-foreground">Built by someone who understands your problems because he's lived them.</p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <Link href="/signup">
              <Button size="lg" className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-2">
                Try free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground/60 mt-3">3 free clips per month, no card required</p>
          </div>
        </div>
      </main>
    </div>
  )
}
