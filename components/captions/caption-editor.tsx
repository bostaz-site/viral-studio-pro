"use client"

import { useState, useRef, useEffect } from 'react'
import { Palette, AlignCenter, AlignLeft, AlignRight, Type, Edit3, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TEMPLATE_LIST, type CaptionStyle } from '@/components/captions/caption-templates'

export interface CaptionConfig {
  templateId: string
  textColor: string
  position: 'top' | 'middle' | 'bottom'
  wordsPerLine: number
}

export interface SubtitleSegment {
  id: string
  start: number
  end: number
  text: string
}

interface CaptionEditorProps {
  sampleText?: string
  segments?: SubtitleSegment[]
  currentTime?: number
  onConfigChange?: (config: CaptionConfig) => void
  onApply?: (config: CaptionConfig) => void
  onSegmentEdit?: (segment: SubtitleSegment) => void
}

function CaptionPreview({
  style,
  textColor,
  position,
  words,
  currentTime,
}: {
  style: CaptionStyle
  textColor: string
  position: 'top' | 'middle' | 'bottom'
  words?: { word: string; start: number; end: number }[]
  currentTime?: number
}) {
  const [animIndex, setAnimIndex] = useState(0)
  const demoWords = ['La', 'vérité', 'sur', 'les', 'réseaux', 'sociaux']

  // Karaoke animation loop for demo mode
  useEffect(() => {
    if (words && currentTime !== undefined) return // Skip demo if real data
    const interval = setInterval(() => {
      setAnimIndex((prev) => (prev + 1) % demoWords.length)
    }, 400)
    return () => clearInterval(interval)
  }, [words, currentTime, demoWords.length])

  // Determine which word is active
  const getActiveIndex = () => {
    if (words && currentTime !== undefined) {
      return words.findIndex((w) => currentTime >= w.start && currentTime < w.end)
    }
    return animIndex
  }

  const activeIdx = getActiveIndex()
  const displayWords = words ? words.map((w) => w.word) : demoWords

  const posClass =
    position === 'top'
      ? 'top-4'
      : position === 'middle'
      ? 'top-1/2 -translate-y-1/2'
      : 'bottom-4'

  return (
    <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl aspect-[9/16] max-h-52 overflow-hidden flex items-center justify-center">
      {/* Fake video background */}
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-800 via-slate-900 to-black" />

      <div className={cn('absolute left-0 right-0 text-center px-3', posClass)}>
        <span style={{ ...style.previewStyle, color: textColor } as React.CSSProperties}>
          {displayWords.map((word, i) => (
            <span
              key={i}
              style={
                i === activeIdx
                  ? { ...(style.activeWordStyle as React.CSSProperties), transition: 'all 0.15s ease-out', transform: 'scale(1.1)', display: 'inline-block' }
                  : { transition: 'all 0.15s ease-out' }
              }
              className="transition-all duration-150"
            >
              {word}
              {i < displayWords.length - 1 ? ' ' : ''}
            </span>
          ))}
        </span>
      </div>

      {/* Karaoke indicator */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
        {displayWords.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 rounded-full transition-all duration-300',
              i === activeIdx ? 'w-4 bg-primary' : i < activeIdx ? 'w-2 bg-primary/40' : 'w-2 bg-white/20'
            )}
          />
        ))}
      </div>
    </div>
  )
}

function SegmentRow({
  segment,
  isActive,
  onEdit,
}: {
  segment: SubtitleSegment
  isActive: boolean
  onEdit: (seg: SubtitleSegment) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(segment.text)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const handleSave = () => {
    onEdit({ ...segment, text: draft })
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(segment.text)
    setEditing(false)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm',
        isActive
          ? 'border-primary/50 bg-primary/10'
          : 'border-border bg-muted/20 hover:border-border/80'
      )}
    >
      <span className="shrink-0 text-xs text-muted-foreground font-mono w-16">
        {formatTime(segment.start)}
      </span>
      {editing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
            className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-sm focus:outline-none focus:border-primary"
          />
          <button onClick={handleSave} className="shrink-0 text-green-400 hover:text-green-300">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={handleCancel} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 truncate text-foreground">{segment.text}</span>
          <button
            onClick={() => { setDraft(segment.text); setEditing(true) }}
            className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  )
}

export function CaptionEditor({ onConfigChange, onApply, segments, currentTime, onSegmentEdit }: CaptionEditorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('default')
  const [textColor, setTextColor] = useState('#ffffff')
  const [position, setPosition] = useState<'top' | 'middle' | 'bottom'>('bottom')
  const [wordsPerLine, setWordsPerLine] = useState(6)
  const [editedSegments, setEditedSegments] = useState<SubtitleSegment[]>(segments ?? [])
  const activeSegRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setEditedSegments(segments ?? [])
  }, [segments])

  const activeSegmentId = currentTime !== undefined
    ? editedSegments.find((s) => currentTime >= s.start && currentTime < s.end)?.id
    : undefined

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegRef.current) {
      activeSegRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeSegmentId])

  const handleSegmentEdit = (updated: SubtitleSegment) => {
    setEditedSegments((prev) => prev.map((s) => s.id === updated.id ? updated : s))
    onSegmentEdit?.(updated)
  }

  const currentStyle = TEMPLATE_LIST.find((t) => t.id === selectedTemplate) ?? TEMPLATE_LIST[0]

  const getConfig = (): CaptionConfig => ({
    templateId: selectedTemplate,
    textColor,
    position,
    wordsPerLine,
  })

  const handleChange = (partial: Partial<CaptionConfig>) => {
    const updated: CaptionConfig = { ...getConfig(), ...partial }
    if (partial.templateId !== undefined) setSelectedTemplate(partial.templateId)
    if (partial.textColor !== undefined) setTextColor(partial.textColor)
    if (partial.position !== undefined) setPosition(partial.position)
    if (partial.wordsPerLine !== undefined) setWordsPerLine(partial.wordsPerLine)
    onConfigChange?.(updated)
  }

  return (
    <div className={cn('gap-6', editedSegments.length > 0 ? 'grid md:grid-cols-3' : 'grid md:grid-cols-2')}>
      {/* Preview */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Type className="h-4 w-4 text-muted-foreground" />
          Aperçu
        </p>
        <CaptionPreview style={currentStyle} textColor={textColor} position={position} words={undefined} currentTime={currentTime} />
      </div>

      {/* Controls */}
      <div className="space-y-5">
        {/* Template selector */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Style</p>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATE_LIST.map((t) => (
              <button
                key={t.id}
                onClick={() => handleChange({ templateId: t.id })}
                className={cn(
                  'py-2 px-3 rounded-lg text-xs font-medium border transition-all',
                  selectedTemplate === t.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Couleur du texte
          </p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={textColor}
              onChange={(e) => handleChange({ textColor: e.target.value })}
              className="h-9 w-16 rounded-lg border border-border bg-transparent cursor-pointer"
            />
            <span className="text-sm text-muted-foreground font-mono">{textColor}</span>
            <div className="flex gap-1 ml-auto">
              {['#ffffff', '#fbbf24', '#00ff88', '#93c5fd', '#f97316'].map((c) => (
                <button
                  key={c}
                  onClick={() => handleChange({ textColor: c })}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: textColor === c ? 'white' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Position */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Position</p>
          <div className="flex gap-2">
            {(
              [
                { value: 'top', icon: AlignLeft, label: 'Haut' },
                { value: 'middle', icon: AlignCenter, label: 'Milieu' },
                { value: 'bottom', icon: AlignRight, label: 'Bas' },
              ] as const
            ).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => handleChange({ position: value })}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all',
                  position === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Words per line */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Mots par ligne : <span className="text-primary">{wordsPerLine}</span>
          </p>
          <input
            type="range"
            min={3}
            max={8}
            value={wordsPerLine}
            onChange={(e) => handleChange({ wordsPerLine: Number(e.target.value) })}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>3 (court)</span>
            <span>8 (long)</span>
          </div>
        </div>

        {/* Apply button */}
        <Card className="bg-muted/30 border-border">
          <CardContent className="p-3 flex items-start gap-2">
            <p className="text-xs text-muted-foreground flex-1">
              Les sous-titres karaoké s&apos;animent mot par mot lors du rendu. Choisissez un style ci-dessus pour voir l&apos;aperçu en temps réel.
            </p>
          </CardContent>
        </Card>

        <Button
          className="w-full"
          onClick={() => onApply?.(getConfig())}
        >
          Appliquer ce style
        </Button>
      </div>

      {/* Segment editor (only shown when segments provided) */}
      {editedSegments.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-muted-foreground" />
            Sous-titres ({editedSegments.length})
          </p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 group">
            {editedSegments.map((seg) => (
              <div key={seg.id} ref={seg.id === activeSegmentId ? activeSegRef : undefined}>
                <SegmentRow
                  segment={seg}
                  isActive={seg.id === activeSegmentId}
                  onEdit={handleSegmentEdit}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Cliquez sur l&apos;icône crayon pour éditer un segment. Entrée pour sauvegarder, Échap pour annuler.
          </p>
        </div>
      )}
    </div>
  )
}
