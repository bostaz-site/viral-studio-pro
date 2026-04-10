'use client'

import { forwardRef } from 'react'
import { Paintbrush } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { EnhanceSettings } from '@/lib/enhance/scoring'

interface FormatPanelProps {
  settings: EnhanceSettings
  updateSetting: <K extends keyof EnhanceSettings>(key: K, value: EnhanceSettings[K]) => void
}

const RATIOS: Array<{ id: EnhanceSettings['aspectRatio']; label: string }> = [
  { id: '9:16', label: 'TikTok / Reels' },
  { id: '1:1', label: 'Instagram' },
  { id: '16:9', label: 'YouTube' },
]

/**
 * "Format" panel — aspect ratio picker (9:16 / 1:1 / 16:9).
 * Extracted from the enhance page.
 */
export const FormatPanel = forwardRef<HTMLDivElement, FormatPanelProps>(function FormatPanel(
  { settings, updateSetting },
  ref,
) {
  return (
    <div ref={ref} className="scroll-mt-32">
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Paintbrush className="h-4 w-4 text-primary" />
            Format
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {RATIOS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => updateSetting('aspectRatio', id)}
                className={cn(
                  'rounded-xl border p-3 text-center transition-all',
                  settings.aspectRatio === id
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <span className="text-sm font-semibold text-foreground">{id}</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
