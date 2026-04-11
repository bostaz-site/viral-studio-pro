"use client"

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Sparkles,
  Type,
  Layers,
  Zap,
  Check,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────────────
// Demo data — three hand-picked mock clips the user can switch between.
// Each one has its own karaoke line, author handle and score so the preview
// feels alive when you click around.
// ─────────────────────────────────────────────────────────────────────────────

interface DemoClip {
  id: string
  title: string
  streamer: string
  game: string
  accent: string // tailwind gradient classes
  line: { pre: string; hit: string; post: string }
  score: number
}

const DEMO_CLIPS: DemoClip[] = [
  {
    id: 'clutch',
    title: 'Le clutch 1v5 impossible',
    streamer: '@kameto',
    game: 'Valorant',
    accent: 'from-indigo-900/60 to-violet-900/40',
    line: { pre: "C'est", hit: 'ABSOLUMENT', post: 'incroyable' },
    score: 91,
  },
  {
    id: 'wipeout',
    title: 'La chute la plus drôle de 2026',
    streamer: '@zerator',
    game: 'Fall Guys',
    accent: 'from-emerald-900/60 to-teal-900/40',
    line: { pre: 'Non mais', hit: 'REGARDE', post: 'ça' },
    score: 84,
  },
  {
    id: 'reveal',
    title: 'Il a pas cru ce qu\'il voyait',
    streamer: '@gotaga',
    game: 'League of Legends',
    accent: 'from-fuchsia-900/60 to-rose-900/40',
    line: { pre: 'Attends', hit: 'COMMENT', post: 'c\'est possible ?!' },
    score: 88,
  },
]

// Caption styles (simplified — mirrors the feel of CAPTION_TEMPLATES without
// depending on runtime rendering of ASS styles).
type CaptionStyleId = 'hormozi' | 'hormozi_purple' | 'karaoke' | 'minimal'

interface CaptionStyleConfig {
  id: CaptionStyleId
  name: string
  description: string
  baseClass: string
  hitClass: string
  wrapperClass: string
}

const CAPTION_STYLES: CaptionStyleConfig[] = [
  {
    id: 'hormozi',
    name: 'Hormozi',
    description: 'Gros, jaune, impact maximum.',
    baseClass: 'text-white font-black uppercase tracking-wider',
    hitClass: 'text-yellow-400',
    wrapperClass: 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]',
  },
  {
    id: 'hormozi_purple',
    name: 'Hormozi Purple',
    description: 'Identité Viral Studio, violet punchy.',
    baseClass: 'text-white font-black uppercase tracking-wider',
    hitClass: 'text-violet-400',
    wrapperClass: 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]',
  },
  {
    id: 'karaoke',
    name: 'Karaoké',
    description: 'Mot par mot, classique TikTok.',
    baseClass: 'text-white font-extrabold',
    hitClass: 'text-emerald-400',
    wrapperClass:
      'bg-black/80 rounded-lg px-2.5 py-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Sobre, bas de l\'écran, pas envahissant.',
    baseClass: 'text-white font-semibold',
    hitClass: 'text-white underline decoration-2',
    wrapperClass: 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]',
  },
]

export function DemoExperience() {
  const [clipId, setClipId] = useState(DEMO_CLIPS[0]?.id ?? 'clutch')
  const [captionStyleId, setCaptionStyleId] =
    useState<CaptionStyleId>('hormozi')
  const [splitScreen, setSplitScreen] = useState(true)
  const [showScore, setShowScore] = useState(true)

  const clip = useMemo(
    () => DEMO_CLIPS.find((c) => c.id === clipId) ?? DEMO_CLIPS[0]!,
    [clipId],
  )
  const style = useMemo(
    () => CAPTION_STYLES.find((s) => s.id === captionStyleId) ?? CAPTION_STYLES[0]!,
    [captionStyleId],
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent"
          >
            VIRAL STUDIO
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <Button variant="ghost" size="sm">
                Tarifs
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="gap-1.5">
                Essai gratuit
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-16 pb-8 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à l&apos;accueil
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-xs font-semibold text-emerald-400 mb-5">
            <Sparkles className="h-3 w-3" />
            Démo live — aucun compte requis
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1] mb-4">
            Teste sans t&apos;inscrire.
            <br />
            <span className="bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
              Change les options, regarde le rendu.
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Clique sur un clip, change le style des sous-titres, active le
            split-screen. C&apos;est exactement ce que tu obtiens dans
            l&apos;app — en vrai format vertical 9:16.
          </p>
        </div>
      </section>

      {/* Interactive studio */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Preview */}
          <div className="order-2 lg:order-1 flex justify-center items-start">
            <PhonePreview
              clip={clip}
              style={style}
              splitScreen={splitScreen}
              showScore={showScore}
            />
          </div>

          {/* Controls */}
          <div className="order-1 lg:order-2 space-y-6">
            {/* Clip picker */}
            <ControlCard
              icon={<Sparkles className="h-4 w-4" />}
              title="1. Choisis un clip"
              subtitle="Trois moments pris de vrais streams"
            >
              <div className="space-y-2">
                {DEMO_CLIPS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setClipId(c.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                      c.id === clipId
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                        : 'border-border bg-card/40 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {c.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.streamer} · {c.game}
                        </p>
                      </div>
                      {c.id === clipId && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ControlCard>

            {/* Caption style */}
            <ControlCard
              icon={<Type className="h-4 w-4" />}
              title="2. Style des sous-titres"
              subtitle="Preview live dans le téléphone"
            >
              <div className="grid grid-cols-2 gap-2">
                {CAPTION_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCaptionStyleId(s.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                      s.id === captionStyleId
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                        : 'border-border bg-card/40 hover:border-primary/40'
                    }`}
                  >
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {s.description}
                    </p>
                  </button>
                ))}
              </div>
            </ControlCard>

            {/* Toggles */}
            <ControlCard
              icon={<Layers className="h-4 w-4" />}
              title="3. Options de rendu"
              subtitle="Tout est inclus gratuitement"
            >
              <div className="space-y-2">
                <ToggleRow
                  label="Split-screen (Subway Surfers)"
                  description="Gameplay satisfaisant en bas"
                  value={splitScreen}
                  onChange={setSplitScreen}
                />
                <ToggleRow
                  label="Score viral IA"
                  description="Badge avec score 0-100"
                  value={showScore}
                  onChange={setShowScore}
                />
              </div>
            </ControlCard>

            {/* CTA */}
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="rounded-lg bg-primary/15 p-2">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold">Tu veux le vrai ?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    3 clips par mois offerts, sans carte bancaire. Split-screen
                    inclus sur tous les plans.
                  </p>
                </div>
              </div>
              <Link href="/signup" className="block">
                <Button size="sm" className="w-full gap-1.5">
                  Commencer gratuitement
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="py-12 px-6 border-t border-border bg-card/30">
        <div className="max-w-4xl mx-auto grid gap-6 sm:grid-cols-3 text-center">
          <Stat value="< 5 min" label="Du clip brut au rendu final" />
          <Stat value="9 styles" label="Sous-titres karaoké disponibles" />
          <Stat value="0 $" label="Pour commencer, sans carte" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>
            Viral Studio Pro — Transformez vos clips Twitch en vidéos virales
          </p>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Tarifs
            </Link>
            <Link href="/changelog" className="hover:text-foreground transition-colors">
              Changelog
            </Link>
            <Link href="/" className="hover:text-foreground transition-colors">
              Accueil
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Phone preview ───────────────────────────────────────────────────────────
interface PhonePreviewProps {
  clip: DemoClip
  style: CaptionStyleConfig
  splitScreen: boolean
  showScore: boolean
}

function PhonePreview({
  clip,
  style,
  splitScreen,
  showScore,
}: PhonePreviewProps) {
  const topHeight = splitScreen ? '60%' : '100%'

  return (
    <div className="relative">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
        <span className="bg-emerald-500/90 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
          Preview live
        </span>
      </div>
      <div className="w-[260px] sm:w-[300px] rounded-[2.5rem] border-2 border-border bg-gray-900 p-2.5 shadow-2xl shadow-primary/10">
        <div
          className="relative rounded-[2rem] overflow-hidden bg-black"
          style={{ aspectRatio: '9/16' }}
        >
          {/* Top: stream clip */}
          <div
            className={`absolute inset-x-0 top-0 bg-gradient-to-br ${clip.accent} transition-all duration-500 flex items-center justify-center`}
            style={{ height: topHeight }}
          >
            {/* LIVE tag */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-bold text-white/80 tracking-wider">
                LIVE
              </span>
            </div>
            {/* Streamer handle */}
            <div className="absolute top-3 right-3 bg-black/50 rounded-full px-2 py-0.5 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-white/90">
                {clip.streamer}
              </span>
            </div>
            <div className="text-center px-4">
              <p className="text-[11px] text-white/70 font-medium">
                {clip.game}
              </p>
              <p className="text-xs text-white/90 font-bold mt-1 leading-tight">
                {clip.title}
              </p>
            </div>

            {/* Score badge */}
            {showScore && (
              <div className="absolute bottom-3 right-3 bg-black/70 rounded-md px-2 py-1 border border-emerald-500/40 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
                  <span className="text-[10px] font-black text-emerald-400">
                    {clip.score}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Split-screen gameplay */}
          {splitScreen && (
            <>
              <div className="absolute top-[60%] inset-x-0 h-[2px] bg-blue-500/40" />
              <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-br from-emerald-900/40 via-teal-900/30 to-cyan-900/30 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(16,185,129,0.08)_25%,transparent_25%,transparent_50%,rgba(16,185,129,0.08)_50%,rgba(16,185,129,0.08)_75%,transparent_75%)] bg-[length:16px_16px] animate-[pulse_3s_ease-in-out_infinite]" />
                <div className="relative text-center">
                  <p className="text-[10px] text-emerald-300/80 font-bold uppercase tracking-wider">
                    Subway Surfers
                  </p>
                  <p className="text-[9px] text-emerald-300/50 mt-0.5">
                    Gameplay 4K · 60fps
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Karaoke caption — centered horizontally, sits near the bottom of
              the top section so it's always visible regardless of split toggle */}
          <div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-500"
            style={{
              bottom: splitScreen ? '44%' : '18%',
            }}
          >
            <div className={`${style.wrapperClass} px-3 py-1`}>
              <p className={`text-[13px] ${style.baseClass} whitespace-nowrap`}>
                <span>{clip.line.pre}</span>{' '}
                <span className={style.hitClass}>{clip.line.hit}</span>{' '}
                <span>{clip.line.post}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Control card ────────────────────────────────────────────────────────────
interface ControlCardProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  children: React.ReactNode
}

function ControlCard({ icon, title, subtitle, children }: ControlCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Toggle row ──────────────────────────────────────────────────────────────
interface ToggleRowProps {
  label: string
  description: string
  value: boolean
  onChange: (next: boolean) => void
}

function ToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 hover:border-primary/40 transition-colors text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          value ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

// ─── Stat ────────────────────────────────────────────────────────────────────
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-black bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}
