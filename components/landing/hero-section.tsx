/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics'

interface BridgeData { title: string; score: number; thumbUrl: string | null }

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
          setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * value))
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
  const [bridge, setBridge] = useState<BridgeData>({
    title: 'The radar found one while you were reading.',
    score: 98,
    thumbUrl: null,
  })

  useEffect(() => {
    fetch('/api/landing/radar')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const clip = j?.data?.clips?.[0]
        if (clip) {
          setBridge({
            title: clip.title ?? 'The radar found one while you were reading.',
            score: Math.round(clip.velocity_score ?? 98),
            thumbUrl: clip.thumbnail_url ?? null,
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <section className="lv3-hero lv3-divider">
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

      {/* H1 — VALIDATED, don't touch */}
      <h1 className="lv3-h1" style={{ position: 'relative', zIndex: 1 }}>
        Clips blowing up,{' '}
        <span className="lv3-h1-accent">found before the crowd.</span>
      </h1>

      {/* Sub — updated copy */}
      <p className="lv3-sub" style={{ position: 'relative', zIndex: 1 }}>
        Three clicks from trending to TikTok — captions, vertical crop, hook and automatic credit included.
      </p>

      {/* Punch */}
      <p className="lv3-punch" style={{ position: 'relative', zIndex: 1 }}>
        No recording. No downloading. No manual posting.
      </p>

      {/* CTAs — VALIDATED */}
      <div className="lv3-ctas" style={{ position: 'relative', zIndex: 1 }}>
        <Link href="/signup" className="lv3-cta-primary" onClick={() => track('landing_cta_clicked', { placement: 'hero' })}>
          Start Farming Free
        </Link>
        <button className="lv3-cta-ghost" onClick={() => { document.getElementById('radar')?.scrollIntoView({ behavior: 'smooth' }); track('landing_cta_clicked', { placement: 'hero_watch' }) }}>
          Watch It Work
        </button>
      </div>

      {/* Trust — VALIDATED */}
      <p className="lv3-trust" style={{ position: 'relative', zIndex: 1 }}>
        Free plan &middot; No credit card &middot; TikTok Direct Post approved
      </p>

      {/* ── 3-CLICKS PIPELINE DEMO ── */}
      <div className="h3c" style={{ position: 'relative', zIndex: 1 }}>
        {/* Step labels */}
        <div className="h3c-labels">
          <span className="h3c-label h3c-label-1">1 Pick</span>
          <span className="h3c-label h3c-label-2">2 Enhance</span>
          <span className="h3c-label h3c-label-3">3 Post</span>
        </div>

        {/* Desktop: 3 zones side by side */}
        <div className="h3c-stage">
          {/* Cursor */}
          <div className="h3c-cursor">
            <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
              <path d="M1 1L1 18L5.5 14L9.5 22L12.5 20.5L8.5 12.5L14 11L1 1Z" fill="#F8FAFC" stroke="#020617" strokeWidth="1.5"/>
            </svg>
          </div>

          {/* ZONE 1 — PICK (mini legendary card) */}
          <div className="h3c-zone h3c-z1">
            <div className="h3c-z1-card">
              {/* Mini legendary frame */}
              <div className="h3c-z1-frame">
                <div className="h3c-z1-frame-inner">
                  {/* Gems */}
                  <div className="h3c-gem h3c-gem-tl" /><div className="h3c-gem h3c-gem-tr" />
                  <div className="h3c-gem h3c-gem-bl" /><div className="h3c-gem h3c-gem-br" />
                  {/* Thumbnail */}
                  <div className="h3c-z1-thumb">
                    {bridge.thumbUrl ? (
                      <img src={bridge.thumbUrl} alt="" className="h3c-z1-img" />
                    ) : (
                      <div className="h3c-z1-img-fb" />
                    )}
                    <div className="h3c-z1-overlay" />
                  </div>
                </div>
              </div>
              <div className="h3c-z1-meta">
                <span className="h3c-z1-badge">&#x1F451; Top Pick</span>
                <span className="h3c-z1-score">{bridge.score}</span>
              </div>
            </div>
            {/* Click wave */}
            <div className="h3c-wave h3c-wave-1" />
          </div>

          {/* Link 1→2 */}
          <div className="h3c-link h3c-link-1" />

          {/* ZONE 2 — ENHANCE */}
          <div className="h3c-zone h3c-z2">
            {/* AI Optimize button */}
            <div className="h3c-z2-btn">&#x2728; AI Optimize</div>
            {/* Reveal content */}
            <div className="h3c-z2-reveal">
              <div className="h3c-z2-phone">
                <div className="h3c-z2-phone-screen">
                  <div className="h3c-z2-overlay" />
                  {/* Hook chip */}
                  <span className="h3c-z2-hook">WAIT FOR IT&hellip;</span>
                  {/* Karaoke */}
                  <div className="h3c-z2-kwords">
                    <span className="h3c-kw h3c-kw-1">THIS</span>
                    <span className="h3c-kw h3c-kw-2">IS</span>
                    <span className="h3c-kw h3c-kw-3">CRAZY</span>
                  </div>
                  <span className="h3c-z2-credit">@streamer — auto-credited</span>
                </div>
              </div>
              {/* Checklist */}
              <div className="h3c-z2-checks">
                <span className="h3c-chk h3c-chk-1">&#x2713; Vertical crop</span>
                <span className="h3c-chk h3c-chk-2">&#x2713; Hook added</span>
                <span className="h3c-chk h3c-chk-3">&#x2713; Captions synced</span>
              </div>
              {/* Blowup bar */}
              <div className="h3c-z2-bar">
                <span className="h3c-z2-bar-label">Blowup Chance</span>
                <span className="h3c-z2-bar-old">87</span>
                <span className="h3c-z2-bar-new">96</span>
              </div>
              <span className="h3c-z2-verdict">Viral Ready</span>
            </div>
            <div className="h3c-wave h3c-wave-2" />
          </div>

          {/* Link 2→3 */}
          <div className="h3c-link h3c-link-2" />

          {/* ZONE 3 — POST */}
          <div className="h3c-zone h3c-z3">
            <div className="h3c-z3-btn">&#x1F680; Post to TikTok</div>
            <div className="h3c-z3-reveal">
              <div className="h3c-z3-stamp">POSTED</div>
              {/* Hearts */}
              <div className="h3c-hearts">
                <span className="h3c-heart h3c-heart-1">&#x2665;</span>
                <span className="h3c-heart h3c-heart-2">&#x2665;</span>
                <span className="h3c-heart h3c-heart-3">&#x2665;</span>
              </div>
              <span className="h3c-z3-tracking">&#x2713; Tracking started</span>
              {/* Platform column */}
              <div className="h3c-z3-platforms">
                <span className="h3c-z3-plat h3c-z3-plat-tt">TikTok</span>
                <span className="h3c-z3-plat h3c-z3-plat-soon">YouTube <span className="h3c-soon">Soon</span></span>
                <span className="h3c-z3-plat h3c-z3-plat-soon">Instagram <span className="h3c-soon">Soon</span></span>
              </div>
            </div>
            <div className="h3c-wave h3c-wave-3" />
          </div>
        </div>
      </div>

      {/* Micro-features line */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 10px', marginTop: 20, fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>
        <span>Karaoke captions (5 styles)</span>
        <span style={{ color: '#334155' }}>&middot;</span>
        <span>Split-screen gameplay</span>
        <span style={{ color: '#334155' }}>&middot;</span>
        <span>Automatic creator credit</span>
      </div>

      {/* Bridge card — VALIDATED */}
      <div className="lv3-bridge">
        <span className="lv3-bridge-crown" role="img" aria-label="crown">&#x1F451;</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="lv3-bridge-label">Top Pick &middot; Just Detected</p>
          <p className="lv3-bridge-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bridge.title}</p>
        </div>
        <span className="lv3-bridge-score"><CountUp value={bridge.score} /></span>
      </div>
    </section>
  )
}
