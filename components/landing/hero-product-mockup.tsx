"use client"

import { useEffect, useState, useRef } from 'react'

// ── Permanent raw-to-ready display with looping karaoke captions ──
// The phone always shows the final "ready" state.
// Karaoke words illuminate one-by-one in a loop (CSS animation).
// The RAW vignette + connector are always visible — no phase-gating.
// On reduced-motion: everything static, captions white, no float.

const HERO_IMG = '/landing/radar-thumb-4.jpg'
const KARAOKE_WORDS = ['THIS', 'IS', 'ACTUALLY', 'INSANE']

export function HeroProductMockup() {
  const [reducedMotion, setReducedMotion] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const h = (e: MediaQueryListEvent) => { if (mounted.current) setReducedMotion(e.matches) }
    mq.addEventListener('change', h)
    return () => { mounted.current = false; mq.removeEventListener('change', h) }
  }, [])

  return (
    <div className="hpm-wrap">
      {/* Ambient glow behind phone */}
      <div className="hpm-glow hpm-glow-cyan" />
      <div className="hpm-glow hpm-glow-amber" />

      {/* ── RAW vignette ── */}
      <div className={`hpm-raw ${reducedMotion ? '' : 'hpm-raw-float'}`}>
        <span className="hpm-raw-label">RAW CLIP</span>
        <div className="hpm-raw-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HERO_IMG} alt="" draggable={false} />
          <span className="hpm-raw-ratio">16:9</span>
        </div>
      </div>

      {/* ── Connector arrow ── */}
      <svg className={`hpm-connector ${reducedMotion ? '' : 'hpm-connector-anim'}`} viewBox="0 0 60 80" fill="none" aria-hidden="true">
        <path d="M10 5 C10 40, 50 40, 50 70" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" opacity="0.75" />
        <polygon points="45,65 55,65 50,75" fill="#F59E0B" opacity="0.75" />
      </svg>

      {/* ── Phone frame ── */}
      <div className="hpm-phone">
        <div className="hpm-screen">
          {/* Cropped vertical image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HERO_IMG} alt="Enhanced clip preview" className="hpm-img" draggable={false} />

          {/* Hook capsule */}
          <div className="hpm-hook">WAIT FOR IT...</div>

          {/* Score badge */}
          <div className="hpm-score">96</div>

          {/* Karaoke captions */}
          <div className="hpm-captions">
            {KARAOKE_WORDS.map((w, i) => (
              <span
                key={w}
                className={`hpm-word ${reducedMotion ? '' : 'hpm-word-loop'}`}
                style={reducedMotion ? undefined : { animationDelay: `${i * 0.6}s` }}
              >
                {w}
              </span>
            ))}
          </div>

          {/* Credit line */}
          <span className="hpm-credit">@streamer · credit added</span>
        </div>

        {/* TIKTOK READY below screen */}
        <div className="hpm-ready">⚡ TIKTOK READY</div>
      </div>
    </div>
  )
}
