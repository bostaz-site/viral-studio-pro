"use client"

import Link from 'next/link'
import { ArrowRight, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function HowItWorksSection() {
  return (
    <section className="py-20 px-6 border-t border-border/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Create Your First Viral Clip in 3 Steps</h2>
          <p className="text-muted-foreground mt-3 text-lg">From your Twitch stream to TikTok in under 5 minutes</p>
        </div>

        <div className="space-y-16">
          {/* Step 1 — Browse clips */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-block text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Step 1</span>
              <h3 className="text-2xl font-bold text-foreground mb-3">Pick Your Stream Clip</h3>
              <p className="text-muted-foreground leading-relaxed">Browse top Twitch and YouTube Gaming moments ranked by viral score. AI auto-identifies the moments that hit hardest.</p>
            </div>
            {/* Mockup: trending dashboard */}
            <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden shadow-lg">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 bg-card/80">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="text-[10px] text-muted-foreground/50 ml-2">Clips — Viral Animal</span>
              </div>
              <div className="p-3 space-y-2">
                {/* Search bar mockup */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/30">
                  <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                  <span className="text-[10px] text-muted-foreground/50">Search streamer or game...</span>
                </div>
                {/* Clip cards */}
                {[
                  { name: 'xQc', game: 'Just Chatting', score: 92, color: 'from-purple-500/20 to-purple-600/10' },
                  { name: 'Sardoche', game: 'League of Legends', score: 87, color: 'from-blue-500/20 to-blue-600/10' },
                  { name: 'Kamet0', game: 'Valorant', score: 78, color: 'from-emerald-500/20 to-emerald-600/10' },
                ].map((clip) => (
                  <div key={clip.name} className={cn('flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r', clip.color)}>
                    <div className="w-14 h-9 rounded bg-gray-800 shrink-0 flex items-center justify-center">
                      <Play className="h-3 w-3 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-foreground truncate">{clip.name} — {clip.game}</p>
                      <p className="text-[8px] text-muted-foreground">2h ago &middot; 45s</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-1 w-8 rounded-full bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${clip.score}%` }} />
                      </div>
                      <span className="text-[9px] font-bold text-emerald-400">{clip.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2 — Edit */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Mockup: editor */}
            <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden shadow-lg md:order-1 order-2">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 bg-card/80">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="text-[10px] text-muted-foreground/50 ml-2">Editor — Viral Animal</span>
              </div>
              <div className="p-3 flex gap-3">
                {/* Preview */}
                <div className="w-24 shrink-0">
                  <div className="aspect-[9/16] rounded-lg bg-gradient-to-b from-indigo-900/30 to-gray-900 border border-border/30 relative overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-[60%] bg-gradient-to-br from-purple-900/40 to-indigo-900/40 flex items-center justify-center">
                      <span className="text-[7px] text-blue-300/60">Your Clip</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-br from-emerald-900/30 to-teal-900/30 flex items-center justify-center border-t border-blue-500/20">
                      <span className="text-[7px] text-emerald-400/60">Satisfying Video</span>
                    </div>
                    <div className="absolute bottom-[42%] left-1/2 -translate-x-1/2 bg-black/70 rounded px-1.5 py-0.5">
                      <span className="text-[6px] font-bold text-yellow-400">Incroyable!</span>
                    </div>
                  </div>
                </div>
                {/* Controls */}
                <div className="flex-1 space-y-2">
                  <div className="space-y-1">
                    <span className="text-[8px] text-muted-foreground/60 uppercase tracking-wider">Caption Style</span>
                    <div className="grid grid-cols-3 gap-1">
                      {['Hormozi', 'MrBeast', 'Gaming'].map((s) => (
                        <div key={s} className={cn('text-[7px] text-center py-1 rounded border', s === 'MrBeast' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/30 text-muted-foreground/50')}>
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] text-muted-foreground/60 uppercase tracking-wider">Bottom Video</span>
                    <div className="grid grid-cols-2 gap-1">
                      {['Subway Surfers', 'Minecraft'].map((s) => (
                        <div key={s} className={cn('text-[7px] text-center py-1 rounded border', s === 'Subway Surfers' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-border/30 text-muted-foreground/50')}>
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Timeline mockup */}
                  <div className="pt-1">
                    <div className="h-3 rounded bg-muted/30 relative overflow-hidden">
                      <div className="absolute left-[10%] right-[30%] top-0 bottom-0 bg-blue-500/20 border-x-2 border-blue-500/50 rounded" />
                      <div className="absolute left-[35%] top-0 bottom-0 w-0.5 bg-white/60" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:order-2 order-1">
              <span className="inline-block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Step 2</span>
              <h3 className="text-2xl font-bold text-foreground mb-3">Customize Your Clip</h3>
              <p className="text-muted-foreground leading-relaxed">Karaoke captions (9 styles), auto split-screen with satisfying video, and AI viral score analysis. Tweak everything in a few clicks.</p>
            </div>
          </div>

          {/* Step 3 — Export */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Step 3</span>
              <h3 className="text-2xl font-bold text-foreground mb-3">Export & Share</h3>
              <p className="text-muted-foreground leading-relaxed">Download optimized 9:16 for TikTok/Reels/Shorts or post direct to your accounts. Ready to share in under 5 minutes.</p>
            </div>
            {/* Mockup: export */}
            <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden shadow-lg">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 bg-card/80">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="text-[10px] text-muted-foreground/50 ml-2">Export — Viral Animal</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">clip_xqc_viral_87.mp4</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Ready</span>
                </div>
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { platform: 'TikTok', color: 'border-foreground/20 text-foreground/70' },
                    { platform: 'Reels', color: 'border-pink-500/30 text-pink-400' },
                    { platform: 'Shorts', color: 'border-red-500/30 text-red-400' },
                  ].map((p) => (
                    <div key={p.platform} className={cn('text-center py-2 rounded-lg border text-[10px] font-medium', p.color)}>
                      {p.platform}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-medium text-center">
                    Download MP4
                  </div>
                  <div className="flex-1 py-1.5 rounded-lg border border-border/30 text-[10px] font-medium text-center text-muted-foreground">
                    Share
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mid-page CTA */}
        <div className="text-center mt-16 pt-10 border-t border-border/20">
          <p className="text-muted-foreground mb-4">Ready to drop your first split-screen clip?</p>
          <Link href="/signup">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 h-11 px-8 font-semibold gap-2">
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground/50 mt-3">3 free clips/month &middot; No card required</p>
        </div>
      </div>
    </section>
  )
}
