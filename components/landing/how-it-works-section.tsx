"use client"

import { useEffect, useRef, useState } from 'react'
import { AnimatedSection } from '@/components/landing/animated-section'
import { track } from '@/lib/analytics'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

/** Radar clip from API or fallback */
interface RadarClip {
  title: string | null
  author_handle: string | null
  velocity_score: number | null
  feed_category: string | null
  thumbnail_url: string | null
  clip_created_at: string | null
}

interface RadarData {
  clips: RadarClip[]
  totalAnalyzed: number
}

const FALLBACK: RadarData = {
  clips: [
    { title: 'MOST INSANE CLUTCH OF THE YEAR', author_handle: 'shroud', velocity_score: 91, feed_category: 'hot_now', thumbnail_url: null, clip_created_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
    { title: 'WHAT DID I JUST WITNESS', author_handle: 'xqc', velocity_score: 84, feed_category: 'early_gem', thumbnail_url: null, clip_created_at: new Date(Date.now() - 4 * 3600_000).toISOString() },
    { title: 'THIS PLAY BROKE CHAT', author_handle: 'kamet0', velocity_score: 79, feed_category: 'hot_now', thumbnail_url: null, clip_created_at: new Date(Date.now() - 5 * 3600_000).toISOString() },
    { title: 'UNSTOPPABLE STREAK', author_handle: 'sardoche', velocity_score: 76, feed_category: 'hot_now', thumbnail_url: null, clip_created_at: new Date(Date.now() - 7 * 3600_000).toISOString() },
  ],
  totalAnalyzed: 8800,
}

function timeAgoShort(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function getBadge(clip: RadarClip): string {
  const score = clip.velocity_score ?? 0
  if (clip.feed_category === 'early_gem') return 'Early signal'
  if (score >= 85) return 'High momentum'
  if (score >= 70) return 'Rising fast'
  return 'Detected before peak'
}

/** Animated count-up on scroll into view */
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const triggered = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !triggered.current) {
        triggered.current = true
        const start = performance.now()
        const animate = (now: number) => {
          const p = Math.min((now - start) / 800, 1)
          const eased = 1 - Math.pow(1 - p, 3)
          setDisplay(Math.round(eased * value))
          if (p < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [value])

  return <span ref={ref}>{display}</span>
}

export function HowItWorksSection() {
  const [data, setData] = useState<RadarData>(FALLBACK)

  useEffect(() => {
    fetch('/api/landing/radar')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.data?.clips?.length > 0) setData(j.data) })
      .catch(() => { /* keep fallback */ })
  }, [])

  const [topClip, ...restClips] = data.clips
  const risingClips = restClips.slice(0, 2)
  const peekClip = restClips[2] ?? null

  return (
    <section id="radar" className="py-16 sm:py-24 px-5 border-t border-border/20">
      <AnimatedSection>
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">The radar never sleeps.</h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-2xl mx-auto">
            It scans Twitch &amp; Kick around the clock, scores momentum, detects early signals — and crowns the strongest opportunity.
          </p>
        </div>
      </AnimatedSection>

      {/* Card strip — scrollable on mobile */}
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-5 px-5 sm:mx-0 sm:px-0 sm:overflow-visible sm:grid sm:grid-cols-4">
          {/* Royal card — #1 clip */}
          {topClip && (
            <AnimatedSection className="min-w-[260px] sm:min-w-0 snap-start sm:col-span-2">
              <div className="rounded-2xl border-2 border-amber-500/40 bg-zinc-900/90 p-4 relative overflow-hidden">
                {/* Gold glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
                <div className="relative">
                  {/* Badge */}
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-[0.14em]" style={{ color: '#FDE68A', background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.28)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {getBadge(topClip)}
                  </span>
                  {/* Thumbnail placeholder */}
                  {topClip.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={topClip.thumbnail_url} alt="" className="w-full h-28 rounded-lg object-cover mt-3 border border-zinc-700/50" />
                  ) : (
                    <div className="w-full h-28 rounded-lg bg-zinc-800 border border-zinc-700/50 mt-3" />
                  )}
                  <p className="text-sm font-extrabold text-white mt-3 truncate">{topClip.title || 'Untitled'}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">@{topClip.author_handle ?? 'unknown'} &middot; {timeAgoShort(topClip.clip_created_at)}</p>
                  {/* Score */}
                  <div className="mt-3 flex items-end justify-between">
                    <span className="tp-score text-[38px]"><CountUp value={Math.round(topClip.velocity_score ?? 0)} /></span>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase">Score tooltip: combines velocity, recency, engagement and creator momentum</span>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Rising cards */}
          {risingClips.map((clip, i) => (
            <AnimatedSection key={i} delay={0.1 * (i + 1)} className="min-w-[200px] sm:min-w-0 snap-start">
              <div className="rounded-xl border border-cyan-500/20 bg-zinc-900/80 p-3 h-full">
                <span className="text-[9px] font-bold text-cyan-400/70 uppercase tracking-wider">{getBadge(clip)}</span>
                {clip.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={clip.thumbnail_url} alt="" className="w-full h-20 rounded-md object-cover mt-2 border border-zinc-700/50" />
                ) : (
                  <div className="w-full h-20 rounded-md bg-zinc-800 border border-zinc-700/50 mt-2" />
                )}
                <p className="text-xs font-bold text-zinc-300 mt-2 truncate">{clip.title || 'Untitled'}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">@{clip.author_handle ?? 'unknown'} &middot; {timeAgoShort(clip.clip_created_at)}</p>
                <p className="text-lg font-black text-cyan-400/80 mt-2">{Math.round(clip.velocity_score ?? 0)}</p>
              </div>
            </AnimatedSection>
          ))}

          {/* Peek card */}
          {peekClip && (
            <AnimatedSection delay={0.3} className="min-w-[160px] sm:min-w-0 snap-start">
              <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-3 h-full opacity-60">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{getBadge(peekClip)}</span>
                <div className="w-full h-20 rounded-md bg-zinc-800/50 border border-zinc-700/30 mt-2" />
                <p className="text-xs font-bold text-zinc-500 mt-2 truncate">{peekClip.title || 'Untitled'}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">@{peekClip.author_handle ?? 'unknown'}</p>
              </div>
            </AnimatedSection>
          )}
        </div>

        {/* Stat machine */}
        <AnimatedSection delay={0.2}>
          <p className="text-center text-[11px] text-zinc-500 mt-6">
            {data.totalAnalyzed.toLocaleString()}+ clips analyzed &middot; re-scored every 15 minutes
          </p>
        </AnimatedSection>

        {/* CTA */}
        <AnimatedSection delay={0.3}>
          <div className="text-center mt-8">
            <Link href="/signup">
              <Button
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-amber-950 font-bold"
                onClick={() => track('landing_cta_clicked', { placement: 'radar' })}
              >
                Start farming free
              </Button>
            </Link>
          </div>
        </AnimatedSection>
      </div>
    </section>
  )
}
