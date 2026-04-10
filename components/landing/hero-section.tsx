/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  MonitorPlay, ArrowRight, Play, Clock, Sparkles, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Platform SVG Icons ─────────────────────────────────────────────────────

function TwitchLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  )
}

function YouTubeLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function TikTokLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

function InstagramLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  )
}

// ─── Hero Demo (shared animation) ───────────────────────────────────────────

import { ClipTransformAnimation } from '@/components/shared/clip-transform-animation'

// ─── ValueProps (replaces fake StatsCounter) ───────────────────────────────

function ValueProps() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 mt-12 pt-8 border-t border-border/20">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10 border border-orange-500/20">
          <Zap className="h-4 w-4 text-orange-400" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-foreground leading-tight">1 clic</p>
          <p className="text-xs text-muted-foreground">setup viral auto</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
          <Clock className="h-4 w-4 text-blue-400" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-foreground leading-tight">&lt; 90 sec</p>
          <p className="text-xs text-muted-foreground">par clip rendu</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/10 border border-purple-500/20">
          <Sparkles className="h-4 w-4 text-purple-400" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-foreground leading-tight">Hook IA</p>
          <p className="text-xs text-muted-foreground">gros moment en 1er</p>
        </div>
      </div>
    </div>
  )
}

// ─── StickyBar ──────────────────────────────────────────────────────────────

function StickyBar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
      setVisible(scrollPercent > 0.25 && scrollPercent < 0.8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/50 py-2.5 px-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground hidden sm:block">
          <span className="font-semibold text-foreground">Essai gratuit</span> &middot; Sans carte bancaire
        </p>
        <Link href="/signup">
          <Button size="sm" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold gap-1.5 h-9 px-6">
            Commencer gratuitement
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

// ─── HeroSection (main export) ──────────────────────────────────────────────

export function HeroSection() {
  return (
    <>
      <StickyBar />

      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/20 bg-orange-500/5 text-sm text-orange-400 mb-8">
              <MonitorPlay className="h-3.5 w-3.5" />
              Clip Twitch &rarr; TikTok viral en 1 clic
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1]">
              Transforme tes clips Twitch en{' '}
              <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
                clips viraux
              </span>{' '}
              en 90&nbsp;secondes
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
              Sous-titres karaok&eacute;, split-screen gameplay, hook automatique, tag streamer.
              Un bouton &laquo;&nbsp;Make it viral&nbsp;&raquo; applique la formule qui marche sur TikTok &mdash; sans CapCut, sans montage.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Link href="/signup">
                <Button size="lg" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 h-12 px-8 text-base font-bold gap-2">
                  Essayer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/blog/creer-clips-viraux-twitch-guide-2026">
                <Button variant="ghost" size="lg" className="h-12 px-6 text-base text-muted-foreground hover:text-foreground gap-2">
                  <Play className="h-4 w-4" />
                  Voir une d&eacute;mo
                </Button>
              </Link>
            </div>

            <p className="text-xs text-muted-foreground/60 mt-4">
              Sans carte bancaire &middot; Aucune installation &middot; Annulable en 1 clic
            </p>
          </div>

          {/* Clip transformation demo */}
          <div className="mt-14">
            <ClipTransformAnimation />
          </div>

          {/* Pain point */}
          <p className="text-sm text-muted-foreground/70 mt-10 italic max-w-lg mx-auto text-center">
            Tu passes des heures &agrave; streamer. Tes meilleurs moments restent enterr&eacute;s sur Twitch &agrave; 12 viewers.
            C&apos;est termin&eacute;.
          </p>

          {/* Value props (replaces fake counter stats) */}
          <ValueProps />

          {/* Platform logos */}
          <div className="mt-10 text-center">
            <p className="text-xs text-muted-foreground/50 uppercase tracking-wider mb-4">Compatible avec</p>
            <div className="flex items-center justify-center gap-8">
              <div className="flex items-center gap-2 text-muted-foreground/40 hover:text-purple-400 transition-colors">
                <TwitchLogo className="h-6 w-6" />
                <span className="text-sm font-medium">Twitch</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground/40 hover:text-red-400 transition-colors">
                <YouTubeLogo className="h-6 w-6" />
                <span className="text-sm font-medium">YouTube</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground/40 hover:text-foreground transition-colors">
                <TikTokLogo className="h-6 w-6" />
                <span className="text-sm font-medium">TikTok</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground/40 hover:text-pink-400 transition-colors">
                <InstagramLogo className="h-6 w-6" />
                <span className="text-sm font-medium">Instagram</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
