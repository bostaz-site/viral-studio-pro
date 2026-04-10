"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Download,
  Copy,
  Check,
  Sparkles,
  Loader2,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  FileVideo,
  Clock,
  ArrowRight,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Clip {
  id: string
  title: string | null
  duration_seconds: number | null
  transcript_segment: string | null
  status: string | null
}

interface PlatformCaption {
  caption: string
  hashtags: string[]
}

type Platform = 'tiktok' | 'instagram' | 'youtube'

const PLATFORMS: { id: Platform; label: string; color: string; borderColor: string }[] = [
  { id: 'tiktok', label: 'TikTok', color: 'text-pink-400', borderColor: 'border-pink-500/40 bg-pink-500/5' },
  { id: 'instagram', label: 'Instagram Reels', color: 'text-purple-400', borderColor: 'border-purple-500/40 bg-purple-500/5' },
  { id: 'youtube', label: 'YouTube Shorts', color: 'text-red-400', borderColor: 'border-red-500/40 bg-red-500/5' },
]

export function ExportPanel() {
  const [clips, setClips] = useState<Clip[]>([])
  const [selectedClipId, setSelectedClipId] = useState('')
  const [showClipSelect, setShowClipSelect] = useState(false)
  const [loadingClips, setLoadingClips] = useState(true)

  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set(['tiktok', 'instagram', 'youtube']))
  const [captions, setCaptions] = useState<Partial<Record<Platform, PlatformCaption>>>({})
  const [generatingCaptions, setGeneratingCaptions] = useState(false)

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [loadingExport, setLoadingExport] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null)

  // Load clips
  useEffect(() => {
    fetch('/api/clips')
      .then((r) => r.json())
      .then((res: { data: Clip[] }) => {
        const done = (res.data ?? []).filter((c) => c.status === 'done')
        setClips(done)
        setLoadingClips(false)
      })
      .catch(() => setLoadingClips(false))
  }, [])

  const selectedClip = clips.find((c) => c.id === selectedClipId)

  const handleSelectClip = (clip: Clip) => {
    setSelectedClipId(clip.id)
    setShowClipSelect(false)
    setCaptions({})
    setDownloadUrl(null)
    setExportError(null)
  }

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  // Generate captions via Claude
  const handleGenerateCaptions = async () => {
    if (!selectedClipId) return
    setGeneratingCaptions(true)
    try {
      const res = await fetch('/api/publish/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id: selectedClipId }),
      })
      const json = await res.json() as {
        data: Record<Platform, PlatformCaption> | null
        message: string
      }
      if (json.data) setCaptions(json.data)
    } catch {
      // silent
    } finally {
      setGeneratingCaptions(false)
    }
  }

  // Get download URL
  const handleExport = async () => {
    if (!selectedClipId) return
    setLoadingExport(true)
    setExportError(null)

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id: selectedClipId }),
      })
      const json = await res.json() as {
        data: { download_url: string | null; status: string } | null
        error: string | null
        message: string
      }

      if (json.data?.download_url) {
        setDownloadUrl(json.data.download_url)
      } else if (json.data?.status !== 'done') {
        setExportError('Le clip est encore en cours de rendu. Réessayez dans quelques instants.')
      } else {
        setExportError(json.message ?? 'Impossible de générer le lien de téléchargement')
      }
    } catch {
      setExportError('Erreur réseau')
    } finally {
      setLoadingExport(false)
    }
  }

  // Copy caption + hashtags to clipboard
  const handleCopy = async (platform: Platform) => {
    const c = captions[platform]
    if (!c) return

    const text = `${c.caption}\n\n${c.hashtags.map((h) => `#${h}`).join(' ')}`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedPlatform(platform)
      setTimeout(() => setCopiedPlatform(null), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Select Clip */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">1. Choisir un clip à exporter</Label>
        {loadingClips ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : clips.length === 0 ? (
          <Card className="border-dashed border-2 border-border/60 bg-card/30">
            <CardContent className="p-10 text-center space-y-5">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                  <FileVideo className="h-8 w-8 text-orange-400/80" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-foreground">Aucun clip rendu pour l&apos;instant</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Choisis un clip dans la bibliothèque, clique sur <span className="text-orange-400 font-semibold">&laquo;&nbsp;Make it viral&nbsp;&raquo;</span>, puis reviens ici pour le télécharger.
                </p>
              </div>
              <Link href="/dashboard">
                <Button className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold h-11 px-6">
                  <Wand2 className="h-4 w-4" />
                  Parcourir la bibliothèque
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowClipSelect((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-input bg-background text-sm hover:bg-accent/50 transition-colors"
            >
              <span className={selectedClip ? 'text-foreground' : 'text-muted-foreground'}>
                {selectedClip
                  ? `${selectedClip.title ?? `Clip ${selectedClip.id.slice(0, 8)}`} (${Math.round(selectedClip.duration_seconds ?? 0)}s)`
                  : 'Choisir un clip…'}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {showClipSelect && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-xl max-h-60 overflow-y-auto">
                {clips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectClip(c)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 text-sm hover:bg-accent/50 flex items-center justify-between',
                      c.id === selectedClipId && 'bg-primary/5'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <FileVideo className="h-3.5 w-3.5 text-muted-foreground" />
                      {c.title ?? `Clip ${c.id.slice(0, 8)}`}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {Math.round(c.duration_seconds ?? 0)}s
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Select Platforms (for captions) */}
      {selectedClipId && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">2. Plateformes cibles (pour les captions)</Label>
          <div className="flex gap-2 flex-wrap">
            {PLATFORMS.map((p) => {
              const isSelected = selectedPlatforms.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium border transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 3: Generate Captions */}
      {selectedClipId && selectedPlatforms.size > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">3. Captions + Hashtags</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateCaptions}
              disabled={generatingCaptions}
              className="gap-2"
            >
              {generatingCaptions ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              )}
              Générer avec Claude
            </Button>
          </div>

          {Array.from(selectedPlatforms).map((platformId) => {
            const platform = PLATFORMS.find((p) => p.id === platformId)
            if (!platform) return null
            const cap = captions[platformId]

            return (
              <Card key={platformId} className={cn('border', platform.borderColor)}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={cn('text-sm font-semibold', platform.color)}>
                      {platform.label}
                    </span>
                    {cap && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => handleCopy(platformId)}
                      >
                        {copiedPlatform === platformId ? (
                          <><Check className="h-3 w-3 text-green-400" /> Copié !</>
                        ) : (
                          <><Copy className="h-3 w-3" /> Copier tout</>
                        )}
                      </Button>
                    )}
                  </div>

                  <Textarea
                    rows={3}
                    placeholder={`Caption pour ${platform.label}…`}
                    value={cap?.caption ?? ''}
                    onChange={(e) =>
                      setCaptions((prev) => ({
                        ...prev,
                        [platformId]: { ...(prev[platformId] ?? { hashtags: [] }), caption: e.target.value },
                      }))
                    }
                    className="text-sm resize-none"
                  />

                  {cap && cap.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cap.hashtags.map((h) => (
                        <Badge key={h} variant="secondary" className="text-xs">
                          #{h}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Step 4: Download */}
      {selectedClipId && (
        <div className="space-y-3">
          <Label className="text-sm font-semibold">4. Télécharger la vidéo</Label>

          {exportError && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {exportError}
            </div>
          )}

          {downloadUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                <p className="text-sm text-green-400">Lien de téléchargement prêt (valide 1h)</p>
              </div>
              <a href={downloadUrl} download="viral-clip.mp4" className="block">
                <Button className="w-full gap-2 h-14 text-base font-bold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25 animate-pulse">
                  <Download className="h-5 w-5" />
                  Télécharger le clip (.mp4)
                </Button>
              </a>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2 h-11"
              onClick={handleExport}
              disabled={loadingExport}
            >
              {loadingExport ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Préparer le téléchargement
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Téléchargez la vidéo puis postez-la manuellement sur vos réseaux avec les captions générées ci-dessus.
          </p>
        </div>
      )}
    </div>
  )
}
