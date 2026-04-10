"use client"

import { Suspense } from 'react'
import { Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ExportPanel } from '@/components/publish/export-panel'

// ── Inner page ─────────────────────────────────────────────────────────────

function PublishPageInner() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-xl ring-1 ring-border">
          <Download className="h-8 w-8 text-orange-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exporter un clip</h1>
          <p className="text-muted-foreground mt-0.5">
            Télécharge ta vidéo finale en 9:16, prête à poster sur TikTok, Reels ou Shorts.
          </p>
        </div>
      </div>

      {/* Export content */}
      <Card className="bg-card/50 border-border">
        <CardContent className="p-6">
          <ExportPanel />
        </CardContent>
      </Card>
    </div>
  )
}

// ── Export wrapped in Suspense ─────────────────────────────────────────────

export default function PublishPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8 max-w-3xl animate-in fade-in duration-300">
          {/* Header skeleton */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-muted/40 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-7 w-1/2 rounded bg-muted/40 animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-muted/30 animate-pulse" />
            </div>
          </div>
          {/* Body skeleton */}
          <div className="rounded-xl border border-border bg-card/50 p-6 space-y-4 animate-pulse">
            <div className="aspect-[9/16] max-w-xs mx-auto rounded-lg bg-muted/40" />
            <div className="space-y-2">
              <div className="h-4 w-1/3 rounded bg-muted/40" />
              <div className="h-10 rounded-md bg-muted/30" />
            </div>
            <div className="h-11 rounded-md bg-muted/40" />
          </div>
        </div>
      }
    >
      <PublishPageInner />
    </Suspense>
  )
}
