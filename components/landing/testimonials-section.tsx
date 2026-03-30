"use client"

import Link from 'next/link'
import { TrendingUp, Star, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AnimatedSection } from '@/components/landing/animated-section'

const TESTIMONIALS = [
  {
    name: 'Lucas "Zephyr" Martin',
    handle: '@zephyr_clips',
    handleUrl: 'https://www.tiktok.com/@zephyr_clips',
    platform: 'TikTok',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Lucas&backgroundColor=b6e3f4',
    color: 'from-purple-500 to-pink-500',
    quote: 'Avant Viral Studio, personne regardait mes clips. J\'ai commenc\u00e9 \u00e0 poster avec le split-screen Subway Surfers et les sous-titres karaok\u00e9 \u2014 en 2 mois j\'\u00e9tais \u00e0 45K. C\'est devenu ma routine : je stream, je clippe, je poste.',
    stats: '45K followers en 2 mois',
    rating: 5,
    date: 'il y a 3 semaines',
  },
  {
    name: 'Sarah Chen',
    handle: '@sarahplays_',
    handleUrl: 'https://www.instagram.com/sarahplays_',
    platform: 'Instagram',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Sarah&backgroundColor=ffd5dc',
    color: 'from-blue-500 to-cyan-500',
    quote: 'Je suis streameuse Valorant et je d\u00e9testais passer 2h \u00e0 \u00e9diter un seul clip. Maintenant j\'en fais 5 en 30 min et mes Reels font 10 fois plus de vues qu\'avant. Le gain de temps est juste dingue.',
    stats: '10x plus de vues',
    rating: 5,
    date: 'il y a 1 semaine',
  },
  {
    name: 'Th\u00e9o Dubois',
    handle: '@theo_gaming',
    handleUrl: 'https://www.youtube.com/@theo_gaming',
    platform: 'YouTube',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Theo&backgroundColor=c0aede',
    color: 'from-red-500 to-orange-500',
    quote: 'Le truc qui m\'a scotch\u00e9 c\'est le score viral. Il m\'a sorti un moment dans mon stream que j\'avais m\u00eame pas remarqu\u00e9 \u2014 120K vues. Depuis je laisse l\'IA choisir mes clips et \u00e7a marche mieux que quand je le fais moi-m\u00eame.',
    stats: '120K vues sur un clip',
    rating: 4,
    date: 'il y a 1 mois',
  },
  {
    name: 'Emma "Pixel" Roy',
    handle: '@pixelstreams',
    handleUrl: 'https://www.tiktok.com/@pixelstreams',
    platform: 'TikTok',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Emma&backgroundColor=d1f4d1',
    color: 'from-emerald-500 to-teal-500',
    quote: 'J\'ai test\u00e9 OpusClip, Eklipse, tout. Aucun ne fait le split-screen automatique. Avec Viral Studio mes clips Minecraft avec mes r\u00e9actions en haut cartonnent \u2014 c\'est devenu mon format signature.',
    stats: '200K vues moyennes',
    rating: 5,
    date: 'il y a 2 semaines',
  },
  {
    name: 'Marc "FitMarc" Lef\u00e8vre',
    handle: '@fitmarc_clips',
    platform: 'TikTok',
    photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Marc&backgroundColor=ffecd2',
    color: 'from-orange-500 to-amber-500',
    quote: 'Je suis coach fitness et je livestream mes s\u00e9ances sur YouTube. Viral Studio m\'a permis de clipper les meilleurs moments avec des sous-titres motivants. Mon audience TikTok a explos\u00e9 alors que j\'y connaissais rien en montage.',
    stats: '32K followers en 6 semaines',
    rating: 5,
    date: 'il y a 5 jours',
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-20 px-6 border-t border-border/30">
      <AnimatedSection className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Des cr&eacute;ateurs comme toi, qui cartonnent</h2>
          <p className="text-muted-foreground mt-3 text-lg">+2,340 streamers utilisent Viral Studio pour clipper et poster</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {TESTIMONIALS.map((t) => (
            <Card key={t.handle} className="bg-card/60 border-border hover:border-primary/20 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.photoUrl}
                    alt={t.name}
                    className="w-10 h-10 rounded-full shrink-0 bg-muted"
                    width={40}
                    height={40}
                  />
                  <div>
                    <p className="font-semibold text-foreground text-sm">{t.name}</p>
                    <span className="text-xs text-primary">
                      {t.handle}
                    </span>
                    <span className="text-xs text-muted-foreground"> &middot; {t.platform}</span>
                    <span className="text-xs text-muted-foreground/50"> &middot; {t.date}</span>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={cn('h-3.5 w-3.5', i < t.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-muted text-muted')} />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">{t.stats}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Post-testimonials CTA */}
        <div className="text-center mt-12">
          <Link href="/signup">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 h-11 px-8 font-semibold gap-2">
              Rejoindre +2,340 cr&eacute;ateurs
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </AnimatedSection>
    </section>
  )
}
