/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics'

interface RadarClip {
  title: string | null
  author_handle: string | null
  velocity_score: number | null
  feed_category: string | null
  thumbnail_url: string | null
  clip_created_at: string | null
}

// Static fallback data (used when API fails)
const FALLBACK_CLIPS: RadarClip[] = [
  { title: 'Professor L got the Best Professor Award', author_handle: 'KaiCenat', velocity_score: 92, feed_category: 'hot_now', thumbnail_url: '/landing/radar-thumb-1.jpg', clip_created_at: null },
  { title: 'poor lacy', author_handle: 'Lacy', velocity_score: 74, feed_category: 'early_gem', thumbnail_url: '/landing/radar-thumb-2.jpg', clip_created_at: null },
  { title: 'Professor Agent teaches clip farming', author_handle: 'Agent00', velocity_score: 67, feed_category: 'hot_now', thumbnail_url: '/landing/radar-thumb-3.jpg', clip_created_at: null },
  { title: 'yourragegaming clip', author_handle: 'yourragegaming', velocity_score: 61, feed_category: 'hot_now', thumbnail_url: '/landing/radar-thumb-4.jpg', clip_created_at: null },
]
const FALLBACK_TOTAL = 8800

const LOCAL_THUMBS = [
  '/landing/radar-thumb-1.jpg',
  '/landing/radar-thumb-2.jpg',
  '/landing/radar-thumb-3.jpg',
  '/landing/radar-thumb-4.jpg',
]

const CyanGem = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <polygon points="9,1 17,9 9,17 1,9" fill="#67E8F9" stroke="#0E7490" strokeWidth="1"/>
    <polygon points="9,1 17,9 9,9" fill="#CFFAFE" opacity=".6"/>
  </svg>
)

function CountUpScore({ target }: { target: number }) {
  const [value, setValue] = useState(0)
  const [popped, setPopped] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const triggered = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) { setValue(target); return }
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !triggered.current) {
        triggered.current = true
        const t0 = performance.now()
        const D = 1500
        const ease = (t: number) => 1 - Math.pow(1 - t, 3)
        const step = (ts: number) => {
          const p = Math.min((ts - t0) / D, 1)
          setValue(Math.round(ease(p) * target))
          if (p < 1) requestAnimationFrame(step)
          else setPopped(true)
        }
        requestAnimationFrame(step)
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target])

  return <span ref={ref} className={`rd-rscore${popped ? ' rd-pop' : ''}`}>{value}</span>
}

function ThumbImg({ src, fallback, alt }: { src: string | null; fallback: string; alt: string }) {
  const [useFallback, setUseFallback] = useState(false)
  const url = useFallback || !src ? fallback : src
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      width={315}
      height={180}
      onError={() => setUseFallback(true)}
    />
  )
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

export function HowItWorksSection() {
  const [clips, setClips] = useState<RadarClip[]>(FALLBACK_CLIPS)
  const [totalAnalyzed, setTotalAnalyzed] = useState(FALLBACK_TOTAL)

  useEffect(() => {
    fetch('/api/landing/radar')
      .then(r => r.ok ? r.json() : null)
      .then((json: { data?: { clips?: RadarClip[]; totalAnalyzed?: number } } | null) => {
        if (json?.data?.clips && json.data.clips.length >= 4) {
          setClips(json.data.clips)
        }
        if (json?.data?.totalAnalyzed) {
          setTotalAnalyzed(json.data.totalAnalyzed)
        }
      })
      .catch(() => { /* keep fallback */ })
  }, [])

  const royal = clips[0]
  const rising1 = clips[1]
  const rising2 = clips[2]
  const partial = clips[3]

  const totalLabel = `${formatCount(totalAnalyzed)}+`

  return (
    <section id="radar" className="lv3-divider" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="rd">
        {/* Radar background */}
        <div className="rd-bg">
          <div className="rd-rings" />
          <div className="rd-sweep" />
          <div className="rd-blip b1" /><div className="rd-blip b2" /><div className="rd-blip b3" />
          <div className="rd-blip b4" /><div className="rd-blip b5" />
          <div className="rd-chx" /><div className="rd-chy" />
        </div>

        {/* Header */}
        <div className="rd-head">
          <div className="rd-eyebrow"><span className="rd-live" />Step 1 — The Radar &middot; Live</div>
          <h2 className="rd-h2">The radar never sleeps.</h2>
          <p className="rd-sub">
            It scans Twitch &amp; Kick around the clock, scores momentum, detects early signals — and crowns the strongest opportunity.
          </p>
        </div>

        {/* Deck */}
        <div className="rd-deck">
          {/* ── ROYAL CARD ── */}
          <div className="rd-royalwrap">
            {/* Crown SVG */}
            <svg className="rd-crown" width="62" height="39" viewBox="0 0 74 46" fill="none">
              <defs>
                <linearGradient id="rd-cw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FFFBEB"/><stop offset=".25" stopColor="#FDE68A"/>
                  <stop offset=".5" stopColor="#E8B84B"/><stop offset=".75" stopColor="#C9962E"/>
                  <stop offset="1" stopColor="#92400E"/>
                </linearGradient>
              </defs>
              <path d="M4 36 L2 12 L15 22 L26 6 L37 16 L48 6 L59 22 L72 12 L70 36 Z" fill="url(#rd-cw)" stroke="#78350F" strokeWidth="1.2"/>
              <path d="M2 12 L15 22 L12 36 L4 36 Z" fill="#FFFBEB" opacity=".38"/>
              <path d="M26 6 L37 16 L30 36 L18 36 Z" fill="#FFFBEB" opacity=".22"/>
              <path d="M26 6 L15 22 L18 36 Z" fill="#78350F" opacity=".22"/>
              <path d="M48 6 L59 22 L56 36 L44 36 Z" fill="#78350F" opacity=".2"/>
              <path d="M72 12 L59 22 L62 36 L70 36 Z" fill="#78350F" opacity=".3"/>
              <path d="M48 6 L37 16 L44 36 Z" fill="#A5F3FC" opacity=".14"/>
              <path d="M15 22 L26 6 L26 14 Z" fill="#A5F3FC" opacity=".2"/>
              <rect x="4" y="36" width="66" height="5.5" rx="1.5" fill="url(#rd-cw)" stroke="#78350F" strokeWidth="1"/>
              <path d="M14 36 L14 41.5" stroke="#78350F" strokeWidth=".8" opacity=".5"/>
              <path d="M60 36 L60 41.5" stroke="#78350F" strokeWidth=".8" opacity=".5"/>
              <path d="M37 23 L42.5 28 L37 33 L31.5 28 Z" fill="#67E8F9" stroke="#0E7490" strokeWidth="1"/>
              <path d="M37 23 L42.5 28 L37 28 Z" fill="#CFFAFE" opacity=".65"/>
            </svg>

            {/* Lock brackets */}
            <div className="rd-lock">
              <i className="tl" /><i className="tr" /><i className="bl" /><i className="brc" />
            </div>

            {/* Frame */}
            <div className="rd-leg-frame">
              <span className="rd-gem g1"><CyanGem /></span>
              <span className="rd-gem g2"><CyanGem /></span>
              <span className="rd-gem g3"><CyanGem /></span>
              <span className="rd-gem g4"><CyanGem /></span>
              <div className="rd-leg-inner-dark"><div className="rd-leg-inner-gold"><div className="rd-leg-body">
                <div className="rd-rthumb">
                  <span className="rd-toppick-tag">{'\uD83D\uDC51'} TOP PICK</span>
                  <span className="rd-detect">{'\u26A1'} DETECTED BEFORE PEAK</span>
                  <ThumbImg src={royal?.thumbnail_url ?? null} fallback={LOCAL_THUMBS[0]} alt={`${royal?.author_handle ?? 'Top'} clip`} />
                </div>
                <div className="rd-rmeta">
                  <div className="rd-rinfo">
                    <div className="rd-auth">{royal?.author_handle ?? 'KaiCenat'}</div>
                    <div className="rd-ttl">{royal?.title ?? 'Top clip'}</div>
                  </div>
                  <CountUpScore target={royal?.velocity_score ?? 92} />
                </div>
                <Link
                  href="/signup"
                  className="rd-leg-cta"
                  onClick={() => track('landing_cta_clicked', { placement: 'radar' })}
                >
                  STEAL THIS CLIP &rarr;
                </Link>
              </div></div></div>
            </div>
          </div>

          {/* ── RISING CARDS ── */}
          <div className="rd-risecol">
            <div className="rd-rise">
              <div className="rd-rthumb2">
                <span className="rd-badge">{'\u25B2'} RISING FAST</span>
                <ThumbImg src={rising1?.thumbnail_url ?? null} fallback={LOCAL_THUMBS[1]} alt={`${rising1?.author_handle ?? 'Rising'} clip`} />
              </div>
              <div className="rd-rmeta2">
                <div>
                  <div className="rd-auth">{rising1?.author_handle ?? 'Lacy'}</div>
                  <div className="rd-ttl">{rising1?.title ?? 'Rising clip'}</div>
                </div>
                <span className="rd-cscore">{rising1?.velocity_score ?? 74}</span>
              </div>
            </div>
            <div className="rd-rise">
              <div className="rd-rthumb2">
                <span className="rd-badge">{'\u26A1'} EARLY SIGNAL</span>
                <ThumbImg src={rising2?.thumbnail_url ?? null} fallback={LOCAL_THUMBS[2]} alt={`${rising2?.author_handle ?? 'Early'} clip`} />
              </div>
              <div className="rd-rmeta2">
                <div>
                  <div className="rd-auth">{rising2?.author_handle ?? 'Agent00'}</div>
                  <div className="rd-ttl">{rising2?.title ?? 'Early signal clip'}</div>
                </div>
                <span className="rd-cscore rd-rainbow">{rising2?.velocity_score ?? 67}</span>
              </div>
            </div>
          </div>

          {/* ── PARTIAL CARD ── */}
          <div className="rd-partial">
            <ThumbImg src={partial?.thumbnail_url ?? null} fallback={LOCAL_THUMBS[3]} alt={`${partial?.author_handle ?? 'Clip'}`} />
            <div className="rd-pm">{partial?.author_handle ?? 'yourragegaming'}</div>
            <div className="rd-ps">{partial?.velocity_score ?? 61}</div>
          </div>
        </div>

        {/* Stat machine */}
        <div className="rd-machine">
          <span><b>{totalLabel}</b> clips analyzed</span>
          <span className="rd-sep">&middot;</span>
          <span>re-scored every <b>15 minutes</b></span>
          <span className="rd-sep">&middot;</span>
          <span className="rd-early">early signals detected <b>daily</b></span>
        </div>
      </div>
    </section>
  )
}
