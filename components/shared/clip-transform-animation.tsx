/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Eye, DollarSign } from 'lucide-react'

// ─── Streamer data ──────────────────────────────────────────────────────────

interface StreamerScene {
  handle: string
  thumbnail: string
  karaoke: string[]
  scoreBefore: number
  scoreAfter: number
  views: string
  revenue: string
}

const SCENES: StreamerScene[] = [
  {
    handle: '@kaicenat',
    thumbnail: '/images/streamer-1.jpg',
    karaoke: ['Kevin', 'Hart', 'gets', 'DRENCHED'],
    scoreBefore: 47,
    scoreAfter: 96,
    views: '2.4M',
    revenue: '+$1,240',
  },
  {
    handle: '@ishowspeed',
    thumbnail: '/images/streamer-2.jpg',
    karaoke: ['Speed', 'gets', 'jump', 'SCARED'],
    scoreBefore: 52,
    scoreAfter: 98,
    views: '3.1M',
    revenue: '+$1,870',
  },
  {
    handle: '@xqc',
    thumbnail: '/images/streamer-3.jpg',
    karaoke: ['Makes', 'the', 'wrong', 'CHOICE'],
    scoreBefore: 41,
    scoreAfter: 94,
    views: '1.8M',
    revenue: '+$960',
  },
  {
    handle: '@jynxzi',
    thumbnail: '/images/streamer-4.jpg',
    karaoke: ['Kiss', 'on', 'the', 'LIPS'],
    scoreBefore: 55,
    scoreAfter: 97,
    views: '4.2M',
    revenue: '+$2,100',
  },
]

// Colorful gameplay image for split-screen bottom (local asset)
const GAMEPLAY_IMG = '/images/gameplay.jpg'

// ─── Animated counter hook ──────────────────────────────────────────────────

function useAnimatedCounter(target: number, active: boolean, duration = 600) {
  const [value, setValue] = useState(target)

  useEffect(() => {
    if (!active) { setValue(target); return }
    const start = value
    const diff = target - start
    if (diff === 0) return
    const startTime = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(start + diff * eased))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, active, duration])

  return value
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ClipTransformAnimation({ compact = false }: { compact?: boolean }) {
  const [sceneIdx, setSceneIdx] = useState(0)
  // 0=normal clip, 1=enhancing, 2=enhanced, 3=results, 4=fade out
  const [phase, setPhase] = useState(0)
  const [karaokeIdx, setKaraokeIdx] = useState(0)

  const scene = SCENES[sceneIdx]

  // Phase cycle per scene
  const runCycle = useCallback(() => {
    setPhase(0)
    setKaraokeIdx(0)
    const t1 = setTimeout(() => setPhase(1), 1500)
    const t2 = setTimeout(() => setPhase(2), 3000)
    const t3 = setTimeout(() => setPhase(3), 5000)
    const t4 = setTimeout(() => setPhase(4), 7000)
    const t5 = setTimeout(() => {
      setSceneIdx((i) => (i + 1) % SCENES.length)
      setPhase(0)
      setKaraokeIdx(0)
    }, 8000)
    return [t1, t2, t3, t4, t5]
  }, [])

  useEffect(() => {
    let timers = runCycle()
    const loop = setInterval(() => {
      timers.forEach(clearTimeout)
      timers = runCycle()
    }, 8000)
    return () => { timers.forEach(clearTimeout); clearInterval(loop) }
  }, [runCycle])

  // Karaoke word cycling
  useEffect(() => {
    if (phase < 1 || phase >= 4) { setKaraokeIdx(0); return }
    const interval = setInterval(() => {
      setKaraokeIdx((i) => (i + 1) % scene.karaoke.length)
    }, 450)
    return () => clearInterval(interval)
  }, [phase, scene.karaoke.length])

  const scoreTarget = phase >= 2 ? scene.scoreAfter : scene.scoreBefore
  const displayScore = useAnimatedCounter(scoreTarget, phase >= 2)

  const w = compact ? 230 : 270

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="relative rounded-[1.8rem] overflow-hidden bg-black border-2 border-white/10 shadow-2xl shadow-blue-500/15 mx-auto"
        style={{ width: w, aspectRatio: '9/16' }}
      >
        {/* ─── Clip thumbnail (cycles between streamers) ─────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={sceneIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 4 ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            {/* Stream image — top section */}
            <motion.div
              animate={{ height: phase >= 1 ? '58%' : '100%' }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-x-0 top-0 overflow-hidden"
            >
              <img
                src={scene.thumbnail}
                alt={scene.handle}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </motion.div>

            {/* ─── Streamer tag — phase 1+ ─────────────────────── */}
            <AnimatePresence>
              {phase >= 1 && phase < 4 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="absolute top-3 right-3 z-20 bg-black/70 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10"
                >
                  <span className="text-[10px] font-bold text-white">{scene.handle}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── TikTok icon — phase 1+ ─────────────────────── */}
            <AnimatePresence>
              {phase >= 1 && phase < 4 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="absolute top-3 left-3 z-20 w-7 h-7 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center border border-white/10"
                >
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Karaoke subtitles — phase 1+ ───────────────── */}
            <AnimatePresence>
              {phase >= 1 && phase < 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="absolute top-[50%] left-1/2 -translate-x-1/2 z-20 bg-black/85 rounded-xl px-3 py-2 backdrop-blur-md border border-white/5"
                >
                  <p className="text-[11px] sm:text-xs font-black text-center whitespace-nowrap tracking-wide">
                    {scene.karaoke.map((word, i) => (
                      <span key={i}>
                        <span className={`inline-block transition-all duration-150 ${
                          i === karaokeIdx
                            ? 'text-yellow-400 bg-yellow-400/25 px-0.5 rounded scale-110'
                            : i < karaokeIdx ? 'text-white/50' : 'text-white'
                        }`}>
                          {word}
                        </span>
                        {i < scene.karaoke.length - 1 && ' '}
                      </span>
                    ))}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Split divider — phase 1+ ────────────────────── */}
            <AnimatePresence>
              {phase >= 1 && phase < 4 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute top-[58%] inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400/80 to-transparent z-10 origin-center"
                />
              )}
            </AnimatePresence>

            {/* ─── Gameplay image (split-screen) — phase 1+ ───── */}
            <AnimatePresence>
              {phase >= 1 && phase < 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute inset-x-0 bottom-0 h-[42%] overflow-hidden"
                >
                  <img
                    src={GAMEPLAY_IMG}
                    alt="Gameplay"
                    className="w-full h-full object-cover brightness-110 saturate-150"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Score badge — always visible ────────────────── */}
            <motion.div
              animate={{
                scale: phase === 2 ? [1, 1.25, 1] : 1,
              }}
              transition={{ duration: 0.5 }}
              className="absolute bottom-3 left-3 z-30"
            >
              <div className={`rounded-xl px-2.5 py-1 shadow-xl transition-all duration-500 ${
                phase >= 2
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-500 shadow-yellow-500/40'
                  : 'bg-black/70 backdrop-blur-md border border-white/10'
              }`}>
                <div className="flex items-center gap-1">
                  <TrendingUp className={`h-3 w-3 ${phase >= 2 ? 'text-black' : 'text-white/60'}`} />
                  <span className={`text-sm font-black tabular-nums ${phase >= 2 ? 'text-black' : 'text-white/80'}`}>
                    {displayScore}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* ─── Views counter — phase 3 ─────────────────────── */}
            <AnimatePresence>
              {phase >= 3 && phase < 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute bottom-3 right-3 z-30 bg-black/70 backdrop-blur-md rounded-xl px-2.5 py-1 border border-white/10"
                >
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3 text-blue-400" />
                    <span className="text-[11px] font-bold text-white">{scene.views}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Revenue — phase 3 ───────────────────────────── */}
            <AnimatePresence>
              {phase >= 3 && phase < 4 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.3 }}
                  className="absolute top-[38%] right-3 z-30 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl px-2 py-1 shadow-xl shadow-green-500/30 border border-green-400/20"
                >
                  <div className="flex items-center gap-0.5">
                    <DollarSign className="h-3 w-3 text-white" />
                    <span className="text-[10px] font-black text-white">{scene.revenue}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── Phase label ──────────────────────────────────────── */}
      <div className="h-5 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === 0 && (
            <motion.p key="p0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-muted-foreground/60">
              Clip de stream normal
            </motion.p>
          )}
          {phase === 1 && (
            <motion.p key="p1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-blue-400 font-medium">
              Enhancement en cours...
            </motion.p>
          )}
          {phase === 2 && (
            <motion.p key="p2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-yellow-400 font-bold">
              Score viral : {scene.scoreAfter}
            </motion.p>
          )}
          {phase === 3 && (
            <motion.p key="p3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-green-400 font-bold">
              {scene.views} vues &middot; {scene.revenue}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Streamer dots (active indicator) ─────────────────── */}
      <div className="flex items-center gap-1.5">
        {SCENES.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === sceneIdx ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
