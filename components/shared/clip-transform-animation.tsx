/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Play, Eye, DollarSign, Type, Monitor } from 'lucide-react'

const THUMBNAIL = 'https://static-cdn.jtvnw.net/twitch-clips/88IOIjUFzPnqNfIAxkEg4Q/AT-cm%7C88IOIjUFzPnqNfIAxkEg4Q-preview-480x272.jpg'

/**
 * Animated clip transformation: normal clip (65) → enhanced (97) → views → cash
 * Used on both signup and landing pages.
 */
export function ClipTransformAnimation({ compact = false }: { compact?: boolean }) {
  // 0=normal, 1=adding enhancements, 2=enhanced+score, 3=views, 4=cash
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1800),
      setTimeout(() => setPhase(2), 3600),
      setTimeout(() => setPhase(3), 5200),
      setTimeout(() => setPhase(4), 6800),
      // Loop
      setTimeout(() => setPhase(0), 9000),
    ]
    const loop = setInterval(() => {
      setPhase(0)
      setTimeout(() => setPhase(1), 1800)
      setTimeout(() => setPhase(2), 3600)
      setTimeout(() => setPhase(3), 5200)
      setTimeout(() => setPhase(4), 6800)
    }, 9000)
    return () => { timers.forEach(clearTimeout); clearInterval(loop) }
  }, [])

  const w = compact ? 220 : 260
  const scoreValue = phase >= 2 ? 97 : 65

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative rounded-[1.5rem] overflow-hidden bg-black border border-white/10 shadow-2xl shadow-blue-500/10 mx-auto"
        style={{ width: w, aspectRatio: '9/16' }}
      >
        {/* ─── Top section: Thumbnail ─────────────────────────── */}
        <motion.div
          animate={{ height: phase >= 1 ? '60%' : '100%' }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="absolute inset-x-0 top-0 overflow-hidden"
        >
          <img src={THUMBNAIL} alt="Stream clip" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

          {/* LIVE badge — phase 0 only */}
          <AnimatePresence>
            {phase === 0 && (
              <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 rounded px-2 py-0.5"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] font-bold text-white">LIVE</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Streamer tag — appears in phase 1+ */}
          <AnimatePresence>
            {phase >= 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1"
              >
                <span className="text-[10px] font-bold text-white">@kaicenat</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Platform icon — appears in phase 1+ */}
          <AnimatePresence>
            {phase >= 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute top-3 left-3"
              >
                <div className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ─── Karaoke subtitles — phase 1+ ───────────────────── */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="absolute top-[52%] left-1/2 -translate-x-1/2 z-20 bg-black/80 rounded-lg px-3 py-1.5 backdrop-blur-sm"
            >
              <p className="text-xs font-black text-center whitespace-nowrap">
                <span className="text-white">Kevin Hart </span>
                <span className="text-yellow-400 bg-yellow-400/20 px-0.5 rounded">DRENCHED</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Split line — phase 1+ ──────────────────────────── */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.4 }}
              className="absolute top-[60%] inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent z-10 origin-center"
            />
          )}
        </AnimatePresence>

        {/* ─── B-roll (Subway Surfers) — phase 1+ ─────────────── */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-br from-emerald-600/80 to-teal-500/80 overflow-hidden"
            >
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)',
                  backgroundSize: '22px 22px',
                  animation: 'broll-slide 2s linear infinite',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-white/50 font-medium">Subway Surfers</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Score badge — always visible, animates value ──── */}
        <motion.div
          animate={{
            scale: phase === 2 ? [1, 1.3, 1] : 1,
          }}
          transition={{ duration: 0.5 }}
          className="absolute bottom-3 left-3 z-20"
        >
          <div className={`rounded-lg px-2 py-1 shadow-lg transition-all duration-500 ${
            phase >= 2
              ? 'bg-gradient-to-r from-yellow-500 to-amber-500 shadow-yellow-500/30'
              : 'bg-black/60 backdrop-blur-sm'
          }`}>
            <div className="flex items-center gap-1">
              <TrendingUp className={`h-3 w-3 ${phase >= 2 ? 'text-black' : 'text-white/60'}`} />
              <motion.span
                key={scoreValue}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className={`text-sm font-black ${phase >= 2 ? 'text-black' : 'text-white/80'}`}
              >
                {scoreValue}
              </motion.span>
            </div>
          </div>
        </motion.div>

        {/* ─── Play button — phase 0 only ─────────────────────── */}
        <AnimatePresence>
          {phase === 0 && (
            <motion.div
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center backdrop-blur-sm">
                <Play className="h-5 w-5 text-white ml-0.5" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Phase indicators below the clip ─────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes broll-slide { from { background-position: 0 0; } to { background-position: 22px 22px; } }
      ` }} />

      <div className="flex items-center gap-3">
        {[
          { icon: Type, label: 'Sous-titres', active: phase >= 1 },
          { icon: Monitor, label: 'Split-screen', active: phase >= 1 },
          { icon: TrendingUp, label: 'Score 97', active: phase >= 2 },
          { icon: Eye, label: '2.4M vues', active: phase >= 3 },
          { icon: DollarSign, label: 'Revenus', active: phase >= 4 },
        ].map((step, i) => (
          <motion.div
            key={step.label}
            animate={{
              opacity: step.active ? 1 : 0.3,
              scale: step.active ? 1 : 0.9,
            }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-1"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${
              step.active
                ? i === 4 ? 'bg-green-500/20 text-green-400' : 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}>
              <step.icon className="h-3.5 w-3.5" />
            </div>
            <span className={`text-[9px] font-medium transition-colors duration-300 ${
              step.active ? 'text-foreground' : 'text-muted-foreground/50'
            }`}>
              {step.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
