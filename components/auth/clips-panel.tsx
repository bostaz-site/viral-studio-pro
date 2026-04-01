/* eslint-disable @next/next/no-img-element */
"use client"

import { motion } from 'framer-motion'
import { TrendingUp, Play, Scissors } from 'lucide-react'

const MINI_CLIPS = [
  {
    streamer: 'KaiCenat',
    handle: '@kaicenat',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips/88IOIjUFzPnqNfIAxkEg4Q/AT-cm%7C88IOIjUFzPnqNfIAxkEg4Q-preview-480x272.jpg',
    score: 97,
    gradient: 'from-emerald-600/80 to-teal-500/80',
  },
  {
    streamer: 'Jynxzi',
    handle: '@jynxzi',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips/STEG3XE8W9bFbKHyEwN5Jg/AT-cm%7CSTEG3XE8W9bFbKHyEwN5Jg-preview-480x272.jpg',
    score: 94,
    gradient: 'from-orange-500/80 to-amber-500/80',
  },
  {
    streamer: 'xQc',
    handle: '@xqc',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips/AT-cm%7C961443378-preview-480x272.jpg',
    score: 92,
    gradient: 'from-blue-600/80 to-cyan-500/80',
  },
  {
    streamer: 'HasanAbi',
    handle: '@hasanabi',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips/AT-cm%7C902106752-preview-480x272.jpg',
    score: 89,
    gradient: 'from-purple-600/80 to-pink-500/80',
  },
  {
    streamer: 'AdinRoss',
    handle: '@adinross',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips/kN5xYj8Vta-j59QgA_wgSg/AT-cm%7CkN5xYj8Vta-j59QgA_wgSg-preview-480x272.jpg',
    score: 91,
    gradient: 'from-red-500/80 to-orange-500/80',
  },
  {
    streamer: 'IShowSpeed',
    handle: '@ishowspeed',
    thumbnail: 'https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/FlaccidRealChoughPRChase-sxx8aLkNwPOo1Jyv/8c2313f0-d1a4-4bf7-b5c5-8e71e7661418/preview-480x272.jpg',
    score: 93,
    gradient: 'from-yellow-500/80 to-orange-500/80',
  },
]

function MiniClipCard({ clip, index }: { clip: typeof MINI_CLIPS[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.1, duration: 0.5, ease: 'easeOut' }}
    >
      <div
        className="relative rounded-xl overflow-hidden border border-white/10 bg-black shadow-lg hover:shadow-blue-500/10 transition-shadow duration-300"
        style={{ aspectRatio: '9/16' }}
      >
        {/* Top 60%: Thumbnail */}
        <div className="absolute inset-x-0 top-0 h-[60%] overflow-hidden">
          <img
            src={clip.thumbnail}
            alt={clip.streamer}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <span className="text-[7px] font-bold text-white">{clip.handle}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="absolute top-[60%] inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/40 to-transparent z-10" />

        {/* Bottom 40%: B-roll */}
        <div className={`absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-br ${clip.gradient}`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="h-3 w-3 text-white/30 ml-0.5" />
          </div>
        </div>

        {/* Score badge */}
        <div className="absolute bottom-1.5 left-1.5 bg-gradient-to-r from-yellow-500 to-amber-500 rounded px-1 py-0.5">
          <div className="flex items-center gap-0.5">
            <TrendingUp className="h-2 w-2 text-black" />
            <span className="text-[8px] font-black text-black">{clip.score}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function AuthClipsPanel() {
  return (
    <div className="relative z-10 flex flex-col justify-center px-8 xl:px-16 w-full h-full">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Scissors className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white">VIRAL STUDIO</span>
        </div>
        <p className="text-base text-blue-200/70 max-w-sm leading-relaxed">
          Transforme tes streams en clips viraux avec split-screen et sous-titres karaok&eacute;.
        </p>
      </motion.div>

      {/* Clip grid */}
      <div className="grid grid-cols-3 gap-3 max-w-xs">
        {MINI_CLIPS.map((clip, i) => (
          <MiniClipCard key={clip.streamer} clip={clip} index={i} />
        ))}
      </div>

      {/* Social proof */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="mt-8 flex items-center gap-3"
      >
        <div className="flex -space-x-2">
          {[
            'from-purple-400 to-blue-500',
            'from-blue-400 to-indigo-500',
            'from-indigo-400 to-violet-500',
            'from-emerald-400 to-teal-500',
          ].map((grad, i) => (
            <div
              key={i}
              className={`w-7 h-7 rounded-full border-2 border-indigo-950 bg-gradient-to-br ${grad}`}
            />
          ))}
        </div>
        <p className="text-xs text-blue-200/50">
          <span className="font-semibold text-blue-200/70">2,340+</span> cr&eacute;ateurs actifs
        </p>
      </motion.div>
    </div>
  )
}
