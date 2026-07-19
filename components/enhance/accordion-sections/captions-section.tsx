'use client'

import { cn } from '@/lib/utils'
import { Type, Zap, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Label } from '@/components/ui/label'
import { ScoreBadge } from '@/components/enhance/live-preview'
import { CAPTION_STYLES, EMPHASIS_EFFECTS, EMPHASIS_COLORS } from '@/lib/enhance/scoring'
import type { AccordionSectionProps } from '@/components/enhance/enhance-types'
import React from 'react'

interface CaptionsSectionProps extends AccordionSectionProps {
  sectionRef?: React.Ref<HTMLDivElement>
  /** When true, hides granular controls (position, words/line, custom words) — they live in the Advanced accordion */
  hideGranular?: boolean
  /** Whether the bonus badge is revealed (after AI Optimize or manual change) */
  showBonus?: boolean
  /** Ephemeral delta to show briefly on manual change */
  ephemeralDelta?: number | null
}

export function CaptionsSection({
  settings, updateSetting, scoreBreakdown, hasAiAnalyzed, analysisComplete, moodAiDetected,
  selectedMood, scores, getRealImpact, sectionRef, hideGranular = false,
  showBonus = false, ephemeralDelta,
}: CaptionsSectionProps) {
  return (
    <AccordionItem value="captions" ref={sectionRef as React.Ref<HTMLDivElement>} className={cn("scroll-mt-32 va-panel px-4 overflow-hidden", settings.captionStyle !== 'none' ? 'va-panel-active' : 'va-panel-muted')}>
      <AccordionTrigger className="text-zinc-400 hover:text-white">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Type className={cn("h-4 w-4", settings.captionStyle !== 'none' ? 'text-amber-400' : 'text-zinc-500')} />
          Karaoke captions
          <span className="text-xs text-zinc-500 font-normal">
            {settings.captionStyle !== 'none'
              ? `· ${CAPTION_STYLES.find(s => s.id === settings.captionStyle)?.label ?? settings.captionStyle}`
              : '· Off'}
            {settings.emphasisEffect !== 'none' && ` · ${EMPHASIS_EFFECTS.find(e => e.id === settings.emphasisEffect)?.label ?? ''}`}
            {settings.emphasisEffect !== 'none' && settings.emphasisColor && ` · ${EMPHASIS_COLORS.find(c => c.id === settings.emphasisColor)?.label ?? ''}`}
          </span>
          {showBonus && scoreBreakdown.captions > 0 && (
            <span className="ml-auto text-[11px] font-bold text-emerald-400 animate-[scorePop_0.4s_ease-out]">+{scoreBreakdown.captions} pts</span>
          )}
          {!showBonus && ephemeralDelta != null && ephemeralDelta !== 0 && (
            <span className={cn("ml-auto text-[11px] font-bold animate-[scorePop_0.4s_ease-out]", ephemeralDelta > 0 ? 'text-emerald-400' : 'text-red-400')}>
              {ephemeralDelta > 0 ? '+' : ''}{ephemeralDelta} pts
            </span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {scores && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {CAPTION_STYLES.map((style) => {
                  const { impact, isMoodPick } = getRealImpact('caption', style.id, scores.best.captionStyle)
                  const isHighlight = isMoodPick || (!selectedMood && style.id === scores.best.captionStyle)
                  return (
                    <button
                      key={style.id}
                      onClick={() => {
                        updateSetting('captionStyle', style.id)
                        updateSetting('captionsEnabled', style.id !== 'none')
                      }}
                      className={cn(
                        'relative rounded-xl border p-3 text-left transition-all',
                        settings.captionStyle === style.id
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : isMoodPick
                          ? 'border-green-500/40 bg-green-500/5 hover:bg-green-500/10'
                          : isHighlight
                          ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn('text-xs block', style.preview, isHighlight && !isMoodPick && 'drop-shadow-[0_0_6px_rgba(249,115,22,0.4)]')}>Aa</span>
                        {hasAiAnalyzed && <ScoreBadge score={impact} isBest={isHighlight} isMoodPick={isMoodPick} />}
                      </div>
                      <span className={cn('text-[10px] block', isMoodPick ? 'text-green-400 font-bold' : isHighlight ? 'text-orange-400 font-bold' : 'text-muted-foreground')}>
                        {style.label}
                        {analysisComplete && moodAiDetected && settings.captionStyle === style.id && style.id !== 'none' && (
                          <span className="ml-1 text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full border border-emerald-400/20">AI</span>
                        )}
                      </span>
                      {style.animLabel && (
                        <span className="text-[8px] block text-muted-foreground/60 mt-0.5">{style.animLabel}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {settings.captionStyle !== 'none' && <>
            {/* Animation info */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Animation:</span>
              <span className="text-xs font-semibold text-foreground">{CAPTION_STYLES.find(s => s.id === settings.captionStyle)?.animLabel || 'Highlight'}</span>
            </div>

            {/* Keyword emphasis */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Keyword emphasis</Label>
              <p className="text-[10px] text-muted-foreground">Effect applied to detected important words</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {EMPHASIS_EFFECTS.map((effect) => {
                  const { impact, isMoodPick } = getRealImpact('emphasis', effect.id, scores.best.emphasisEffect)
                  const isHighlight = isMoodPick || (!selectedMood && effect.id === scores.best.emphasisEffect)
                  return (
                    <button
                      key={effect.id}
                      onClick={() => updateSetting('emphasisEffect', effect.id)}
                      className={cn(
                        'relative rounded-xl border px-3 py-2.5 text-center transition-all',
                        settings.emphasisEffect === effect.id
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : isMoodPick
                          ? 'border-green-500/40 bg-green-500/5 hover:bg-green-500/10'
                          : isHighlight
                          ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      <span className={cn('text-[10px] font-medium block', isMoodPick ? 'text-green-400 font-bold' : isHighlight ? 'text-orange-400 font-bold' : 'text-foreground')}>
                        {effect.label}
                        {analysisComplete && moodAiDetected && settings.emphasisEffect === effect.id && effect.id !== 'none' && (
                          <span className="ml-1 text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full border border-emerald-400/20">AI</span>
                        )}
                      </span>
                      {hasAiAnalyzed && <ScoreBadge score={impact} isBest={isHighlight} isMoodPick={isMoodPick} />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Emphasis color */}
            <div className={cn('space-y-2 transition-opacity', settings.emphasisEffect === 'none' && 'opacity-40 pointer-events-none')}>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Emphasis color</Label>
              {settings.emphasisEffect === 'none' && (
                <p className="text-[10px] text-muted-foreground">Select an effect above to choose the color</p>
              )}
              <div className="flex gap-2">
                {EMPHASIS_COLORS.map((c) => (
                  <div key={c.id} className="relative">
                    <button
                      onClick={() => updateSetting('emphasisColor', c.id)}
                      className={cn(
                        'w-7 h-7 rounded-full transition-all',
                        settings.emphasisColor === c.id
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                          : 'opacity-60 hover:opacity-100 hover:scale-105'
                      )}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                    {analysisComplete && moodAiDetected && settings.emphasisColor === c.id && (
                      <span className="absolute -top-2 -right-2 text-[7px] font-bold text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded-full border border-emerald-400/20 leading-none">AI</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Granular controls — shown here only when not delegated to the Advanced accordion */}
            {!hideGranular && <>
            {/* Important words */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Important words</Label>
              <p className="text-[10px] text-muted-foreground">
                Words in <span className="text-red-400 font-bold">red</span> in the captions. Auto-detected (CAPS, viral words) + your own words.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mr-1 self-center">Auto</span>
                {['CAPS', 'OMG', 'CRAZY', 'INSANE', 'WTF'].map((w) => (
                  <span key={w} className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400">
                    {w}
                  </span>
                ))}
                <span className="text-[9px] text-muted-foreground/40 self-center">+ mots viraux</span>
              </div>
              {settings.customImportantWords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mr-1 self-center">Custom</span>
                  {settings.customImportantWords.map((w) => (
                    <span key={w} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-[10px] font-bold text-red-400">
                      {w}
                      <button
                        onClick={() => updateSetting('customImportantWords', settings.customImportantWords.filter((cw) => cw !== w))}
                        className="hover:text-red-300 transition-colors"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const input = (e.currentTarget.elements.namedItem('newWord') as HTMLInputElement)
                  const word = input.value.trim()
                  if (word && !settings.customImportantWords.includes(word.toLowerCase())) {
                    updateSetting('customImportantWords', [...settings.customImportantWords, word.toLowerCase()])
                    input.value = ''
                  }
                }}
              >
                <input
                  name="newWord"
                  type="text"
                  placeholder="Add a word..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <Button type="submit" size="sm" variant="outline" className="h-7 px-2">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>

            {/* Vertical position */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Vertical Position</Label>
                <span className="text-xs font-semibold text-foreground">{settings.captionPosition}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Top</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.captionPosition}
                  onChange={(e) => updateSetting('captionPosition', Number(e.target.value))}
                  className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
                />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Bottom</span>
              </div>
              <div className="flex justify-center gap-2">
                {([
                  { label: 'Top', value: 8 },
                  { label: 'Middle', value: 42 },
                  { label: 'Bottom', value: 72 },
                ]).map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => updateSetting('captionPosition', preset.value)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all',
                      Math.abs(settings.captionPosition - preset.value) <= 3
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:border-primary/40 text-muted-foreground'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Words per line */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Words per Line</Label>
                <span className="text-xs font-mono text-muted-foreground">{settings.wordsPerLine}</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={settings.wordsPerLine}
                onChange={(e) => updateSetting('wordsPerLine', Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/60">
                <span>1 (single)</span>
                <span>8 (compact)</span>
              </div>
            </div>
            </>}
            </>}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
