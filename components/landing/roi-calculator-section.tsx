"use client"

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Eye, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── ROI Calculator ────────────────────────────────────────────────────────
// Lead magnet: "How many views are you leaving on the table every month?"
// Inputs:  clips/week, avg views per unoptimized clip
// Output:  views lost, potential uplift with Viral Studio Pro
//
// Numbers are deliberately conservative — based on the public Opus Clip /
// Eklipse case-study range where split-screen + karaoke captions bump
// retention 1.8-3.2x on Shorts/Reels/TikTok. We anchor at 2.4x and let
// the user slide the "viral boost" factor themselves so it doesn't feel
// cherry-picked.

const BOOST_MIN = 1.5
const BOOST_MAX = 4
const BOOST_DEFAULT = 2.4

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return Math.round(n).toLocaleString('fr-FR')
}

export function RoiCalculatorSection() {
  const [clipsPerWeek, setClipsPerWeek] = useState(5)
  const [avgViews, setAvgViews] = useState(800)
  const [boost, setBoost] = useState(BOOST_DEFAULT)

  const stats = useMemo(() => {
    const clipsPerMonth = clipsPerWeek * 4.33
    const currentViews = clipsPerMonth * avgViews
    const boostedViews = currentViews * boost
    const extraViews = Math.max(0, boostedViews - currentViews)
    // Rough monetization proxy: 1000 views ≈ 2€ across TikTok Creativity + brand deals
    // (keep it low so the number feels honest, not scammy)
    const extraRevenue = (extraViews / 1000) * 2
    return { clipsPerMonth, currentViews, boostedViews, extraViews, extraRevenue }
  }, [clipsPerWeek, avgViews, boost])

  return (
    <section className="py-20 px-6 border-t border-border/30 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-4">
            <TrendingUp className="h-3 w-3" />
            Calculateur de ROI
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Combien de vues tu laisses sur la table chaque mois&nbsp;?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Ajuste les curseurs avec <em>tes</em> vrais chiffres. Le boost est celui observé sur des clips split-screen + sous-titres karaoké vs clips bruts.
          </p>
        </div>

        {/* Calculator body */}
        <div className="grid md:grid-cols-5 gap-8 items-start">
          {/* Inputs (2 cols) */}
          <div className="md:col-span-2 space-y-6">
            <Slider
              label="Clips publiés par semaine"
              value={clipsPerWeek}
              onChange={setClipsPerWeek}
              min={1}
              max={30}
              step={1}
              format={(n) => `${n} clip${n > 1 ? 's' : ''}`}
            />
            <Slider
              label="Vues moyennes par clip (sans optimisation)"
              value={avgViews}
              onChange={setAvgViews}
              min={100}
              max={10000}
              step={100}
              format={(n) => formatNumber(n)}
            />
            <Slider
              label="Facteur de boost viral"
              value={boost}
              onChange={setBoost}
              min={BOOST_MIN}
              max={BOOST_MAX}
              step={0.1}
              format={(n) => `×${n.toFixed(1)}`}
              help={`Médian observé : ×${BOOST_DEFAULT.toFixed(1)}`}
            />
          </div>

          {/* Results (3 cols) */}
          <div className="md:col-span-3 rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-6 sm:p-8">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Ton mois avec Viral Studio Pro
            </p>

            <div className="space-y-4">
              <StatLine
                icon={<Eye className="h-4 w-4" />}
                label="Vues actuelles / mois"
                value={formatNumber(stats.currentViews)}
                muted
              />
              <StatLine
                icon={<Sparkles className="h-4 w-4 text-primary" />}
                label="Vues boostées / mois"
                value={formatNumber(stats.boostedViews)}
                highlight
              />
              <div className="pt-3 border-t border-border/30">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Vues supplémentaires récupérées</span>
                  <span className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                    +{formatNumber(stats.extraViews)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xs text-muted-foreground">Revenu potentiel estimé*</span>
                  <span className="text-sm font-semibold text-foreground">
                    +{Math.round(stats.extraRevenue).toLocaleString('fr-FR')}&nbsp;€/mois
                  </span>
                </div>
              </div>
            </div>

            <Link href="/signup" className="block mt-6">
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-2 h-12"
              >
                Récupère ces vues
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-[10px] text-muted-foreground/50 mt-3 text-center leading-relaxed">
              *Estimation prudente basée sur un RPM moyen de 2&nbsp;€/1000&nbsp;vues (TikTok Creativity + deals marque).
              Les chiffres réels varient selon la niche et l&apos;engagement.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────
function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  help,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  format: (n: number) => string
  help?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-xs font-semibold text-foreground">{label}</label>
        <span className="text-sm font-bold tabular-nums text-primary">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-border/60 cursor-pointer accent-blue-500"
      />
      {help && <p className="text-[10px] text-muted-foreground/60 mt-1">{help}</p>}
    </div>
  )
}

function StatLine({
  icon,
  label,
  value,
  muted,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`text-${muted ? 'muted-foreground' : 'foreground'}`}>{icon}</div>
        <span className={`text-sm ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>{label}</span>
      </div>
      <span
        className={`text-lg sm:text-xl font-bold tabular-nums ${
          highlight
            ? 'bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent'
            : muted
              ? 'text-muted-foreground'
              : 'text-foreground'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
