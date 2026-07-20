/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ViralAnimalLogo } from '@/components/brand/viral-animal-logo'
import { track } from '@/lib/analytics'

const FALLBACK_THUMB = '/landing/hero-thumb-fallback.jpg'

const WORDS = ['THIS', 'IS', 'CRAZY'] as const

export function HeroSection() {
  const [thumbUrl, setThumbUrl] = useState<string>(FALLBACK_THUMB)

  // Fetch a real thumbnail from the radar API
  useEffect(() => {
    fetch('/api/landing/radar')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const clips = j?.data?.clips
        if (!Array.isArray(clips)) return
        // Use 2nd or 3rd clip's thumbnail (1st is for the royal card below)
        const thumb = clips[1]?.thumbnail_url ?? clips[2]?.thumbnail_url ?? clips[0]?.thumbnail_url
        if (thumb) setThumbUrl(thumb)
      })
      .catch(() => { /* keep fallback */ })
  }, [])

  return (
    <section className="relative pt-24 pb-4 sm:pt-32 sm:pb-8 px-5 overflow-hidden">
      {/* Background: subtle grid + amber halo */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(56,189,248,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.04) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
      <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] pointer-events-none rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,.12), transparent 70%)' }}
      />

      {/* Content — side-by-side on desktop, stacked on mobile */}
      <div className="relative max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-8 lg:gap-12">

        {/* Left — text */}
        <div className="flex-1 text-center lg:text-left max-w-xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.08] text-foreground">
            Clips blowing up,{' '}
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
              found before the crowd.
            </span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
            Turn them into TikTok-ready posts in one click — captions, vertical crop, hook and automatic credit included.
          </p>

          <p className="mt-2 text-[11px] sm:text-xs text-zinc-500 font-medium">
            No recording. No downloading. No manual posting.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center lg:items-start gap-3">
            <Link href="/signup">
              <Button
                size="lg"
                className="w-56 h-11 text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-amber-950 shadow-lg shadow-amber-500/20"
                onClick={() => track('landing_cta_clicked', { placement: 'hero' })}
              >
                Start farming free
              </Button>
            </Link>
            <button
              onClick={() => {
                document.getElementById('radar')?.scrollIntoView({ behavior: 'smooth' })
                track('landing_cta_clicked', { placement: 'hero_watch' })
              }}
              className="h-11 px-5 text-sm font-semibold text-zinc-400 hover:text-white border border-zinc-700/60 hover:border-zinc-500 rounded-lg transition-colors"
            >
              Watch it work
            </button>
          </div>

          <p className="mt-4 text-[10px] text-zinc-500 tracking-wide">
            Free plan &middot; No credit card &middot; TikTok Direct Post approved
          </p>
        </div>

        {/* Right — transformation visual */}
        <div className="flex-shrink-0 w-full max-w-[480px] lg:max-w-[520px]">
          <div className="hero-xform flex items-center justify-center gap-3 sm:gap-5 py-4">

            {/* BEFORE — Raw clip card */}
            <div className="hero-xform-before flex-shrink-0 w-[140px] sm:w-[180px]">
              <div className="relative rounded-xl overflow-hidden border border-zinc-700/50 bg-zinc-900">
                <img
                  src={thumbUrl}
                  alt="Raw clip"
                  className="w-full aspect-video object-cover brightness-[0.6] saturate-[0.5]"
                />
                {/* Chips overlay */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-500/90 text-white leading-none">Twitch</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 text-zinc-300 leading-none tabular-nums">0:34</span>
                </div>
              </div>
              <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider text-center mt-1.5">Raw clip</p>
            </div>

            {/* BEAM — transformation energy */}
            <div className="flex flex-col items-center gap-1 shrink-0 w-10 sm:w-14">
              {/* Top particle track */}
              <div className="relative w-full h-16 sm:h-20">
                {/* Beam line */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] rounded-full overflow-hidden">
                  <div className="w-full h-full hero-beam-flow" />
                </div>
                {/* Particles */}
                <div className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,.8)] hero-particle" style={{ animationDelay: '0s' }} />
                <div className="absolute left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(245,158,11,.6)] hero-particle" style={{ animationDelay: '1.5s' }} />
              </div>
              {/* Wolf node */}
              <div className="relative z-10 w-8 h-8 rounded-full border border-amber-500/30 bg-zinc-900/90 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,.15)]">
                <ViralAnimalLogo size={20} iconOnly variant="forge" />
              </div>
              {/* Bottom particle track */}
              <div className="relative w-full h-16 sm:h-20">
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] rounded-full overflow-hidden">
                  <div className="w-full h-full hero-beam-flow" />
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,.8)] hero-particle" style={{ animationDelay: '0.6s' }} />
              </div>
            </div>

            {/* AFTER — TikTok phone */}
            <div className="hero-xform-after flex-shrink-0 w-[100px] sm:w-[120px]">
              <div className="relative aspect-[9/16] rounded-2xl border-2 border-zinc-600 bg-zinc-900 overflow-hidden shadow-[0_0_40px_rgba(245,158,11,.08)]">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-3 bg-zinc-900 rounded-b-lg z-20 border-b border-x border-zinc-700/50" />
                {/* Full thumbnail — bright, cropped 9:16 */}
                <img
                  src={thumbUrl}
                  alt="TikTok result"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Gradient overlay for captions */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {/* Captions — word pop */}
                <div className="absolute bottom-[22%] left-0 right-0 flex flex-col items-center gap-[3px] z-10">
                  {WORDS.map((word, i) => (
                    <span
                      key={word}
                      className="hero-word-pop text-[11px] sm:text-[13px] font-black uppercase tracking-wide"
                      style={{ animationDelay: `${i * 0.5}s` }}
                    >
                      {word}
                    </span>
                  ))}
                </div>

                {/* Score badge — top right */}
                <div className="absolute top-5 right-2 z-10 hero-badge-pop">
                  <span className="text-[16px] sm:text-[18px] font-black leading-none" style={{
                    background: 'linear-gradient(180deg, #FFF8E1, #F5D478 45%, #DAA520)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>94</span>
                </div>

                {/* Viral Ready chip */}
                <div className="absolute top-5 left-2 z-10 hero-badge-pop" style={{ animationDelay: '0.4s' }}>
                  <span className="px-1.5 py-0.5 rounded text-[6px] sm:text-[7px] font-extrabold uppercase tracking-wider bg-emerald-500/90 text-white leading-none">
                    Viral Ready
                  </span>
                </div>

                {/* TikTok ghost icons — right edge */}
                <div className="absolute right-1.5 bottom-[35%] flex flex-col items-center gap-3 z-10 opacity-30">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/></svg>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
