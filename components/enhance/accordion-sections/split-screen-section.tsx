'use client'

import { cn } from '@/lib/utils'
import { Monitor } from 'lucide-react'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import type { AccordionSectionProps } from '@/components/enhance/enhance-types'
import React from 'react'

interface SplitScreenSectionProps extends Pick<AccordionSectionProps, 'settings' | 'updateSetting' | 'scoreBreakdown' | 'scores'> {
  sectionRef?: React.Ref<HTMLDivElement>
}

export function SplitScreenSection({ settings, updateSetting, scoreBreakdown, scores, sectionRef }: SplitScreenSectionProps) {
  return (
    <AccordionItem value="splitscreen" ref={sectionRef as React.Ref<HTMLDivElement>} className="scroll-mt-32 rounded-xl border border-white/10 bg-card/60 px-4 overflow-hidden">
      <AccordionTrigger className="text-zinc-400 hover:text-white">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Monitor className="h-4 w-4 text-primary" />
          Split-Screen
          <span className="text-xs text-zinc-500 font-normal">
            {settings.splitScreenEnabled
              ? `· Blur fill · ${settings.splitRatio}/${100 - settings.splitRatio}`
              : '· Off'}
          </span>
          {scoreBreakdown.splitScreen > 0 && (
            <span className="ml-auto text-[11px] font-bold text-emerald-400">+{scoreBreakdown.splitScreen} pts</span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {scores && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">Blur fill</Label>
                <p className="text-[10px] text-muted-foreground">Fills vertical space with a blurred version of the clip</p>
              </div>
              <button
                onClick={() => {
                  const next = !settings.splitScreenEnabled
                  updateSetting('splitScreenEnabled', next)
                  updateSetting('brollVideo', next ? 'blur-fill' : 'none')
                }}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
                  settings.splitScreenEnabled ? 'bg-emerald-500' : 'bg-muted'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform',
                  settings.splitScreenEnabled ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </button>
            </div>

            {settings.splitScreenEnabled && (
            <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ratio stream / blur</Label>
                <span className="text-sm font-semibold text-foreground">{settings.splitRatio}% / {100 - settings.splitRatio}%</span>
              </div>
              <Slider
                value={[settings.splitRatio]}
                onValueChange={([v]) => updateSetting('splitRatio', v)}
                min={40}
                max={80}
                step={5}
                className="accent-orange-500 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:border-orange-400 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-orange-500/30 [&::-moz-range-thumb]:bg-orange-500 [&::-moz-range-thumb]:border-orange-400 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 h-2 bg-orange-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Video framing</Label>
              <p className="text-[10px] text-muted-foreground">Zoom on main video</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'contain' as const, label: 'Contain', desc: '100% visible' },
                  { id: 'fill' as const, label: 'Fill', desc: 'Subtle zoom' },
                  { id: 'immersive' as const, label: 'Immersive', desc: 'Medium zoom' },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateSetting('videoZoom', opt.id)}
                    className={cn(
                      'relative rounded-xl border p-3 transition-all text-left',
                      settings.videoZoom === opt.id
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <span className="text-xs font-semibold block">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            </>
            )}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
