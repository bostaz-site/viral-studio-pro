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
        <h1 className="text-2xl font-bold tracking-tight">Enhance un clip</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Choisis d&apos;abord un clip trending depuis le feed, puis personnalise-le ici avec des sous-titres karaok&eacute;, du split-screen et plus.
        </p>
      </div>
      <Link href="/dashboard">
        <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
          <Sparkles className="h-4 w-4" />
          Parcourir les clips trending
        </Button>
      </Link>
    </div>
  )
}
