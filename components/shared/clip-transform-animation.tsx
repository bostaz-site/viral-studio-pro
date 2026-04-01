/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Play, Eye, DollarSign, Type, Monitor } from 'lucide-react'

// KaiCenat clip — old-format thumbnail so video URL works
const CLIP_THUMBNAIL = 'https://static-cdn.jtvnw.net/twitch-clips/88IOIjUFzPnqNfIAxkEg4Q/AT-cm%7C88IOIjUFzPnqNfIAxkEg4Q-preview-480x272.jpg'
const CLIP_VIDEO = 'https://clips-media-assets2.twitch.tv/88IOIjUFzPnqNfIAxkEg4Q/AT-cm%7C88IOIjUFzPnqNfIAxkEg4Q.mp4'
const BROLL_VIDEO = '/assets/gameplay-broll.mp4'

const KARAOKE_WORDS = ['Kevin', 'Hart', 'gets', 'DRENCHED']

export function ClipTransformAnimation({ compact = false }: { compact?: boolean }) {
  const [phase, setPhase] = useState(0)
  const [karaokeIdx, setKaraokeIdx] = useState(0)

  useEffect(() => {
    const schedule = () => {
      const t1 = setTimeout(() => setPhase(1), 1800)
      const t2 = setTimeout(() => setPhase(2), 3600)
      const t3 = setTimeout(() => setPhase(3), 5200)
      const t4 = setTimeout(() => setPhase(4), 6800)
      const t5 = setTimeout(() => setPhase(0), 9000)
      return [t1, t2, t3, t4, t5]
    }
    let timers = schedule()
    const loop = setInterval(() => {
      timers.forEach(clearTimeout)
      setPhase(0)
      timers = schedule()
    }, 9000)
    return () => { timers.forEach(clearTimeout); clearInterval(loop) }
  }, [])

  useEffect(() => {
    if (phase < 1) { setKaraokeIdx(0); return }
    const interval = setInterval(() => {
      setKaraokeIdx((i) => (i + 1) % KARAOKE_WORDS.length)
    }, 500)
    return () => clearInterval(interval)
  }, [phase])

  const w = compact ? 230 : 270
  const scoreValue = phase >= 2 ? 97 : 65

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="relative rounded-[1.8rem] overflow-hidden bg-black border-2 border-white/10 shadow-2xl shadow-blue-500/15 mx-auto"
        style={{ width: w, aspectRatio: '9/16' }}
      >
        {/* ─── Top: Stream clip VIDEO ────────────────────────────── */}
        <motion.div
          animate={{ height: phase >= 1 ? '58%' : '100%' }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-x-0 top-0 overflow-hidden"
        >
          <video
            src={CLIP_VIDEO}
            poster={CLIP_THUMBNAIL}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* LIVE badge — phase 0 */}
          <AnimatePresence mode="wait">
            {phase === 0 && (
              <motion.div
                key="live"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 rounded-md px-2 py-0.5 shadow-lg shadow-red-600/30"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] font-bold text-white tracking-wide">LIVE</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Platform icon (TikTok) — phase 1+ */}
          <AnimatePresence>
            {phase >= 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
                className="absolute top-3 left-3"
              >
                <div className="w-7 h-7 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg">
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Streamer tag — phase 1+ */}
          <AnimatePresence>
            {phase >= 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
                className="absolute top-3 right-3 bg-black/70 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10 shadow-lg"
              >
                <span className="text-[10px] font-bold text-white">@kaicenat</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ─── Karaoke subtitles — phase 1+ ──────────────────────── */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="absolute top-[50%] left-1/2 -translate-x-1/2 z-20 bg-black/85 rounded-xl px-3 py-2 backdrop-blur-md border border-white/5 shadow-xl"
            >
              <p className="text-[11px] sm:text-xs font-black text-center whitespace-nowrap tracking-wide">
                {KARAOKE_WORDS.map((word, i) => (
                  <span key={i}>
                    <span
                      className={`transition-all duration-150 inline-block ${
                        i === karaokeIdx
                          ? 'text-yellow-400 bg-yellow-400/25 px-0.5 rounded scale-110'
                          : i < karaokeIdx
                          ? 'text-white/50'
                          : 'text-white'
                      }`}
                    >
                      {word}
                    </span>
                    {i < KARAOKE_WORDS.length - 1 && ' '}
                  </span>
                ))}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Split divider — phase 1+ ──────────────────────────── */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute top-[58%] inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400/80 to-transparent z-10 origin-center"
            />
          )}
        </AnimatePresence>

        {/* ─── Bottom: B-roll gameplay VIDEO — phase 1+ ──────────── */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-x-0 bottom-0 h-[42%] overflow-hidden"
            >
              <video
                src={BROLL_VIDEO}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Score badge ────────────────────────────────────────── */}
        <motion.div
          animate={{ scale: phase === 2 ? [1, 1.3, 1] : 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute bottom-3 left-3 z-30"
        >
          <div className={`rounded-xl px-2.5 py-1 shadow-xl transition-all duration-500 ${
            phase >= 2
              ? 'bg-gradient-to-r from-yellow-500 to-amber-500 shadow-yellow-500/40'
              : 'bg-black/70 backdrop-blur-md border border-white/10'
          }`}>
            <div className="flex items-center gap-1">
              <TrendingUp className={`h-3 w-3 ${phase >= 2 ? 'text-black' : 'text-white/60'}`} />
              <motion.span
                key={scoreValue}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className={`text-sm font-black ${phase >= 2 ? 'text-black' : 'text-white/80'}`}
              >
                {scoreValue}
              </motion.span>
            </div>
          </div>
        </motion.div>

        {/* ─── Play button — phase 0 only ─────────────────────────── */}
        <AnimatePresence>
          {phase === 0 && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center backdrop-blur-sm shadow-xl">
                <Play className="h-6 w-6 text-white ml-0.5" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Views counter — phase 3+ ───────────────────────────── */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute bottom-3 right-3 z-30 bg-black/70 backdrop-blur-md rounded-xl px-2.5 py-1 border border-white/10 shadow-xl"
            >
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3 text-blue-400" />
                <span className="text-[11px] font-bold text-white">2.4M</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Cash icon — phase 4 ────────────────────────────────── */}
        <AnimatePresence>
          {phase >= 4 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="absolute top-[38%] right-3 z-30 w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-green-500/40 border border-green-400/30"
            >
              <DollarSign className="h-4 w-4 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Phase indicators ─────────────────────────────────────── */}
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
