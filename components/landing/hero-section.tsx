/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, useInView } from 'framer-motion'
import {
  TrendingUp, MonitorPlay, ArrowRight, Play, Users, Film,
  Link2, ChevronDown, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Clip data with real Twitch thumbnails ──────────────────────────────────

export const STREAMER_CLIPS = [
  {
    streamer: 'KaiCenat',
    handle: '@kaicenat',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips/88IOIjUFzPnqNfIAxkEg4Q/AT-cm%7C88IOIjUFzPnqNfIAxkEg4Q-preview-480x272.jpg',
    score: 97,
    platform: 'tiktok' as const,
    caption: ['Kevin Hart', 'gets', 'DRENCHED'],
    highlightIdx: 2,
    brollGradient: 'from-emerald-600/80 to-teal-500/80',
  },
  {
    streamer: 'Jynxzi',
    handle: '@jynxzi',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips/STEG3XE8W9bFbKHyEwN5Jg/AT-cm%7CSTEG3XE8W9bFbKHyEwN5Jg-preview-480x272.jpg',
    score: 94,
    platform: 'youtube' as const,
    caption: ['Kiss', 'on the', 'LIPS'],
    highlightIdx: 2,
    brollGradient: 'from-orange-500/80 to-amber-500/80',
  },
  {
    streamer: 'xQc',
    handle: '@xqc',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips/AT-cm%7C961443378-preview-480x272.jpg',
    score: 92,
    platform: 'instagram' as const,
    caption: ['Makes', 'the WRONG', 'choice'],
    highlightIdx: 1,
    brollGradient: 'from-blue-600/80 to-cyan-500/80',
  },
  {
    streamer: 'HasanAbi',
    handle: '@hasanabi',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips/AT-cm%7C902106752-preview-480x272.jpg',
    score: 89,
    platform: 'tiktok' as const,
    caption: ['Left with', 'a', '50/50'],
    highlightIdx: 2,
    brollGradient: 'from-purple-600/80 to-pink-500/80',
  },
  {
    streamer: 'AdinRoss',
    handle: '@adinross',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips/kN5xYj8Vta-j59QgA_wgSg/AT-cm%7CkN5xYj8Vta-j59QgA_wgSg-preview-480x272.jpg',
    score: 91,
    platform: 'youtube' as const,
    caption: ['Good', 'ADVICE', 'bro'],
    highlightIdx: 1,
    brollGradient: 'from-red-500/80 to-orange-500/80',
  },
  {
    streamer: 'IShowSpeed',
    handle: '@ishowspeed',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/FlaccidRealChoughPRChase-sxx8aLkNwPOo1Jyv/8c2313f0-d1a4-4bf7-b5c5-8e71e7661418/preview-480x272.jpg',
    score: 93,
    platform: 'instagram' as const,
    caption: ['Jump', 'scared by', 'COFFEE'],
    highlightIdx: 2,
    brollGradient: 'from-yellow-500/80 to-orange-500/80',
  },
  {
    streamer: 'Marlon',
    handle: '@marlon',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/NastyPrettiestGrassItsBoshyTime-e7AxBVAwRXaRV5pc/5e34c5b0-ed3c-449d-afdc-7ec8b988a89b/preview-480x272.jpg',
    score: 88,
    platform: 'tiktok' as const,
    caption: ['More', 'than', 'FRIENDS'],
    highlightIdx: 2,
    brollGradient: 'from-emerald-500/80 to-lime-500/80',
  },
  {
    streamer: 'Sketch',
    handle: '@sketch',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips/EsTVs1C6OcD6wNMP8QL8NQ/AT-cm%7CEsTVs1C6OcD6wNMP8QL8NQ-preview-480x272.jpg',
    score: 86,
    platform: 'youtube' as const,
    caption: ['Strong', 'Minecraft', 'WEAPONS'],
    highlightIdx: 2,
    brollGradient: 'from-indigo-500/80 to-violet-500/80',
  },
]

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

type Platform = 'tiktok' | 'youtube' | 'instagram'

function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  switch (platform) {
    case 'tiktok': return <TikTokLogo className={className} />
    case 'youtube': return <YouTubeLogo className={className} />
    case 'instagram': return <InstagramLogo className={className} />
  }
}

// ─── useCountUp ─────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, target, duration])

  return { count, ref }
}

// ─── ClipCard ───────────────────────────────────────────────────────────────

export function ClipCard({ clip, delay = 0 }: { clip: typeof STREAMER_CLIPS[0]; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className="w-[145px] sm:w-[165px] flex-shrink-0"
    >
      <div
        className="relative rounded-[1.2rem] border border-white/10 overflow-hidden bg-black shadow-2xl shadow-black/40 hover:shadow-blue-500/15 transition-shadow duration-300"
        style={{ aspectRatio: '9/16' }}
      >
        {/* Top 60%: Twitch thumbnail */}
        <div className="absolute inset-x-0 top-0 h-[60%] overflow-hidden">
          <img
            src={clip.thumbnail}
            alt={clip.streamer}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

          {/* Platform icon — top left */}
          <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <PlatformIcon platform={clip.platform} className="w-3 h-3 text-white" />
          </div>

          {/* Streamer handle — top right */}
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <span className="text-[8px] sm:text-[9px] font-bold text-white">{clip.handle}</span>
          </div>
        </div>

        {/* Karaoke subtitles — at the junction */}
        <div className="absolute top-[52%] left-1/2 -translate-x-1/2 z-10 bg-black/80 rounded-lg px-2 py-1 backdrop-blur-sm">
          <p className="text-[9px] sm:text-[10px] font-black text-center whitespace-nowrap">
            {clip.caption.map((word, i) => (
              <span key={i}>
                {i === clip.highlightIdx ? (
                  <span className="text-yellow-400 bg-yellow-400/20 px-0.5 rounded">{word}</span>
                ) : (
                  <span className="text-white">{word}</span>
                )}
                {i < clip.caption.length - 1 && ' '}
              </span>
            ))}
          </p>
        </div>

        {/* Divider line */}
        <div className="absolute top-[60%] inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent z-10" />

        {/* Bottom 40%: B-roll simulation */}
        <div className={`absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-br ${clip.brollGradient} overflow-hidden`}>
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)',
              backgroundSize: '22px 22px',
              animation: 'broll-slide 2s linear infinite',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <Play className="h-2.5 w-2.5 text-white/50 ml-0.5" />
            </div>
          </div>
        </div>

        {/* Viral score badge — bottom left */}
        <div className="absolute bottom-2 left-2 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-lg px-1.5 py-0.5 shadow-lg shadow-yellow-500/25">
          <div className="flex items-center gap-0.5">
            <TrendingUp className="h-2.5 w-2.5 text-black" />
            <span className="text-[10px] font-black text-black">{clip.score}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Stream → Clips Demo ────────────────────────────────────────────────────

function StreamToClipsDemo() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    setPhase(1)
    const t1 = setTimeout(() => setPhase(2), 2500)
    const t2 = setTimeout(() => setPhase(3), 3500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const demoClips = STREAMER_CLIPS.slice(0, 6)

  return (
    <div className="mt-14">
      {/* Keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes carousel-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes broll-slide { from { background-position: 0 0; } to { background-position: 22px 22px; } }
      ` }} />

      {/* Stream preview (landscape 16:9) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: phase >= 1 ? 1 : 0,
          scale: phase >= 2 ? 0.88 : phase >= 1 ? 1 : 0.95,
          y: phase >= 2 ? -10 : 0,
        }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        className="relative mx-auto max-w-2xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/10"
        style={{ aspectRatio: '16/9' }}
      >
        <img
          src={STREAMER_CLIPS[0].thumbnail}
          alt="Stream en direct"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* LIVE badge */}
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-red-600 rounded px-2 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] sm:text-xs font-bold text-white">LIVE</span>
          </div>
          <span className="text-[10px] sm:text-xs text-white/80 font-medium bg-black/40 rounded px-2 py-0.5 backdrop-blur-sm hidden sm:inline">
            2h34m de stream
          </span>
        </div>

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center backdrop-blur-sm"
          >
            <Play className="h-6 w-6 sm:h-7 sm:w-7 text-white ml-1" />
          </motion.div>
        </div>

        {/* Streamer info */}
        <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold">
            K
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-white">KaiCenat</p>
            <p className="text-[10px] sm:text-xs text-white/60">Just Chatting &middot; 67K viewers</p>
          </div>
        </div>
      </motion.div>

      {/* Split indicator */}
      <motion.div
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: phase >= 2 ? 1 : 0, scaleY: phase >= 2 ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center py-3 origin-top"
      >
        <div className="w-px h-5 bg-gradient-to-b from-blue-500/60 to-indigo-500/60" />
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1">
          <Sparkles className="h-3 w-3 text-blue-400" />
          <span className="text-[11px] sm:text-xs text-blue-400 font-semibold">IA split en 6 clips viraux</span>
        </div>
        <div className="w-px h-5 bg-gradient-to-b from-indigo-500/60 to-transparent" />
        <ChevronDown className="h-4 w-4 text-indigo-400/50 -mt-1" />
      </motion.div>

      {/* Clips carousel */}
      {phase >= 3 && (
        <div className="overflow-hidden">
          <div
            className="flex gap-4 w-max hover:[animation-play-state:paused]"
            style={{ animation: 'carousel-scroll 35s linear infinite', animationDelay: '1s' }}
          >
            {[...demoClips, ...demoClips].map((clip, i) => (
              <ClipCard key={`${clip.streamer}-${i}`} clip={clip} delay={i < 6 ? i * 0.12 : 0} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── URL Input Bar ──────────────────────────────────────────────────────────

function UrlInputBar() {
  const [url, setUrl] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(url.trim() ? `/signup?url=${encodeURIComponent(url)}` : '/signup')
  }

  return (
    <form onSubmit={handleSubmit} className="mt-12 max-w-xl mx-auto">
      <div className="relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5 pl-4 hover:border-blue-500/30 transition-colors focus-within:border-blue-500/40 focus-within:shadow-lg focus-within:shadow-blue-500/10">
        <Link2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <input
          type="url"
          placeholder="Colle un lien YouTube, Twitch, TikTok..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none py-2 min-w-0"
        />
        <Button
          type="submit"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold h-10 px-5 rounded-xl text-sm gap-1.5 flex-shrink-0"
        >
          <span className="hidden sm:inline">G&eacute;n&eacute;rer mes clips</span>
          <span className="sm:hidden">Go</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground/50 mt-2 text-center">
        YouTube, Twitch, TikTok, Instagram &mdash; tout lien vid&eacute;o fonctionne
      </p>
    </form>
  )
}

// ─── StatsCounter ───────────────────────────────────────────────────────────

function StatsCounter() {
  const clips = useCountUp(12847)
  const creators = useCountUp(2340)

  return (
    <div ref={clips.ref} className="flex flex-wrap items-center justify-center gap-8 mt-12 pt-8 border-t border-border/20">
      <div className="flex items-center gap-2">
        <Film className="h-5 w-5 text-blue-400" />
        <div className="text-left">
          <p className="text-2xl font-black text-foreground">{clips.count.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-muted-foreground">clips cr&eacute;&eacute;s</p>
        </div>
      </div>
      <div ref={creators.ref} className="flex items-center gap-2">
        <Users className="h-5 w-5 text-indigo-400" />
        <div className="text-left">
          <p className="text-2xl font-black text-foreground">{creators.count.toLocaleString('fr-FR')}+</p>
          <p className="text-xs text-muted-foreground">cr&eacute;ateurs actifs</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-emerald-400" />
        <div className="text-left">
          <p className="text-2xl font-black text-foreground">x8.5</p>
          <p className="text-xs text-muted-foreground">vues vs clips classiques</p>
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
          <span className="font-semibold text-foreground">30 clips offerts</span> &middot; Sans carte bancaire
        </p>
        <Link href="/signup">
          <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold gap-1.5 h-9 px-6">
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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-400 mb-8">
              <MonitorPlay className="h-3.5 w-3.5" />
              Le seul outil avec split-screen automatique
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1]">
              Clips viraux en{' '}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                split-screen
              </span>{' '}
              depuis tes streams
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
              Stream + Subway Surfers/Minecraft en bas + sous-titres karaok&eacute; = la formule qui explose sur TikTok.
              Le seul outil qui fait &ccedil;a automatiquement &agrave; partir de Twitch et YouTube Gaming.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Link href="/signup">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 h-12 px-8 text-base font-semibold gap-2">
                  Commencer gratuitement &mdash; 30 clips offerts
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/blog/creer-clips-viraux-twitch-guide-2026">
                <Button variant="ghost" size="lg" className="h-12 px-6 text-base text-muted-foreground hover:text-foreground gap-2">
                  <Play className="h-4 w-4" />
                  Voir comment &ccedil;a marche
                </Button>
              </Link>
            </div>

            <p className="text-xs text-amber-400/70 mt-3 font-medium">
              Offre de lancement : 127 comptes gratuits restants cette semaine
            </p>

            <p className="text-xs text-muted-foreground/60 mt-3">
              Sans carte bancaire &middot; Aucune installation &middot; Annulable en 1 clic
            </p>
          </div>

          {/* Stream → Clips Demo */}
          <StreamToClipsDemo />

          {/* URL Input */}
          <UrlInputBar />

          {/* Pain point */}
          <p className="text-sm text-muted-foreground/70 mt-10 italic max-w-lg mx-auto text-center">
            Tu passes des heures &agrave; streamer. Tes meilleurs moments restent enterr&eacute;s sur Twitch &agrave; 12 viewers.
            C&apos;est termin&eacute;.
          </p>

          {/* Stats */}
          <StatsCounter />

          {/* Live activity */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-muted-foreground/60">47 clips cr&eacute;&eacute;s dans les derni&egrave;res 24h</span>
          </div>

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
