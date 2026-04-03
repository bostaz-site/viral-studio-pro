"use client"

import { Check } from 'lucide-react'
import { AnimatedSection } from '@/components/landing/animated-section'

const COMPARISON_ROWS = [
  { feature: 'Split-screen automatique', us: true, opus: false, eklipse: false },
  { feature: 'Sous-titres karaok\u00e9 (9 styles)', us: true, opus: true, eklipse: true },
  { feature: 'Score viral IA', us: true, opus: true, eklipse: false },
  { feature: 'Remake This (clone un trending)', us: true, opus: false, eklipse: false },
  { feature: 'Clips Twitch + YouTube Gaming', us: true, opus: true, eklipse: true },
  { feature: 'Vid\u00e9o satisfaisante int\u00e9gr\u00e9e', us: true, opus: false, eklipse: false },
  { feature: '\u00c0 partir de 0\u20ac/mois', us: true, opus: false, eklipse: true },
]

export function ComparisonSection() {
  return (
    <section className="py-20 px-6 border-t border-border/30">
      <AnimatedSection className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">D&eacute;j&agrave; test&eacute; OpusClip ou Eklipse ?</h2>
          <p className="text-muted-foreground mt-3 text-lg">Voil&agrave; pourquoi les cr&eacute;ateurs qui les ont test&eacute;s switchent chez nous</p>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/60">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fonctionnalit&eacute;</th>
                <th className="text-center py-3 px-4 font-bold text-primary">Viral Studio</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">OpusClip</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Eklipse</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 px-4 text-foreground text-xs sm:text-sm">{row.feature}</td>
                  <td className="py-2.5 px-4 text-center">
                    {row.us ? <Check className="h-4 w-4 text-emerald-400 mx-auto" /> : <span className="text-red-400 text-xs">—</span>}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {row.opus ? <Check className="h-4 w-4 text-muted-foreground/40 mx-auto" /> : <span className="text-red-400 text-xs">—</span>}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {row.eklipse ? <Check className="h-4 w-4 text-muted-foreground/40 mx-auto" /> : <span className="text-red-400 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AnimatedSection>
    </section>
  )
}
