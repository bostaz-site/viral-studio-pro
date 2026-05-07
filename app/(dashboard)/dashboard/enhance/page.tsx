"use client"

import Link from 'next/link'
import { Wand2, Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'

export default function EnhanceLandingPage() {
  return (
    <>
      {/* Unified header — same pattern as Browse / Distribution / Analytics / Settings */}
      <PageHeader
        icon={Wand2}
        title="Enhance"
        subtitle="Edit smart, render once. AI does the heavy lifting."
        accent="cyan"
      />

      {/* Empty-state CTA — centered focal point telling the user what to do next */}
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-6 animate-in fade-in duration-500">
        {/* Big cyan Wand2 card */}
        <div className="relative w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shadow-[0_0_28px_rgba(34,211,238,0.18)]">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-transparent" />
          <Wand2 className="h-10 w-10 text-cyan-400 relative z-10" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Pick a clip to enhance</h2>
          <p className="text-muted-foreground mt-2 max-w-md">
            Browse trending clips or upload your own, then boost virality with karaoke captions,
            split-screen, hooks and more — all in one click.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-600 hover:to-sky-600 text-white font-bold shadow-lg shadow-cyan-500/25 h-11 px-5">
              <Sparkles className="h-4 w-4" />
              Browse clips
            </Button>
          </Link>
          <Link href="/dashboard?tab=upload">
            <Button variant="outline" className="gap-2 text-zinc-400 hover:text-white h-11 px-5">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </Link>
        </div>
      </div>
    </>
  )
}
