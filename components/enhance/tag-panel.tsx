'use client'

import { forwardRef } from 'react'
import { AtSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { TAG_STYLES, type EnhanceSettings, type ScoredOption } from '@/lib/enhance/scoring'
import { ScoreBadge } from '@/components/enhance/live-preview'

interface TagPanelProps {
  settings: EnhanceSettings
  updateSetting: <K extends keyof EnhanceSettings>(key: K, value: EnhanceSettings[K]) => void
  scores: { tagScores: ScoredOption[] } | null
}

/**
 * "Tag du streamer" panel — lets the user pick a tag style and size.
 * Extracted from the enhance page to keep that file under control.
 */
export const TagPanel = forwardRef<HTMLDivElement, TagPanelProps>(function TagPanel(
  { settings, updateSetting, scores },
  ref,
) {
  return (
    <div ref={ref} className="scroll-mt-32">
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AtSign className="h-4 w-4 text-primary" />
            Streamer tag
          </CardTitle>
        </CardHeader>
        {scores && (
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Tag style
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {TAG_STYLES.map((tag) => {
                  const scored = scores.tagScores.find((s) => s.id === tag.id)!
                  return (
                    <button
                      key={tag.id}
                      onClick={() => updateSetting('tagStyle', tag.id)}
                      className={cn(
                        'relative rounded-xl border p-3 text-left transition-all group',
                        settings.tagStyle === tag.id
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : scored.isBest
                          ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                          : 'border-border hover:border-primary/40',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{tag.icon}</span>
                        <span
                          className={cn(
                            'text-xs font-semibold flex-1',
                            scored.isBest ? 'text-orange-400' : 'text-foreground',
                          )}
                        >
                          {tag.label}
                        </span>
                        <ScoreBadge score={scored.score} isBest={scored.isBest} />
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
          </CardContent>
        )}
      </Card>
    </div>
  )
})
