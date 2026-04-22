'use client'

import { useEffect, useState } from 'react'
import {
  Sparkles, Save, Loader2, Hash, X,
  TrendingUp, TrendingDown, Minus,
  Brain, BarChart3, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useScheduleStore } from '@/stores/schedule-store'
import { useSmartPublishingStore } from '@/stores/smart-publishing-store'

const NICHE_OPTIONS = [
  { value: 'gaming', label: 'Gaming' },
  { value: 'fps', label: 'FPS' },
  { value: 'moba', label: 'MOBA' },
  { value: 'irl', label: 'IRL / Lifestyle' },
]

const PHASE_CONFIG = {
  testing: { label: 'Testing', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  optimizing: { label: 'Optimizing', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  scaling: { label: 'Scaling', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
}

const MOMENTUM_CONFIG = {
  rising: { label: 'Rising', icon: TrendingUp, color: 'text-green-400' },
  neutral: { label: 'Neutral', icon: Minus, color: 'text-muted-foreground' },
  declining: { label: 'Declining', icon: TrendingDown, color: 'text-red-400' },
}

const PERF_CONFIG: Record<string, { label: string; color: string }> = {
  viral: { label: 'Viral', color: 'bg-purple-500/20 text-purple-400' },
  hot: { label: 'Hot', color: 'bg-orange-500/20 text-orange-400' },
  warm: { label: 'Warm', color: 'bg-amber-500/20 text-amber-400' },
  cold: { label: 'Cold', color: 'bg-blue-500/20 text-blue-400' },
  dead: { label: 'Dead', color: 'bg-red-500/20 text-red-400' },
}

export function DistributionSettings() {
  const { settings, settingsLoading, fetchSettings, updateSettings, optimizeWithAI } = useScheduleStore()
  const { intelligence, recommendation, loading: smartLoading, fetchIntelligence } = useSmartPublishingStore()

  const [maxPosts, setMaxPosts] = useState(3)
  const [minHours, setMinHours] = useState(3)
  const [captionTemplate, setCaptionTemplate] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [hashtagInput, setHashtagInput] = useState('')
  const [niche, setNiche] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeMessage, setOptimizeMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
    fetchIntelligence('tiktok')
  }, [fetchSettings, fetchIntelligence])

  useEffect(() => {
    if (settings) {
      setMaxPosts(settings.max_posts_per_day)
      setMinHours(settings.min_hours_between_posts)
      setCaptionTemplate(settings.caption_template ?? '')
      setHashtags(settings.default_hashtags ?? [])
      setNiche(settings.niche)
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    await updateSettings({
      max_posts_per_day: maxPosts,
      min_hours_between_posts: minHours,
      caption_template: captionTemplate || null,
      default_hashtags: hashtags,
      niche,
    })
    setSaving(false)
  }

  const handleOptimize = async () => {
    setOptimizing(true)
    setOptimizeMessage(null)

    // Show phase-specific message
    const phase = intelligence?.phase ?? 'testing'
    const totalPosts = intelligence?.total_posts ?? 0
    if (phase === 'testing') {
      setOptimizeMessage('Setting up test schedule to discover your best posting times...')
    } else if (phase === 'optimizing') {
      setOptimizeMessage(`Analyzing your ${totalPosts} posts to find optimal patterns...`)
    } else {
      setOptimizeMessage('Fine-tuning your strategy based on momentum...')
    }

    await optimizeWithAI(niche ?? undefined)
    await fetchIntelligence('tiktok')
    setOptimizing(false)
  }

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '')
    if (tag && !hashtags.includes(tag) && hashtags.length < 30) {
      setHashtags([...hashtags, tag])
      setHashtagInput('')
    }
  }

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter(h => h !== tag))
  }

  const phase = intelligence?.phase ?? 'testing'
  const phaseCfg = PHASE_CONFIG[phase]
  const momentum = intelligence?.current_momentum ?? 'neutral'
  const momentumCfg = MOMENTUM_CONFIG[momentum]
  const MomentumIcon = momentumCfg.icon
  const lastPerf = intelligence?.last_post_performance
  const perfCfg = lastPerf ? PERF_CONFIG[lastPerf] : null

  return (
    <div className="space-y-4">
      {/* Smart Publishing Status */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Smart Publishing</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {smartLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <>
              {/* Phase + Momentum + Last Performance */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={phaseCfg.color}>
                  {phaseCfg.label} Phase
                </Badge>
                <Badge variant="outline" className={`gap-1 ${momentumCfg.color}`}>
                  <MomentumIcon className="h-3 w-3" />
                  {momentumCfg.label}
                </Badge>
                {perfCfg && (
                  <Badge className={perfCfg.color}>
                    Last: {perfCfg.label}
                  </Badge>
                )}
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  {intelligence?.total_posts ?? 0} posts analyzed
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Confidence: {recommendation?.confidence ?? 'low'}
                </span>
              </div>

              {/* Recommendation */}
              {recommendation && (
                <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-foreground/80">{recommendation.reason}</p>
                  {recommendation.tips.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {recommendation.tips.map((tip, i) => (
                        <li key={i} className="text-[10px] text-muted-foreground">- {tip}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Insights (if enough data) */}
      {intelligence && intelligence.total_posts >= 15 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Insights</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Best time slots */}
            {intelligence.best_hours.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Best performing time slots</p>
                <div className="flex gap-2">
                  {intelligence.best_hours.slice(0, 3).map((h, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] text-green-400 border-green-500/30">
                      {h.hour}:00 — avg {Math.round(h.avg_score)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Best clip duration */}
            {intelligence.best_clip_duration_range && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Best clip duration:</span>{' '}
                {intelligence.best_clip_duration_range.min}-{intelligence.best_clip_duration_range.max}s
              </div>
            )}

            {/* Captions/Split impact */}
            <div className="flex gap-4 text-xs text-muted-foreground">
              {intelligence.captions_boost_percent != null && (
                <span>
                  <span className="font-medium text-foreground/80">Captions:</span>{' '}
                  <span className={intelligence.captions_boost_percent > 0 ? 'text-green-400' : 'text-red-400'}>
                    {intelligence.captions_boost_percent > 0 ? '+' : ''}{intelligence.captions_boost_percent}%
                  </span>
                </span>
              )}
              {intelligence.split_screen_boost_percent != null && (
                <span>
                  <span className="font-medium text-foreground/80">Split-screen:</span>{' '}
                  <span className={intelligence.split_screen_boost_percent > 0 ? 'text-green-400' : 'text-red-400'}>
                    {intelligence.split_screen_boost_percent > 0 ? '+' : ''}{intelligence.split_screen_boost_percent}%
                  </span>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights locked state */}
      {intelligence && intelligence.total_posts < 15 && (
        <Card className="border-border">
          <CardContent className="py-4">
            <div className="text-center">
              <BarChart3 className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1.5" />
              <p className="text-xs text-muted-foreground">
                Post {15 - intelligence.total_posts} more clips to unlock insights
              </p>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden max-w-[200px] mx-auto">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (intelligence.total_posts / 15) * 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Settings */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Distribution Settings</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure your posting preferences
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              onClick={handleOptimize}
              disabled={optimizing}
            >
              {optimizing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Optimize with AI
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Optimize message */}
          {optimizeMessage && optimizing && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-xs text-primary font-medium">{optimizeMessage}</span>
            </div>
          )}

          {/* Niche */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Content Niche</Label>
            <div className="flex flex-wrap gap-2">
              {NICHE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNiche(niche === opt.value ? null : opt.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                    niche === opt.value
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max posts per day */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Max posts/day</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={maxPosts}
                onChange={e => setMaxPosts(parseInt(e.target.value) || 1)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Min hours between posts</Label>
              <Input
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={minHours}
                onChange={e => setMinHours(parseFloat(e.target.value) || 1)}
                className="h-9"
              />
            </div>
          </div>

          {/* Caption template */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Caption Template</Label>
            <Input
              placeholder="🔥 {title} #viral #fyp"
              value={captionTemplate}
              onChange={e => setCaptionTemplate(e.target.value)}
              className="h-9"
            />
            <p className="text-[10px] text-muted-foreground">
              Use {'{title}'} to insert the clip title automatically
            </p>
          </div>

          {/* Default hashtags */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Default Hashtags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add hashtag..."
                value={hashtagInput}
                onChange={e => setHashtagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHashtag() } }}
                className="h-9 flex-1"
              />
              <Button size="sm" variant="outline" className="h-9" onClick={addHashtag}>
                <Hash className="h-3.5 w-3.5" />
              </Button>
            </div>
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {hashtags.map(tag => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] gap-1 pr-1 text-muted-foreground"
                  >
                    #{tag}
                    <button
                      onClick={() => removeHashtag(tag)}
                      className="ml-0.5 hover:text-red-400 transition-colors"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* AI optimized badge */}
          {settings?.ai_optimized && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">AI-optimized settings active</span>
            </div>
          )}

          {/* Save button */}
          <Button className="w-full gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
