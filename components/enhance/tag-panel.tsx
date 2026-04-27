'use client'

import { forwardRef } from 'react'
import { AtSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { TAG_STYLES, type EnhanceSettings, type ScoredOption } from '@/lib/enhance/scoring'
import { MOOD_PRESETS, type ClipMood } from '@/lib/ai/mood-presets'
import { ScoreBadge } from '@/components/enhance/live-preview'

interface TagPanelProps {
  settings: EnhanceSettings
  updateSetting: <K extends keyof EnhanceSettings>(key: K, value: EnhanceSettings[K]) => void
  scores: { tagScores: ScoredOption[]; best: { tagStyle: string } } | null
  selectedMood?: ClipMood | null
  baselineScore?: number
  hasMoodActive?: boolean
  analysisComplete?: boolean
  moodAiDetected?: boolean
  /** When true, renders only the inner content without the Card wrapper */
  noCard?: boolean
}

/**
 * "Tag du streamer" panel — lets the user pick a tag style and size.
 * Extracted from the enhance page to keep that file under control.
 */
export const TagPanel = forwardRef<HTMLDivElement, TagPanelProps>(function TagPanel(
  { settings, updateSetting, scores, selectedMood, baselineScore = 30, hasMoodActive = false, analysisComplete = false, moodAiDetected = false, noCard = false },
  ref,
) {
  // Compute real impact for tag options (diminishing returns)
  const getTagImpact = (tagId: string): { impact: number; isMoodPick: boolean } => {
    const headroom = Math.max(0, 99 - baselineScore)
    if (tagId === 'none') {
      if (selectedMood) {
        const preset = MOOD_PRESETS[selectedMood]
        if (preset.tagStyle === 'none') return { impact: 0, isMoodPick: true }
      }
      return { impact: 0, isMoodPick: false }
    }
    let weight = 0.08
    let isMoodPick = false
    if (selectedMood) {
      const preset = MOOD_PRESETS[selectedMood]
      if (tagId === preset.tagStyle) isMoodPick = true
    } else if (scores && tagId === scores.best.tagStyle) {
      weight += 0.02
    }
    const impact = Math.round(headroom * weight * 10) / 10
    return { impact, isMoodPick }
  }

  const tagContent = scores ? (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Tag style
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {TAG_STYLES.map((tag) => {
            const { impact, isMoodPick } = getTagImpact(tag.id)
            const isHighlight = hasMoodActive && (isMoodPick || (!selectedMood && tag.id === scores.best.tagStyle))
            return (
              <button
                key={tag.id}
                onClick={() => updateSetting('tagStyle', tag.id)}
                className={cn(
                  'relative rounded-xl border p-3 text-left transition-all group',
                  settings.tagStyle === tag.id
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                    : isMoodPick && hasMoodActive
                    ? 'border-green-500/40 bg-green-500/5 hover:bg-green-500/10'
                    : isHighlight
                    ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{tag.icon}</span>
                  <span
                    className={cn(
                      'text-xs font-semibold flex-1',
                      hasMoodActive && isMoodPick ? 'text-green-400' : hasMoodActive && isHighlight ? 'text-orange-400' : 'text-foreground',
                    )}
                  >
                    {tag.label}
                    {analysisComplete && moodAiDetected && settings.tagStyle === tag.id && tag.id !== 'none' && (
                      <span className="ml-1 text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full border border-emerald-400/20">AI</span>
                    )}
                  </span>
                  {hasMoodActive && <ScoreBadge score={impact} isBest={isHighlight} isMoodPick={isMoodPick} />}
                </div>
                <span className="text-[10px] text-muted-foreground pl-7">
                  {tag.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Taille du tag — slider 50-150% */}
      {settings.tagStyle !== 'none' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Tag size
            </Label>
            <span className="text-xs font-mono text-muted-foreground">
              {settings.tagSize || 100}%
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={150}
            step={5}
            value={settings.tagSize || 100}
            onChange={(e) => updateSetting('tagSize', Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>50%</span>
            <span>100%</span>
            <span>150%</span>
          </div>
        </div>
      )}
    </div>
  ) : null

  if (noCard) {
    return <div ref={ref}>{tagContent}</div>
  }

  return (
    <div ref={ref} className="scroll-mt-32">
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AtSign className="h-4 w-4 text-primary" />
            Streamer tag
          </CardTitle>
        </CardHeader>
        {tagContent && <CardContent>{tagContent}</CardContent>}
      </Card>
    </div>
  )
})
