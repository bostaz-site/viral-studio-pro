"use client"

import { Subtitles, MonitorPlay, TrendingUp, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AnimatedSection } from '@/components/landing/animated-section'

const FEATURES = [
  {
    icon: Subtitles,
    title: 'Karaoke Captions',
    description: '9 word-by-word animated caption styles — Hormozi, MrBeast, Gaming, Minimal and more. The format that drives 3x TikTok retention.',
  },
  {
    icon: MonitorPlay,
    title: 'Auto Split-Screen',
    description: 'Stack your stream clip on top with Subway Surfers, Minecraft parkour, or other satisfying video below. The signature format no other tool has.',
  },
  {
    icon: TrendingUp,
    title: 'AI Viral Score',
    description: 'Claude AI scores every clip 0-100 with detailed breakdown: hook strength, retention curve, emotional arc. Know exactly which clips pop off.',
  },
  {
    icon: Sparkles,
    title: 'Remake This',
    description: 'See a trending clip? Hit "Remake" and AI adapts the format, captions, and style to your content. Learn from the best without copying.',
  },
]

export function FeaturesGrid() {
  return (
    <section className="py-20 px-6 bg-card/30 border-t border-border/30">
      <AnimatedSection className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything You Need to Blow Up on TikTok</h2>
          <p className="text-muted-foreground mt-3 text-lg">Split-screen, captions, viral score — the winning combo for creators scaling to millions</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map((feat) => (
            <Card key={feat.title} className="bg-card/60 border-border hover:border-primary/20 transition-colors">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                  <feat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feat.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </AnimatedSection>
    </section>
  )
}
