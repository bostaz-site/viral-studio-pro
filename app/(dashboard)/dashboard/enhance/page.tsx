"use client"

import Link from 'next/link'
import { Wand2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function EnhanceLandingPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Wand2 className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Enhance a clip</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Pick a trending clip or upload your own, then boost its virality with karaoke captions, split-screen, hooks and more.
        </p>
      </div>
      <Link href="/dashboard">
        <Button className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold shadow-lg shadow-orange-500/25">
          <Sparkles className="h-4 w-4" />
          Browse clips
        </Button>
      </Link>
    </div>
  )
}
