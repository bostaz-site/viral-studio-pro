"use client"

import { useEffect, useState, useRef } from 'react'

// ── 7s CSS transformation loop ──
// Phase 0-1s:    horizontal 16:9 thumbnail letterboxed in phone
// Phase 1-2.5s:  animate to vertical full-frame crop
// Phase 2.5-4.5s: karaoke captions word-by-word + hook capsule slides in
// Phase 4.5-6s:  TIKTOK READY badge pops + score counts 87->96
// Phase 6-7s:    publish pulse, fade, restart

const CYCLE_MS = 7000

export function HeroProductMockup() {
  const [phase, setPhase] = useState(0)
  const [score, setScore] = useState(87)
  const [reducedMotion, setReducedMotion] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (reducedMotion) {
      setPhase(4)
      setScore(96)
      return
    }

    function runCycle() {
      if (!mountedRef.current) return

      // Phase 0: letterbox
      setPhase(0)
      setScore(87)

      timerRef.current = setTimeout(() => {
        if (!mountedRef.current) return
        // Phase 1: crop to vertical
        setPhase(1)

        timerRef.current = setTimeout(() => {
          if (!mountedRef.current) return
          // Phase 2: captions + hook
          setPhase(2)

          timerRef.current = setTimeout(() => {
            if (!mountedRef.current) return
            // Phase 3: badge + score count
            setPhase(3)
            setScore(87)
            let s = 87
            scoreIntervalRef.current = setInterval(() => {
              if (!mountedRef.current) return
              s += 1
              if (s >= 96) {
                setScore(96)
                if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
              } else {
                setScore(s)
              }
            }, 150)

            timerRef.current = setTimeout(() => {
              if (!mountedRef.current) return
              // Phase 4: pulse + fade
              setPhase(4)

              timerRef.current = setTimeout(() => {
                if (!mountedRef.current) return
                runCycle()
              }, 1000)
            }, 1500)
          }, 2000)
        }, 1500)
      }, 1000)
    }

    runCycle()

    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
    }
  }, [reducedMotion])

  return (
    <div className="hpm-wrap">
      {/* Phone frame */}
      <div className="hpm-phone">
        <div className="hpm-notch" />
        <div className="hpm-screen">
          {/* Thumbnail — horizontal -> vertical */}
          <div className={`hpm-thumb ${phase >= 1 ? 'hpm-thumb-vertical' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/radar-thumb-1.jpg"
              alt=""
              draggable={false}
            />
          </div>

          {/* Hook capsule — slides from top */}
          <div className={`hpm-hook ${phase >= 2 ? 'hpm-hook-visible' : ''}`}>
            WAIT FOR IT...
          </div>

          {/* Karaoke captions */}
          <div className={`hpm-captions ${phase >= 2 ? 'hpm-captions-visible' : ''}`}>
            <span className={`hpm-word hpm-w1 ${phase >= 2 ? 'hpm-word-active' : ''}`}>THIS</span>
            <span className={`hpm-word hpm-w2 ${phase >= 2 ? 'hpm-word-active' : ''}`}>IS</span>
            <span className={`hpm-word hpm-w3 ${phase >= 2 ? 'hpm-word-active' : ''}`}>CRAZY</span>
          </div>

          {/* TikTok Ready badge */}
          <div className={`hpm-badge ${phase >= 3 ? 'hpm-badge-visible' : ''}`}>
            TIKTOK READY
          </div>

          {/* Score */}
          <div className={`hpm-score ${phase >= 3 ? 'hpm-score-visible' : ''}`}>
            {score}
          </div>

          {/* Publish pulse */}
          <div className={`hpm-pulse ${phase >= 4 && !reducedMotion ? 'hpm-pulse-active' : ''}`} />

          {/* Fade overlay for cycle restart */}
          <div className={`hpm-fade ${phase >= 4 && !reducedMotion ? 'hpm-fade-active' : ''}`} />
        </div>
      </div>
    </div>
  )
}
