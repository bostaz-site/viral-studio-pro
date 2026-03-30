"use client"

import { Subtitles, MonitorPlay, TrendingUp, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AnimatedSection } from '@/components/landing/animated-section'

const FEATURES = [
  {
    icon: Subtitles,
    title: 'Sous-titres karaok\u00e9',
    description: '9 styles de captions anim\u00e9s mot par mot \u2014 Hormozi, MrBeast, Gaming, Minimal et plus. Le format qui fait x3 sur la r\u00e9tention TikTok.',
  },
  {
    icon: MonitorPlay,
    title: 'Split-screen automatique',
    description: 'Combine ton clip de stream en haut avec Subway Surfers, Minecraft parkour ou autre vid\u00e9o satisfaisante en bas. Le format signature qui n\'existe nulle part ailleurs.',
  },
  {
    icon: TrendingUp,
    title: 'Score viral IA',
    description: 'Claude IA analyse chaque clip et attribue un score 0-100 avec une explication d\u00e9taill\u00e9e : hook, r\u00e9tention, \u00e9motion. Tu sais exactement quel clip va performer.',
  },
  {
    icon: Sparkles,
    title: 'Remake This',
    description: 'Tu vois un clip trending ? Clique "Remake" et l\'IA adapte le format, les sous-titres et le style \u00e0 ton propre contenu. Inspire-toi des meilleurs sans copier.',
  },
]

export function FeaturesGrid() {
  return (
    <section className="py-20 px-6 bg-card/30 border-t border-border/30">
      <AnimatedSection className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Tout ce qu&apos;il te faut pour exploser sur TikTok</h2>
          <p className="text-muted-foreground mt-3 text-lg">Split-screen, sous-titres, score viral — le combo gagnant des cr&eacute;ateurs qui scalent</p>
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
