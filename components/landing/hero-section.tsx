"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics'

interface BridgeData {
  title: string
  score: number
}

const KARAOKE_WORDS = ['HE', 'ACTUALLY', 'HIT', 'THAT?!'] as const

/** Count-up on scroll into view */
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const triggered = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !triggered.current) {
        triggered.current = true
        const start = performance.now()
        const animate = (now: number) => {
          const p = Math.min((now - start) / 1800, 1)
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

export function HeroSection() {
  const [bridge, setBridge] = useState<BridgeData>({ title: 'The radar found one while you were reading.', score: 98 })

  useEffect(() => {
    fetch('/api/landing/radar')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const clip = j?.data?.clips?.[0]
        if (clip) {
          setBridge({
            title: clip.title ?? 'The radar found one while you were reading.',
            score: Math.round(clip.velocity_score ?? 98),
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <section className="lv3-hero lv3-divider">
      {/* Backgrounds */}
      <div className="lv3-hero-bg-grid" />
      <div className="lv3-hero-bg-glow" />
      <div className="lv3-particle p1" />
      <div className="lv3-particle p2" />
      <div className="lv3-particle p3" />

      {/* Eyebrow */}
      <div className="lv3-eyebrow" style={{ position: 'relative', zIndex: 1 }}>
        <span className="lv3-eyebrow-dot" />
        Radar live &middot; scanning Twitch
      </div>

      {/* H1 */}
      <h1 className="lv3-h1" style={{ position: 'relative', zIndex: 1 }}>
        Clips blowing up,{' '}
        <span className="lv3-h1-accent">found before the crowd.</span>
      </h1>

      {/* Sub */}
      <p className="lv3-sub" style={{ position: 'relative', zIndex: 1 }}>
        Turn them into TikTok-ready posts in one click — captions, vertical crop, hook and automatic credit included.
      </p>

      {/* Punch */}
      <p className="lv3-punch" style={{ position: 'relative', zIndex: 1 }}>
        No recording. No downloading. No manual posting.
      </p>

      {/* CTAs */}
      <div className="lv3-ctas" style={{ position: 'relative', zIndex: 1 }}>
        <Link
          href="/signup"
          className="lv3-cta-primary"
          onClick={() => track('landing_cta_clicked', { placement: 'hero' })}
        >
          Start Farming Free
        </Link>
        <button
          className="lv3-cta-ghost"
          onClick={() => {
            document.getElementById('radar')?.scrollIntoView({ behavior: 'smooth' })
            track('landing_cta_clicked', { placement: 'hero_watch' })
          }}
        >
          Watch It Work
        </button>
      </div>

      {/* Trust */}
      <p className="lv3-trust" style={{ position: 'relative', zIndex: 1 }}>
        Free plan &middot; No credit card &middot; TikTok Direct Post approved
      </p>

      {/* ── Transformation visual ── */}
      <div className="lv3-xform" style={{ position: 'relative', zIndex: 1 }}>
        {/* 1. Raw clip */}
        <div className="lv3-raw">
          <div className="lv3-raw-screen">
            <span className="lv3-raw-badge tl">Raw Twitch Clip</span>
            <div className="lv3-raw-play">
              <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
                <path d="M2 1.5L14 9L2 16.5V1.5Z" fill="rgba(148,163,184,.6)" />
              </svg>
            </div>
            <span className="lv3-raw-badge br">16:9 &middot; 1:12</span>
          </div>
        </div>

        {/* 2. Energy node */}
        <div className="lv3-node">
          <div className="lv3-node-ring" />
          <div className="lv3-node-ring r2" />
          <div className="lv3-node-core">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4 14H11L10 22L20 9H13L13 2Z" fill="#1C1206" />
            </svg>
          </div>
        </div>

        {/* 3. Phone 9:16 */}
        <div className="lv3-phone">
          <div className="lv3-phone-screen">
            <span className="lv3-phone-label">Vertical &middot; 9:16</span>

            {/* TikTok ghost icons */}
            <div className="lv3-phone-tiktok-icons">
              <div className="lv3-phone-tiktok-icon" />
              <div className="lv3-phone-tiktok-icon" />
              <div className="lv3-phone-tiktok-icon" />
            </div>

            {/* Karaoke captions */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginBottom: 16, position: 'relative', zIndex: 2 }}>
              {KARAOKE_WORDS.map((word, i) => (
                <span key={word} className={`lv3-kword w${i + 1}`}>{word}</span>
              ))}
            </div>

            {/* Credit chip */}
            <span className="lv3-credit-chip">clip &middot; @streamer — auto-credited</span>
          </div>
        </div>
      </div>

      {/* ── Bridge card (peeks into next section) ── */}
      <div className="lv3-bridge">
        <span className="lv3-bridge-crown" role="img" aria-label="crown">&#x1F451;</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="lv3-bridge-label">Top Pick &middot; Just Detected</p>
          <p className="lv3-bridge-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {bridge.title}
          </p>
        </div>
        <span className="lv3-bridge-score"><CountUp value={bridge.score} /></span>
      </div>
    </section>
  )
}
