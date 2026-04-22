"use client"

import { ArrowRight, Play, ChevronDown } from 'lucide-react'
import { AnimatedSection } from '@/components/landing/animated-section'

export function BeforeAfterSection() {
  return (
    <section className="py-20 px-6 border-t border-border/30">
      <AnimatedSection className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Your Stream Deserves More Than 12 Viewers</h2>
          <p className="text-muted-foreground mt-3 text-lg">It&apos;s not your content—it&apos;s the format. Here&apos;s what we fix.</p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
          {/* Before — 16:9 horizontal */}
          <div className="relative w-full max-w-sm">
            <div className="absolute -top-3 left-4 z-10">
              <span className="bg-red-500/90 text-white text-xs font-bold px-3 py-1 rounded-full">BEFORE</span>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
                <div className="text-center z-10">
                  <div className="w-14 h-14 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-2">
                    <Play className="h-6 w-6 text-gray-500 ml-0.5" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Raw Stream — 16:9</p>
                  <p className="text-xs text-gray-600 mt-1">Full 3h47 stream</p>
                </div>
              </div>
              <div className="p-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-2"><span className="text-gray-500">Format:</span><span className="text-gray-400">16:9 horizontal</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-500">Captions:</span><span className="text-red-400">None</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-500">Viral Score:</span><span className="text-red-400">N/A</span></div>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex flex-col items-center gap-2">
            <ArrowRight className="h-8 w-8 text-primary/40" />
            <span className="text-[10px] text-muted-foreground/40 font-medium">5 min</span>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <ChevronDown className="h-6 w-6 text-primary/40" />
          </div>

          {/* After — 9:16 vertical phone mockup */}
          <div className="relative">
            <div className="absolute -top-3 left-4 z-10">
              <span className="bg-emerald-500/90 text-white text-xs font-bold px-3 py-1 rounded-full">AFTER</span>
            </div>
            <div className="w-[180px] sm:w-[200px] rounded-[2rem] border-2 border-emerald-500/30 bg-gray-900 p-2 shadow-2xl shadow-emerald-500/10">
              <div className="rounded-[1.5rem] overflow-hidden bg-black relative" style={{ aspectRatio: '9/16' }}>
                {/* Top: stream clip */}
                <div className="absolute inset-x-0 top-0 h-[60%] bg-gradient-to-br from-indigo-900/50 to-purple-900/40 flex items-center justify-center">
                  <div className="absolute top-3 left-3 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-[8px] font-bold text-white/70">LIVE</span>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-blue-300/80 font-medium">Stream Clip</p>
                  </div>
                  {/* Karaoke subtitle */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 rounded-lg px-2.5 py-1">
                    <p className="text-[9px] font-bold whitespace-nowrap">
                      <span className="text-yellow-400">That&apos;s</span>{' '}
                      <span className="text-yellow-400">absolutely</span>{' '}
                      <span className="text-white">INSANE</span>
                    </p>
                  </div>
                </div>
                {/* Divider */}
                <div className="absolute top-[60%] inset-x-0 h-0.5 bg-blue-500/30" />
                {/* Bottom: satisfying video */}
                <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-br from-emerald-900/30 to-teal-900/20 flex items-center justify-center">
                  <span className="text-[9px] text-emerald-400/60 font-medium">Subway Surfers</span>
                </div>
                {/* Score */}
                <div className="absolute bottom-2 right-2 bg-black/60 rounded-md px-1.5 py-0.5 border border-emerald-500/30">
                  <span className="text-[9px] font-bold text-emerald-400">87</span>
                </div>
              </div>
            </div>
            {/* Labels */}
            <div className="mt-3 space-y-1.5 text-xs pl-2">
              <div className="flex items-center gap-2"><span className="text-gray-500">Format:</span><span className="text-emerald-400">9:16 TikTok Ready</span></div>
              <div className="flex items-center gap-2"><span className="text-gray-500">Captions:</span><span className="text-emerald-400">MrBeast Karaoke</span></div>
              <div className="flex items-center gap-2"><span className="text-gray-500">Split-Screen:</span><span className="text-emerald-400">Subway Surfers</span></div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Score:</span>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-16 rounded-full bg-gray-700 overflow-hidden">
                    <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-emerald-500 to-green-400" />
                  </div>
                  <span className="text-xs font-bold text-emerald-400">87/100</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </section>
  )
}
