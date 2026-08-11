'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Branded glitch error screen (404 / crash pages).
 * Viral Animal constitution: bg #020617, amber = action, cyan = system.
 * prefers-reduced-motion → static (no glitch loops).
 */

function GlitchText({ text }: { text: string }) {
  const reduced = useReducedMotion()
  return (
    <span className="relative inline-block">
      <span className="relative z-10">{text}</span>
      {!reduced && (
        <>
          <motion.span
            aria-hidden
            className="absolute inset-0 text-cyan-400/50"
            animate={{ x: [0, 3, -3, 0], opacity: [1, 0.8, 0.8, 1] }}
            transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 3.6, delay: 0.05 }}
          >
            {text}
          </motion.span>
          <motion.span
            aria-hidden
            className="absolute inset-0 text-amber-400/40"
            animate={{ x: [0, -3, 3, 0], opacity: [1, 0.7, 0.7, 1] }}
            transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 3.6, delay: 0.11 }}
          >
            {text}
          </motion.span>
        </>
      )}
    </span>
  )
}

export function GlitchErrorScreen({
  code,
  label,
  title,
  message,
  actions,
  footer,
}: {
  code: string
  label: string
  title: string
  message: string
  actions: ReactNode
  footer?: ReactNode
}) {
  const reduced = useReducedMotion()
  return (
    <div className="min-h-screen w-full bg-[#020617] text-white flex flex-col items-center justify-center overflow-hidden">
      <div className="flex flex-col items-center text-center px-6 max-w-2xl mx-auto">
        {/* Glitch code */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative select-none mb-6"
        >
          <span
            className="block text-[clamp(7rem,22vw,13rem)] font-black leading-none tracking-tighter text-transparent font-mono"
            style={{ WebkitTextStroke: '2px rgba(255,255,255,0.18)' }}
          >
            <GlitchText text={code} />
          </span>
          {/* Amber glow pulse behind */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            animate={reduced ? undefined : { opacity: [0.05, 0.14, 0.05] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="block text-[clamp(7rem,22vw,13rem)] font-black leading-none tracking-tighter text-amber-400 blur-2xl font-mono">
              {code}
            </span>
          </motion.div>
        </motion.div>

        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }}
          className="mb-2 flex items-center gap-2"
        >
          <span className="h-px w-8 bg-white/20" />
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400/80">{label}</span>
          <span className="h-px w-8 bg-white/20" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease: 'easeOut' }}
          className="text-2xl md:text-4xl font-black tracking-tight mb-4"
        >
          {title}
        </motion.h1>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.45, ease: 'easeOut' }}
          className="text-sm md:text-base text-white/50 max-w-sm leading-relaxed mb-10"
        >
          {message}
        </motion.p>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          {actions}
        </motion.div>

        {footer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.75 }}
            className="mt-12"
          >
            {footer}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export function GlitchPrimaryButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-black text-amber-950 transition-all"
      style={{
        background: 'linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)',
        boxShadow: '0 0 20px rgba(245,158,11,.22)',
      }}
    >
      {children}
    </motion.button>
  )
}

export function GlitchSecondaryButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-transparent px-6 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:border-white/30 hover:text-white"
    >
      {children}
    </motion.button>
  )
}
