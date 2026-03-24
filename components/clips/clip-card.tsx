"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Download, Wand2, Clock, Play, CheckSquare, Square, ChevronDown, Film, Loader2, CheckCircle2, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { GeneratedClip } from '@/stores/clips-store'
import { RemakeModal } from '@/components/clips/remake-modal'
import type { AspectRatio } from '@/lib/ffmpeg/reframe'

interface ClipCardProps {
  clip: GeneratedClip
  onDownload?: (clip: GeneratedClip, format: AspectRatio) => void
  onRemake?: (clip: GeneratedClip) => void
  /** Preview clip in the video player */
  onPreview?: (clip: GeneratedClip) => void
  /** Batch selection mode */
  batchMode?: boolean
  selected?: boolean
  onSelect?: (id: string, selected: boolean) => void
}

const FORMAT_OPTIONS: { value: AspectRatio; label: string; platforms: string }[] = [
  { value: '9:16', label: 'Vertical 9:16', platforms: 'TikTok · Reels · Shorts' },
  { value: '1:1',  label: 'Carré 1:1',     platforms: 'Instagram · Twitter' },
  { value: '16:9', label: 'Horizontal 16:9', platforms: 'YouTube · LinkedIn' },
]

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getScoreColor(score: number | null): {
  bg: string; text: string; border: string; label: string
} {
  if (!score) return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', label: '--' }
  if (score >= 70) return { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30', label: String(score) }
  if (score >= 40) return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30', label: String(score) }
  return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', label: String(score) }
}

const HOOK_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  curiosity:      { bg: 'bg-blue-500/15',   text: 'text-blue-400' },
  shock:          { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  storytelling:   { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  transformation: { bg: 'bg-teal-500/15',   text: 'text-teal-400' },
}

export function ClipCard({ clip, onDownload, onRemake, onPreview, batchMode, selected, onSelect }: ClipCardProps) {
  const [remakeOpen, setRemakeOpen] = useState(false)
  const [formatOpen, setFormatOpen] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<AspectRatio>('9:16')
  const [brollLoading, setBrollLoading] = useState(false)
  const [brollDone, setBrollDone] = useState(false)

  const handleBroll = async () => {
    setBrollLoading(true)
    try {
      await fetch('/api/broll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id: clip.id }),
      })
      setBrollDone(true)
    } finally {
      setBrollLoading(false)
    }
  }

  const viralScore = clip.viral_scores?.[0] ?? null
  const scoreColor = getScoreColor(viralScore?.score ?? null)
  const hookStyle = viralScore?.hook_type
    ? (HOOK_TYPE_STYLES[viralScore.hook_type] ?? { bg: 'bg-muted', text: 'text-muted-foreground' })
    : null
  const canDownload = !!clip.storage_path && clip.status === 'done'

  const handleCardClick = () => {
    if (batchMode) onSelect?.(clip.id, !selected)
  }

  return (
    <Card
      className={cn(
        'bg-card/60 border-border overflow-hidden group hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5',
        batchMode && 'cursor-pointer',
        selected && 'ring-2 ring-primary border-primary/60'
      )}
      onClick={handleCardClick}
    >
      {/* Thumbnail */}
      <div className="aspect-[9/16] max-h-48 bg-gradient-to-br from-blue-900/40 to-indigo-900/40 flex items-center justify-center relative overflow-hidden">
        {clip.thumbnail_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clip.thumbnail_path} alt={clip.title ?? 'Clip'} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
            <Play className="h-8 w-8" />
            <span className="text-xs">{clip.status === 'pending' ? 'En préparation' : 'Aperçu'}</span>
          </div>
        )}

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white flex items-center gap-1 font-medium">
          <Clock className="w-3 h-3" />
          {formatDuration(clip.duration_seconds)}
        </div>

        {/* Score overlay */}
        <div className={cn('absolute top-2 right-2 px-2 py-0.5 rounded-full border text-xs font-bold', scoreColor.bg, scoreColor.text, scoreColor.border)}>
          {scoreColor.label}
        </div>

        {/* Batch selection checkbox */}
        {batchMode && (
          <div className="absolute top-2 left-2">
            {selected
              ? <CheckSquare className="h-5 w-5 text-primary drop-shadow" />
              : <Square className="h-5 w-5 text-white/70 drop-shadow" />
            }
          </div>
        )}

        {/* Preview button (shown on hover, outside batch mode) */}
        {!batchMode && onPreview && (
          <button
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30"
            onClick={(e) => { e.stopPropagation(); onPreview(clip) }}
            title="Prévisualiser dans le player"
          >
            <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <Play className="h-6 w-6 text-white ml-0.5" />
            </div>
          </button>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Title */}
        <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">
          {clip.title ?? `Clip ${formatDuration(clip.start_time)} – ${formatDuration(clip.end_time)}`}
        </p>

        {/* Hook type + score row */}
        <div className="flex items-center gap-2 flex-wrap">
          {hookStyle && viralScore?.hook_type && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', hookStyle.bg, hookStyle.text)}>
              {viralScore.hook_type}
            </span>
          )}
          <span className={cn('text-xs px-2 py-0.5 rounded-full border font-semibold ml-auto', scoreColor.bg, scoreColor.text, scoreColor.border)}>
            Score {scoreColor.label}
          </span>
        </div>

        {/* Explanation */}
        {viralScore?.explanation && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {viralScore.explanation}
          </p>
        )}

        {/* Actions — hidden in batch mode */}
        {!batchMode && (
          <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            {/* Edit button */}
            <Link href={`/create/${clip.id}/edit`} className="flex-1">
              <Button
                size="sm"
                variant="default"
                className="w-full h-8 text-xs gap-1.5"
                disabled={!canDownload}
                title={!canDownload ? 'Clip en cours de traitement' : 'Éditer le clip'}
              >
                <Edit className="h-3.5 w-3.5" />
                Éditer
              </Button>
            </Link>

            {/* Download with format selector */}
            <div className="relative">
              <div className="flex">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs gap-1 rounded-r-none px-2"
                  disabled={!canDownload}
                  onClick={() => onDownload?.(clip, selectedFormat)}
                  title={!canDownload ? 'Clip en cours de traitement' : `Télécharger en ${selectedFormat}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-6 px-0 rounded-l-none border-l border-border/40"
                  disabled={!canDownload}
                  onClick={() => setFormatOpen(!formatOpen)}
                  title="Choisir le format"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>

              {/* Format dropdown */}
              {formatOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-lg shadow-xl z-20 overflow-hidden">
                  {FORMAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors',
                        selectedFormat === opt.value && 'bg-primary/10 text-primary'
                      )}
                      onClick={() => { setSelectedFormat(opt.value); setFormatOpen(false) }}
                    >
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-muted-foreground">{opt.platforms}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1 px-2"
              onClick={() => { onRemake?.(clip); setRemakeOpen(true) }}
              title="Réécrire ce clip avec l'IA"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Remake</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 px-0 border border-border"
              onClick={handleBroll}
              disabled={brollLoading || brollDone}
              title={brollDone ? 'Suggestions B-Roll générées' : 'Analyser les moments B-Roll avec Claude'}
            >
              {brollLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : brollDone
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                : <Film className="h-3.5 w-3.5" />
              }
            </Button>
          </div>
        )}
      </CardContent>

      <RemakeModal clip={clip} open={remakeOpen} onClose={() => setRemakeOpen(false)} />
    </Card>
  )
}
