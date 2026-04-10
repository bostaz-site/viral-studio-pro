"use client"

import { Suspense } from 'react'
import { Download, Loader2 } from 'lucide-react'
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
        <div className="flex items-center justify-center h-[60vh] gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      }
    >
      <PublishPageInner />
    </Suspense>
  )
}
