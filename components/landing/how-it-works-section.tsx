/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics'

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

export function HowItWorksSection() {
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
                  <img src="/landing/radar-thumb-1.jpg" alt="KaiCenat clip" />
                </div>
                <div className="rd-rmeta">
                  <div className="rd-rinfo">
                    <div className="rd-auth">KaiCenat</div>
                    <div className="rd-ttl">Professor L got the Best Professor Award</div>
                    <div className="rd-stats">41.5K views &middot; Twitch</div>
                  </div>
                  <CountUpScore target={92} />
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
                <img src="/landing/radar-thumb-2.jpg" alt="Lacy clip" />
              </div>
              <div className="rd-rmeta2">
                <div>
                  <div className="rd-auth">Lacy</div>
                  <div className="rd-ttl">poor lacy</div>
                </div>
                <span className="rd-cscore">74</span>
              </div>
            </div>
            <div className="rd-rise">
              <div className="rd-rthumb2">
                <span className="rd-badge">{'\u26A1'} EARLY SIGNAL</span>
                <img src="/landing/radar-thumb-3.jpg" alt="Agent00 clip" />
              </div>
              <div className="rd-rmeta2">
                <div>
                  <div className="rd-auth">Agent00</div>
                  <div className="rd-ttl">Professor Agent teaches clip farming</div>
                </div>
                <span className="rd-cscore rd-rainbow">67</span>
              </div>
            </div>
          </div>

          {/* ── PARTIAL CARD ── */}
          <div className="rd-partial">
            <img src="/landing/radar-thumb-4.jpg" alt="yourragegaming clip" />
            <div className="rd-pm">yourragegaming</div>
            <div className="rd-ps">61</div>
          </div>
        </div>

        {/* Stat machine */}
        <div className="rd-machine">
          <span><b>9,000+</b> clips analyzed</span>
          <span className="rd-sep">&middot;</span>
          <span>re-scored every <b>15 minutes</b></span>
          <span className="rd-sep">&middot;</span>
          <span className="rd-early">early signals detected <b>daily</b></span>
        </div>
      </div>
    </section>
  )
}
