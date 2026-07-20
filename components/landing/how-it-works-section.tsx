/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useRef, useState } from 'react'

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
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function CountUp({ value, duration = 1800 }: { value: number; duration?: number }) {
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
          const p = Math.min((now - start) / duration, 1)
          const eased = 1 - Math.pow(1 - p, 3)
          setDisplay(Math.round(eased * value))
          if (p < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
      }
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [value, duration])
  return <span ref={ref}>{display.toLocaleString()}</span>
}

/** Next quarter-hour countdown */
function useNextRescore() {
  const [text, setText] = useState('15:00')
  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      const next = Math.ceil(now / (15 * 60_000)) * (15 * 60_000)
      const diff = Math.max(0, Math.floor((next - now) / 1000))
      setText(`${Math.floor(diff / 60)}:${(diff % 60).toString().padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return text
}

const THUMB_FB = ['lv3-thumb-fb-gold', 'lv3-thumb-fb-cyan1', 'lv3-thumb-fb-cyan2'] as const

export function HowItWorksSection() {
  const [data, setData] = useState<RadarData>(FALLBACK)
  const nextRescore = useNextRescore()

  useEffect(() => {
    fetch('/api/landing/radar')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.data?.clips?.length > 0) setData(j.data) })
      .catch(() => {})
  }, [])

  const clips = data.clips
  const topClip = clips[0] ?? null
  const rising1 = clips[1] ?? null
  const rising2 = clips[2] ?? null
  const ghost = clips[3] ?? null

  return (
    <section id="radar" className="lv3-radar lv3-divider">
      {/* Decorative radar circles */}
      <div className="lv3-radar-deco">
        <div className="lv3-radar-sweep" />
      </div>

      <div className="lv3-container" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header — left-aligned */}
        <div>
          <p className="lv3-radar-eyebrow">Step 1 — Detection</p>
          <h2 className="lv3-radar-h2">The radar never sleeps.</h2>
          <p className="lv3-radar-sub">
            Momentum scoring catches clips while they&apos;re still climbing — hours before they hit the For You page.
          </p>
          <p className="lv3-radar-stat">
            <CountUp value={data.totalAnalyzed} />+ clips analyzed &middot; re-scored every 15 minutes
          </p>
        </div>

        {/* Scanner panel */}
        <div className="lv3-scanner">
          {/* Scan line */}
          <div className="lv3-scan-line" />

          {/* Card rail */}
          <div className="lv3-card-rail">

            {/* ── GOLD TOP PICK ── */}
            {topClip && (
              <div className="lv3-card-gold">
                <div className="lv3-gem g-tl" />
                <div className="lv3-gem g-tr" />
                <div className="lv3-gem g-bl" />
                <div className="lv3-gem g-br" />
                {/* Thumb */}
                {topClip.thumbnail_url ? (
                  <img src={topClip.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div className={THUMB_FB[0]} style={{ width: '100%', aspectRatio: '16/9' }} />
                )}
                {/* Badge */}
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#FBBF24', background: 'rgba(2,6,23,.8)', padding: '4px 8px', borderRadius: 6 }}>
                    &#x1F451; TOP PICK
                  </span>
                </div>
                {/* Meta */}
                <div className="lv3-card-gold-meta">
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topClip.title || 'Untitled'}
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginTop: 2 }}>
                    Score{' '}
                    <span style={{ fontSize: 26, fontWeight: 900, color: '#FBBF24', textShadow: '0 0 20px rgba(251,191,36,.6)', fontVariantNumeric: 'tabular-nums' }}>
                      <CountUp value={Math.round(topClip.velocity_score ?? 0)} />
                    </span>
                    {' '}&middot; detected {timeAgoShort(topClip.clip_created_at)}
                  </p>
                </div>
              </div>
            )}

            {/* ── RISING FAST 1 ── */}
            {rising1 && (
              <RisingCard clip={rising1} fbClass={THUMB_FB[1]} />
            )}

            {/* ── RISING FAST 2 ── */}
            {rising2 && (
              <RisingCard clip={rising2} fbClass={THUMB_FB[2]} />
            )}

            {/* ── GHOST / SCANNING ── */}
            <div className="lv3-card-ghost">
              <span style={{ fontSize: 13, fontWeight: 700, color: '#CBD5E1' }}>scanning&hellip;</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                re-score in {nextRescore}
              </span>
              {ghost && (
                <span style={{ fontSize: 10, color: '#475569', marginTop: 4, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                  @{ghost.author_handle ?? '...'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function RisingCard({ clip, fbClass }: { clip: RadarClip; fbClass: string }) {
  return (
    <div className="lv3-card-rising">
      {clip.thumbnail_url ? (
        <img src={clip.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block', borderRadius: '14px 14px 0 0' }} />
      ) : (
        <div className={fbClass} style={{ width: '100%', aspectRatio: '16/9', borderRadius: '14px 14px 0 0' }} />
      )}
      <div style={{ position: 'absolute', top: 8, left: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#67E8F9', background: 'rgba(2,6,23,.75)', padding: '3px 7px', borderRadius: 4 }}>
          Rising Fast
        </span>
      </div>
      <div className="lv3-card-rising-meta">
        <p style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {clip.title || 'Untitled'}
        </p>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginTop: 2 }}>
          Score{' '}
          <span style={{ fontSize: 22, fontWeight: 900, color: '#67E8F9', fontVariantNumeric: 'tabular-nums' }}>
            <CountUp value={Math.round(clip.velocity_score ?? 0)} />
          </span>
          {' '}&middot; detected {timeAgoShort(clip.clip_created_at)}
        </p>
      </div>
    </div>
  )
}
