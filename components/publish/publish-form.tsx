"use client"

import { useState, useEffect } from 'react'
import {
  Loader2,
  Sparkles,
  Send,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Clip {
  id: string
  title: string | null
  duration_seconds: number | null
  transcript_segment: string | null
}

interface PlatformCaption {
  caption: string
  hashtags: string[]
}

interface SocialAccount {
  id: string
  platform: string
  username: string | null
}

type Platform = 'tiktok' | 'instagram' | 'youtube'

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
}

const PLATFORM_COLORS: Record<Platform, string> = {
  tiktok: 'border-pink-500/40 bg-pink-500/5',
  instagram: 'border-fuchsia-500/40 bg-fuchsia-500/5',
  youtube: 'border-red-500/40 bg-red-500/5',
}

interface Props {
  accounts: SocialAccount[]
  onPublished?: () => void
}

export function PublishForm({ accounts, onPublished }: Props) {
  const [clips, setClips] = useState<Clip[]>([])
  const [selectedClipId, setSelectedClipId] = useState<string>('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set())
  const [captions, setCaptions] = useState<Partial<Record<Platform, PlatformCaption>>>({})
  const [scheduledAt, setScheduledAt] = useState<string>('')
  const [loadingClips, setLoadingClips] = useState(true)
  const [generatingCaptions, setGeneratingCaptions] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showClipSelect, setShowClipSelect] = useState(false)

  const connectedPlatforms = new Set(accounts.map((a) => a.platform as Platform))

  useEffect(() => {
    fetch('/api/clips')
      .then((r) => r.json())
      .then((res: { data: Clip[] }) => {
        setClips(res.data ?? [])
        setLoadingClips(false)
      })
      .catch(() => setLoadingClips(false))
  }, [])

  const selectedClip = clips.find((c) => c.id === selectedClipId)

  const handleSelectClip = (clip: Clip) => {
    setSelectedClipId(clip.id)
    setShowClipSelect(false)
    setCaptions({})
    setResult(null)
  }

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const handleGenerateCaptions = async () => {
    if (!selectedClipId) return
    setGeneratingCaptions(true)
    setResult(null)
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
      setResult({ ok: false, message: 'Erreur lors de la génération des captions' })
    } finally {
      setGeneratingCaptions(false)
    }
  }

  const buildPayload = () => ({
    clip_id: selectedClipId,
    platforms: Array.from(selectedPlatforms),
    captions: Object.fromEntries(
      Array.from(selectedPlatforms)
        .filter((p) => captions[p])
        .map((p) => [p, captions[p]!])
    ) as Record<Platform, PlatformCaption>,
  })

  const handlePublish = async () => {
    if (!selectedClipId || selectedPlatforms.size === 0) return
    setPublishing(true)
    setResult(null)
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      const json = await res.json() as { error: string | null; message: string }
      setResult({ ok: !json.error, message: json.message })
      if (!json.error) onPublished?.()
    } catch {
      setResult({ ok: false, message: 'Erreur de réseau' })
    } finally {
      setPublishing(false)
    }
  }

  const handleSchedule = async () => {
    if (!selectedClipId || selectedPlatforms.size === 0 || !scheduledAt) return
    setScheduling(true)
    setResult(null)
    try {
      const res = await fetch('/api/publish/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildPayload(), scheduled_at: new Date(scheduledAt).toISOString() }),
      })
      const json = await res.json() as { error: string | null; message: string }
      setResult({ ok: !json.error, message: json.message })
      if (!json.error) onPublished?.()
    } catch {
      setResult({ ok: false, message: 'Erreur de réseau' })
    } finally {
      setScheduling(false)
    }
  }

  const canPublish = selectedClipId && selectedPlatforms.size > 0

  return (
    <div className="space-y-6">
      {/* Step 1: Select Clip */}
      <div className="space-y-2">
        <Label>1. Sélectionner un clip</Label>
        {loadingClips ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowClipSelect((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-input bg-background text-sm hover:bg-accent/50 transition-colors"
            >
              <span className={selectedClip ? 'text-foreground' : 'text-muted-foreground'}>
                {selectedClip
                  ? selectedClip.title ?? `Clip ${selectedClip.id.slice(0, 8)}`
                  : 'Choisir un clip…'}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {showClipSelect && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-60 overflow-y-auto">
                {clips.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Aucun clip disponible</p>
                ) : (
                  clips.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectClip(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 flex items-center justify-between"
                    >
                      <span>{c.title ?? `Clip ${c.id.slice(0, 8)}`}</span>
                      {c.duration_seconds && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(c.duration_seconds)}s
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Select Platforms */}
      <div className="space-y-2">
        <Label>2. Plateformes de destination</Label>
        <div className="flex gap-3 flex-wrap">
          {(['tiktok', 'instagram', 'youtube'] as Platform[]).map((p) => {
            const isConnected = connectedPlatforms.has(p)
            const isSelected = selectedPlatforms.has(p)
            return (
              <button
                key={p}
                type="button"
                disabled={!isConnected}
                onClick={() => togglePlatform(p)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  !isConnected
                    ? 'opacity-40 cursor-not-allowed border-border'
                    : isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {PLATFORM_LABELS[p]}
                {!isConnected && <span className="ml-1 text-xs">(non connecté)</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Step 3: Captions */}
      {selectedClipId && selectedPlatforms.size > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>3. Captions par plateforme</Label>
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

          {Array.from(selectedPlatforms).map((p) => {
            const copy = captions[p]
            return (
              <Card key={p} className={`border ${PLATFORM_COLORS[p]}`}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm">{PLATFORM_LABELS[p]}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <Textarea
                    rows={3}
                    placeholder={`Caption ${PLATFORM_LABELS[p]}…`}
                    value={copy?.caption ?? ''}
                    onChange={(e) =>
                      setCaptions((prev) => ({
                        ...prev,
                        [p]: { ...(prev[p] ?? { hashtags: [] }), caption: e.target.value },
                      }))
                    }
                    className="text-sm resize-none"
                  />
                  <div className="flex flex-wrap gap-1">
                    {(copy?.hashtags ?? []).slice(0, 10).map((h) => (
                      <Badge key={h} variant="secondary" className="text-xs">
                        #{h}
                      </Badge>
                    ))}
                    {(copy?.hashtags.length ?? 0) > 10 && (
                      <Badge variant="secondary" className="text-xs">
                        +{(copy?.hashtags.length ?? 0) - 10}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Step 4: Schedule */}
      <div className="space-y-2">
        <Label htmlFor="scheduled_at">4. Date de publication (optionnel)</Label>
        <input
          id="scheduled_at"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground"
        />
      </div>

      {/* Result notice */}
      {result && (
        <div
          className={`flex items-center gap-2 p-3 rounded-md border text-sm ${
            result.ok
              ? 'border-green-500/30 bg-green-500/5 text-green-400'
              : 'border-red-500/30 bg-red-500/5 text-red-400'
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {result.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          className="flex-1 gap-2"
          disabled={!canPublish || publishing || scheduling}
          onClick={handlePublish}
        >
          {publishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Publier maintenant
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2"
          disabled={!canPublish || !scheduledAt || publishing || scheduling}
          onClick={handleSchedule}
        >
          {scheduling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarClock className="h-4 w-4" />
          )}
          Planifier
        </Button>
      </div>
    </div>
  )
}
