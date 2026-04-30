'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Loader2, Check, Plus, Clock, AlertCircle,
  Send, Radio, ExternalLink, Zap, Wand2, Film, ChevronRight,
  Calendar, TrendingUp, Target, Flame, Rocket, Trophy,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useDistributionStore } from '@/stores/distribution-store'
import { createClient } from '@/lib/supabase/client'
import { generateVariants, detectTone, type BioVariant } from '@/lib/distribution/caption-engine'
import { simulatePostMetrics, formatMetricCount, type PostMetrics } from '@/lib/distribution/tracking-simulator'
import { getPostFrequency, getPlatformPriority, getStrategyMessage, getConfidenceLevel } from '@/lib/distribution/strategy-engine'
import { createSessionMemory, recordPublish, getPersonalizedInsights, getPersonalizedStrategyMessage, type UserSessionMemory } from '@/lib/distribution/user-memory'
import { loadPersistentStats, recordPersistentPublish, getWhatWorkedSummary, type PersistentStats } from '@/lib/distribution/session-persistence'
import { collectRewards, getCreatorLevel, type Reward } from '@/lib/distribution/reward-engine'
import { useQueueStore } from '@/stores/queue-store'
import type { QueueClip, MoodType } from '@/lib/distribution/smart-queue-engine'

/* ─── Types ─── */
interface ClipBankItem {
  id: string
  title: string | null
  score: number | null
  thumbnailUrl: string | null
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
  scheduledAt: string | null
  source: 'trending' | 'upload'
}

interface PublishHistoryEntry {
  clipTitle: string
  platforms: string[]
  status: 'live' | 'error'
  timestamp: Date
  views: number
  likes: number
  growthPercent: number
  tone: string
}

function getRelativeTime(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  return `${Math.floor(diffMin / 60)}h ago`
}

interface PlatformConfig {
  id: string
  label: string
  icon: string
  gradient: string
  supported: boolean
  optimalHours: string[]
}

const PLATFORMS: PlatformConfig[] = [
  { id: 'tiktok', label: 'TikTok', icon: '♪', gradient: 'from-zinc-900 to-zinc-700', supported: true, optimalHours: ['7 PM', '9 PM', '11 AM'] },
  { id: 'youtube', label: 'YouTube Shorts', icon: '▶', gradient: 'from-red-600 to-red-500', supported: true, optimalHours: ['12 PM', '3 PM', '6 PM'] },
  { id: 'instagram', label: 'Instagram Reels', icon: '◎', gradient: 'from-pink-600 to-purple-600', supported: true, optimalHours: ['11 AM', '1 PM', '7 PM'] },
  { id: 'facebook', label: 'Facebook Reels', icon: 'f', gradient: 'from-blue-600 to-blue-500', supported: false, optimalHours: ['1 PM', '4 PM', '8 PM'] },
  { id: 'x', label: 'X / Twitter', icon: '𝕏', gradient: 'from-zinc-800 to-zinc-600', supported: false, optimalHours: ['9 AM', '12 PM', '5 PM'] },
]

const BIO_STEPS = [
  { text: 'Analyzing clip context & niche...', duration: 600 },
  { text: 'Scanning trending hooks...', duration: 800 },
  { text: 'Detecting optimal tone...', duration: 500 },
  { text: 'Generating caption variants...', duration: 1200 },
  { text: 'Optimizing hashtag mix...', duration: 700 },
  { text: 'Ranking by predicted CTR...', duration: 500 },
]

const VARIANT_COLORS = {
  orange: { active: 'border-orange-500/50 bg-orange-500/10 text-orange-400', dot: 'bg-orange-400' },
  emerald: { active: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-400' },
  red: { active: 'border-red-500/50 bg-red-500/10 text-red-400', dot: 'bg-red-400' },
} as const

/* ─── Dynamic Optimal Posting Times ─── */
function getOptimalPostingTimes(platformId: string): string[] {
  const now = new Date()
  const daySeed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
  const hash = (s: number) => {
    const x = Math.sin(s * 9301 + 49297) * 233280
    return x - Math.floor(x)
  }
  const s = daySeed + platformId.charCodeAt(0) * 137 + platformId.length * 31
  const currentHour = now.getHours()

  const times: string[] = []
  const peakHours = [11, 13, 15, 17, 19, 21]
  const validToday = peakHours.filter(h => h > currentHour + 1)

  if (validToday.length > 0) {
    const h = validToday[Math.floor(hash(s) * validToday.length)]
    const m = Math.floor(hash(s + 1) * 12) * 5
    times.push(`Today ${h}:${m.toString().padStart(2, '0')}`)
  } else {
    const h = 10 + Math.floor(hash(s) * 4)
    const m = Math.floor(hash(s + 1) * 12) * 5
    times.push(`Tomorrow ${h}:${m.toString().padStart(2, '0')}`)
  }

  const h2 = 17 + Math.floor(hash(s + 2) * 5)
  const m2 = Math.floor(hash(s + 3) * 12) * 5
  times.push(`Tomorrow ${h2}:${m2.toString().padStart(2, '0')}`)

  return times
}

/* ─── Animated Flow Line ─── */
function FlowLine({ active = false }: { active?: boolean }) {
  return (
    <div className="flex flex-col items-center py-2">
      {/* Top dot */}
      <div className={cn('w-1 h-1 rounded-full', active ? 'bg-purple-500/60' : 'bg-border')} />
      <div className="relative w-0.5 h-12 overflow-hidden">
        <div className={cn(
          'absolute inset-0 w-full',
          active
            ? 'bg-gradient-to-b from-purple-500/60 to-purple-500/20'
            : 'bg-gradient-to-b from-border to-transparent'
        )} />
        {active && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.6)]"
            style={{ animation: 'flowDot 1.5s ease-in-out infinite' }} />
        )}
      </div>
      {/* Bottom dot */}
      <div className={cn('w-1 h-1 rounded-full', active ? 'bg-purple-500/40' : 'bg-border/50')} />
    </div>
  )
}

/* ─── Platform label mapping ─── */
const PLATFORM_LABELS_MAP: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube Shorts',
  instagram: 'Instagram Reels',
}

const RISK_STYLES: Record<string, { icon: string; label: string; color: string }> = {
  proven: { icon: '✅', label: 'Proven', color: 'text-emerald-400' },
  wildcard: { icon: '🎲', label: 'Wildcard', color: 'text-amber-400' },
}

const EMOTIONAL_MIX_STYLES: Record<string, { label: string; color: string }> = {
  diverse: { label: 'Diverse', color: 'text-emerald-400' },
  moderate: { label: 'Moderate', color: 'text-amber-400' },
  repetitive: { label: 'Repetitive', color: 'text-red-400' },
}

/* ─── Smart Queue Section ─── */
function SmartQueueSection({ clipBank }: { clipBank: ClipBankItem[] }) {
  const { queue, isGenerating, init, setClipBank, getDoNothingPreview, showOverrideToast, confirmOverrideLearning, dismissOverrideToast } = useQueueStore()
  const [expanded, setExpanded] = useState(false)

  // Init store on mount
  useEffect(() => { init() }, [init])

  // Convert clip bank items to queue clips when bank changes
  useEffect(() => {
    if (clipBank.length === 0) {
      setClipBank([])
      return
    }

    const queueClips: QueueClip[] = clipBank
      .filter(c => c.status === 'draft' || c.status === 'scheduled')
      .map(c => {
        // Calculate freshness based on how recent the clip is
        const ageHours = c.scheduledAt
          ? (Date.now() - new Date(c.scheduledAt).getTime()) / 3600000
          : 24 // default 24h old
        const freshness = Math.max(0, Math.min(100, 100 - ageHours * 2))

        return {
          id: c.id,
          title: c.title || 'Untitled clip',
          viralScore: c.score ?? 50,
          mood: 'unknown' as MoodType,
          hookType: 'unknown' as const,
          freshness,
          platformFit: { tiktok: 70, youtube: 65, instagram: 60 }, // defaults
          createdAt: c.scheduledAt ?? new Date().toISOString(),
          thumbnailUrl: c.thumbnailUrl,
        }
      })

    setClipBank(queueClips)
  }, [clipBank, setClipBank])

  // Don't render if no clips
  if (clipBank.length === 0 || !queue || queue.posts.length === 0) return null

  const doNothing = getDoNothingPreview()

  return (
    <div className="mt-2">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3 group"
      >
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-purple-400" />
          Next up — AI schedule
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">Smart</span>
        </h2>
        <ChevronRight className={cn(
          'h-4 w-4 text-muted-foreground transition-transform duration-200',
          expanded && 'rotate-90'
        )} />
      </button>

      <Card className="bg-card/60 border-border p-4 space-y-3">
        {/* Scheduled posts */}
        {queue.posts.slice(0, expanded ? undefined : 3).map((post, idx) => {
          const risk = RISK_STYLES[post.riskLevel]
          const time = post.scheduledAt
          const timeStr = time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0')
          const isToday = time.toDateString() === new Date().toDateString()
          const dayLabel = isToday ? 'Today' : 'Tomorrow'

          return (
            <div key={`${post.clip.id}-${idx}`} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
              {/* Time column */}
              <div className="flex-shrink-0 w-16 text-right">
                <p className="text-sm font-mono font-bold text-foreground">{timeStr}</p>
                <p className="text-[10px] text-muted-foreground">{dayLabel}</p>
              </div>

              {/* Clip info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{risk.icon}</span>
                  <p className="text-sm font-medium text-foreground truncate">{post.clip.title}</p>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {PLATFORM_LABELS_MAP[post.platform] ?? post.platform}
                  </span>
                  <span className={cn('text-[10px] font-medium', risk.color)}>
                    {risk.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {post.slotQuality === 'prime' ? 'Prime Time' : post.slotQuality === 'good' ? 'Good Slot' : 'Off-Peak'}
                  </span>
                </div>

                {/* Breakout probability */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-400">
                      Breakout: {post.breakoutProbability}%
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {post.breakoutContext}
                  </span>
                </div>

                {/* Explanation — "Why this order" */}
                <p className="text-[10px] text-purple-400/70 mt-1 flex items-center gap-1">
                  <Target className="h-2.5 w-2.5 flex-shrink-0" />
                  {post.explanation}
                </p>
              </div>

              {/* Score badge */}
              <div className="flex-shrink-0">
                <div className={cn(
                  'text-xs font-bold px-2 py-1 rounded-lg',
                  post.clip.viralScore >= 80 ? 'bg-orange-500/15 text-orange-400' :
                  post.clip.viralScore >= 60 ? 'bg-emerald-500/15 text-emerald-400' :
                  'bg-zinc-700/50 text-zinc-400'
                )}>
                  {post.clip.viralScore}
                </div>
              </div>
            </div>
          )
        })}

        {/* Expand button if more than 3 */}
        {queue.posts.length > 3 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full text-center text-[11px] text-purple-400 hover:text-purple-300 py-1 transition-colors"
          >
            +{queue.posts.length - 3} more scheduled · Show all
          </button>
        )}

        {/* Footer: strategy + emotional mix + "do nothing" */}
        <div className="pt-2 border-t border-border/50 space-y-2">
          {/* Strategy label */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-[11px] font-medium text-foreground">{queue.strategy}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Confidence: {queue.confidence}%
            </span>
          </div>

          {/* Emotional mix */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Emotional mix:</span>
            <span className={cn('text-[10px] font-medium', EMOTIONAL_MIX_STYLES[queue.emotionalMix].color)}>
              {queue.emotionalMix === 'diverse' ? '✅' : queue.emotionalMix === 'moderate' ? '⚠️' : '❌'} {EMOTIONAL_MIX_STYLES[queue.emotionalMix].label}
              {queue.posts.length > 1 && ` (${new Set(queue.posts.map(p => p.clip.mood)).size} moods)`}
            </span>
          </div>

          {/* "If you do nothing" preview */}
          {doNothing && (
            <div className="flex items-center gap-2 bg-purple-500/5 rounded-lg px-3 py-2 border border-purple-500/10">
              <Sparkles className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                <span className="text-foreground font-medium">If you do nothing</span> → {doNothing.postCount} posts go out, est. reach: {doNothing.estReach} · Confidence: {doNothing.confidence}%
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Override learning toast */}
      {showOverrideToast && (
        <div className="mt-2 flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg px-4 py-2.5"
          style={{ animation: 'stepFade 0.3s ease-out' }}>
          <p className="text-[11px] text-purple-300">
            You changed the posting order. Want us to learn from this?
          </p>
          <div className="flex gap-2">
            <button onClick={confirmOverrideLearning}
              className="text-[10px] font-semibold px-3 py-1 rounded bg-purple-500/30 text-purple-300 hover:bg-purple-500/40 transition-colors">
              Yes
            </button>
            <button onClick={dismissOverrideToast}
              className="text-[10px] px-3 py-1 rounded text-muted-foreground hover:text-foreground transition-colors">
              No
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main Component ─── */
export function DistributionHub() {
  const router = useRouter()
  const { accounts, fetchAccounts, publishTargets, togglePublishTarget, publishClip, publishProgress, isPublishing, resetPublishProgress } = useDistributionStore()

  const [clipBank, setClipBank] = useState<ClipBankItem[]>([])
  const [bankLoading, setBankLoading] = useState(true)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [aiAutoDistribute, setAiAutoDistribute] = useState(false)
  const [bioText, setBioText] = useState('')
  const [bioGenerating, setBioGenerating] = useState(false)
  const [bioStep, setBioStep] = useState(-1)
  const [bioVariants, setBioVariants] = useState<BioVariant[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const bioRef = useRef<HTMLTextAreaElement>(null)
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [countdown, setCountdown] = useState('')

  // Publish sequence state
  const [publishSteps, setPublishSteps] = useState<Array<{
    label: string
    status: 'pending' | 'active' | 'done' | 'error'
    platform?: string
  }>>([])
  const [publishSequenceActive, setPublishSequenceActive] = useState(false)
  const [publishDone, setPublishDone] = useState(false)
  const [publishHistory, setPublishHistory] = useState<PublishHistoryEntry[]>([])
  const publishRecordedRef = useRef(false)
  const [trackingMetrics, setTrackingMetrics] = useState<PostMetrics | null>(null)
  const trackingStartRef = useRef<number>(0)
  const [sessionMemory, setSessionMemory] = useState<UserSessionMemory>(() => createSessionMemory())
  const [persistentStats, setPersistentStats] = useState<PersistentStats>(() => loadPersistentStats())
  const [activeReward, setActiveReward] = useState<Reward | null>(null)

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  // Cleanup typewriter on unmount
  useEffect(() => {
    return () => { if (typewriterRef.current) clearInterval(typewriterRef.current) }
  }, [])

  /* Countdown for next post (fake, next 6h slot) */
  useEffect(() => {
    function calcCountdown() {
      const now = new Date()
      const hours = now.getHours()
      const nextSlot = Math.ceil((hours + 1) / 6) * 6
      const next = new Date(now)
      next.setHours(nextSlot, 0, 0, 0)
      if (next <= now) next.setHours(next.getHours() + 6)
      const diff = next.getTime() - now.getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      return `${h}h ${m.toString().padStart(2, '0')}min`
    }
    setCountdown(calcCountdown())
    const interval = setInterval(() => setCountdown(calcCountdown()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Sync publishProgress with publish sequence steps
  useEffect(() => {
    if (!publishSequenceActive) return
    setPublishSteps(prev => prev.map(step => {
      if (!step.platform) return step
      const progress = publishProgress[step.platform]
      if (!progress) return step
      if (progress.status === 'published') return { ...step, status: 'done' }
      if (progress.status === 'error') return { ...step, status: 'error' }
      if (progress.status === 'publishing') return { ...step, status: 'active' }
      return step
    }))
  }, [publishProgress, publishSequenceActive])

  // Record publish history when publish completes
  useEffect(() => {
    if (publishDone && !publishRecordedRef.current) {
      const published = Object.entries(publishProgress).filter(([, p]) => p.status === 'published').map(([id]) => id)
      const errored = Object.entries(publishProgress).filter(([, p]) => p.status === 'error').map(([id]) => id)
      const clip = clipBank.find(c => c.id === selectedClipId)
      if (published.length > 0) {
        publishRecordedRef.current = true
        const clipTitle = clip?.title || 'Untitled clip'
        const clipTone = detectTone(clipTitle).tone
        const score = clip?.score ?? 30
        const vid = (selectedVariantId ?? 'high-ctr') as 'high-ctr' | 'safe-reach' | 'viral-bait'
        const initialMetrics = simulatePostMetrics({
          clipScore: score,
          platforms: published,
          minutesSincePublish: 5,
          clipId: clip?.id ?? '',
          variantId: vid,
        })
        setPublishHistory(prev => [{
          clipTitle,
          platforms: published,
          status: 'live' as const,
          timestamp: new Date(),
          views: initialMetrics.views,
          likes: initialMetrics.likes,
          growthPercent: initialMetrics.growthPercent,
          tone: clipTone,
        }, ...prev].slice(0, 5))
        setSessionMemory(prev => recordPublish(prev, {
          clipId: clip?.id ?? '',
          clipTitle,
          clipScore: score,
          tone: clipTone,
          platforms: published,
          selectedVariant: vid,
        }))
        // Persistent stats
        const prevTotal = persistentStats.totalClipsPublished
        const avgScore = persistentStats.clipScores.length > 0
          ? Math.round(persistentStats.clipScores.reduce((a, b) => a + b, 0) / persistentStats.clipScores.length)
          : 0
        const updatedStats = recordPersistentPublish(persistentStats, {
          clipScore: score,
          clipTitle,
          tone: clipTone,
          platforms: published,
          projectedViews: initialMetrics.views,
        })
        setPersistentStats(updatedStats)
        // Rewards
        const rewards = collectRewards({
          previousTotalClips: prevTotal,
          newTotalClips: updatedStats.totalClipsPublished,
          currentStreak: updatedStats.currentStreak,
          sessionClipCount: sessionMemory.clipsPublished.length + 1,
          clipScore: score,
          bestClipScore: persistentStats.bestClipScore,
          averageScore: avgScore,
          platformCount: published.length,
        })
        if (rewards.length > 0) {
          setActiveReward(rewards[0])
          setTimeout(() => setActiveReward(null), 5000)
        }
      } else if (errored.length > 0) {
        publishRecordedRef.current = true
        setPublishHistory(prev => [{
          clipTitle: clip?.title || 'Untitled clip',
          platforms: errored,
          status: 'error' as const,
          timestamp: new Date(),
          views: 0,
          likes: 0,
          growthPercent: 0,
          tone: 'general',
        }, ...prev].slice(0, 5))
      }
    }
    if (!publishDone) publishRecordedRef.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishDone])

  // Live tracking simulation after publish
  useEffect(() => {
    if (!publishDone || !selectedClipId) {
      setTrackingMetrics(null)
      return
    }
    const publishedPlatforms = Object.entries(publishProgress)
      .filter(([, p]) => p.status === 'published')
      .map(([id]) => id)
    if (publishedPlatforms.length === 0) {
      setTrackingMetrics(null)
      return
    }
    const clip = clipBank.find(c => c.id === selectedClipId)
    if (!clip) return
    const score = clip.score ?? 30
    trackingStartRef.current = Date.now()

    const update = () => {
      const realMinutes = (Date.now() - trackingStartRef.current) / 60000
      const simulatedMinutes = realMinutes * 120
      setTrackingMetrics(simulatePostMetrics({
        clipScore: score,
        platforms: publishedPlatforms,
        minutesSincePublish: simulatedMinutes,
        clipId: clip.id,
        variantId: (selectedVariantId ?? undefined) as 'high-ctr' | 'safe-reach' | 'viral-bait' | undefined,
      }))
    }
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishDone, selectedClipId])

  /* Load clip bank */
  useEffect(() => {
    async function loadClipBank() {
      setBankLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setBankLoading(false); return }

      const { data: jobs } = await supabase
        .from('render_jobs')
        .select('id, clip_id, source, status, storage_path, created_at')
        .eq('user_id', user.id)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(20)

      if (!jobs || jobs.length === 0) { setClipBank([]); setBankLoading(false); return }

      const items: ClipBankItem[] = jobs.map((job) => ({
        id: job.clip_id,
        title: null,
        score: null,
        thumbnailUrl: null,
        status: 'draft' as const,
        scheduledAt: null,
        source: job.source === 'upload' ? 'upload' as const : 'trending' as const,
      }))

      const trendingIds = items.filter((i) => i.source === 'trending').map((i) => i.id)
      if (trendingIds.length > 0) {
        const { data: trendingData } = await supabase
          .from('trending_clips')
          .select('id, title, velocity_score, thumbnail_url')
          .in('id', trendingIds)
        if (trendingData) {
          for (const clip of trendingData) {
            const item = items.find((i) => i.id === clip.id)
            if (item) {
              item.title = clip.title
              item.score = clip.velocity_score ? Math.round(clip.velocity_score) : null
              item.thumbnailUrl = clip.thumbnail_url
            }
          }
        }
      }

      const uploadIds = items.filter((i) => i.source === 'upload').map((i) => i.id)
      if (uploadIds.length > 0) {
        const { data: videoData } = await supabase
          .from('videos')
          .select('id, title')
          .in('id', uploadIds)
        if (videoData) {
          for (const v of videoData) {
            const item = items.find((i) => i.id === v.id)
            if (item) item.title = v.title
          }
        }
      }

      setClipBank(items)
      if (items.length > 0 && !selectedClipId) setSelectedClipId(items[0].id)
      setBankLoading(false)
    }
    loadClipBank()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-select clip from URL query param (from Enhance -> Distribute Now)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const clipParam = params.get('clip')
    if (clipParam && clipBank.length > 0) {
      const found = clipBank.find(c => c.id === clipParam)
      if (found) {
        setSelectedClipId(clipParam)
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [clipBank])

  const selectedClip = clipBank.find((c) => c.id === selectedClipId) ?? null

  /* Select variant with typewriter effect */
  const selectVariant = useCallback((variant: BioVariant) => {
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null }
    setSelectedVariantId(variant.id)
    const fullText = variant.caption + '\n\n' + variant.hashtags.join(' ')
    let idx = 0
    setBioText('')
    typewriterRef.current = setInterval(() => {
      idx++
      setBioText(fullText.slice(0, idx))
      if (idx >= fullText.length) {
        if (typewriterRef.current) clearInterval(typewriterRef.current)
        typewriterRef.current = null
      }
    }, 20)
  }, [])

  /* Bio generator with step-by-step sequence */
  const generateBio = useCallback(async () => {
    if (!selectedClip) return
    setBioGenerating(true)
    setBioText('')
    setBioVariants([])
    setSelectedVariantId(null)
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null }

    for (let i = 0; i < BIO_STEPS.length; i++) {
      setBioStep(i)
      await new Promise((r) => setTimeout(r, BIO_STEPS[i].duration))
    }

    const title = selectedClip.title || 'this clip'
    const enabledCount = publishTargets.filter(t => t.enabled).length
    const variants = generateVariants(title, selectedClip.id, {
      clipScore: selectedClip.score ?? 30,
      platformCount: enabledCount || 1,
    })
    setBioVariants(variants)
    setBioStep(-1)
    setBioGenerating(false)
    selectVariant(variants[0])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClip, selectVariant, publishTargets])

  /* Publish handler with step-by-step sequence */
  const handlePublish = useCallback(async () => {
    if (!selectedClip || isPublishing || publishSequenceActive) return

    const enabledTargets = publishTargets.filter(t => t.enabled)
    if (enabledTargets.length === 0) return

    // Build step list
    const steps: Array<{ label: string; status: 'pending' | 'active' | 'done' | 'error'; platform?: string }> = [
      { label: 'Preparing video...', status: 'pending' },
      { label: 'Optimizing format for platforms...', status: 'pending' },
      ...enabledTargets.map(t => {
        const config = PLATFORMS.find(p => p.id === t.platform)
        return { label: `Posting to ${config?.label ?? t.platform}...`, status: 'pending' as const, platform: t.platform }
      }),
    ]

    setPublishSteps(steps)
    setPublishSequenceActive(true)
    setPublishDone(false)

    // Step 1: Preparing
    setPublishSteps(s => s.map((step, i) => i === 0 ? { ...step, status: 'active' } : step))
    await new Promise(r => setTimeout(r, 1000))
    setPublishSteps(s => s.map((step, i) => i === 0 ? { ...step, status: 'done' } : step))

    // Step 2: Optimizing
    setPublishSteps(s => s.map((step, i) => i === 1 ? { ...step, status: 'active' } : step))
    await new Promise(r => setTimeout(r, 800))
    setPublishSteps(s => s.map((step, i) => i === 1 ? { ...step, status: 'done' } : step))

    // Steps 3+: Real API calls (useEffect syncs from publishProgress)
    const hashtags = bioText.match(/#\w+/g) || []
    const caption = bioText.replace(/#\w+/g, '').trim()
    await publishClip(selectedClip.id, caption, hashtags)

    // Let React process final publishProgress updates
    await new Promise(r => setTimeout(r, 50))
    setPublishSequenceActive(false)
    setPublishDone(true)
  }, [selectedClip, bioText, isPublishing, publishClip, publishSequenceActive, publishTargets])

  const connectedPlatforms = accounts.map((a) => a.platform)
  const activePlatformCount = publishTargets.filter(
    (t) => t.enabled && connectedPlatforms.includes(t.platform)
  ).length

  const hasAnyProgress = Object.keys(publishProgress).length > 0
  const publishedCount = hasAnyProgress && Object.values(publishProgress).every(p => p.status === 'published') ? 1 : 0

  // Publish sequence derived values
  const completedSteps = publishSteps.filter(s => s.status === 'done' || s.status === 'error').length
  const progressPercent = publishSteps.length > 0 ? (completedSteps / publishSteps.length) * 100 : 0
  const platformStepsDone = publishSteps.filter(s => s.platform && (s.status === 'done' || s.status === 'error')).length
  const platformStepsTotal = publishSteps.filter(s => s.platform).length
  const publishedPlatformCount = Object.values(publishProgress).filter(p => p.status === 'published').length

  // Contextual reach
  const clipScore = selectedClip?.score ?? 30
  const formatReach = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}K` : `${n}`
  const postPublishReachLow = clipScore * publishedPlatformCount * 150
  const postPublishReachHigh = clipScore * publishedPlatformCount * 300
  const postPublishReachText = `${formatReach(postPublishReachLow)} \u2014 ${formatReach(postPublishReachHigh)}`
  const postPublishWhy = clipScore >= 80
    ? 'High viral score + multi-platform boost \u2192 strong distribution potential'
    : clipScore >= 60
    ? 'Solid clip score \u2014 consistent distribution expected'
    : 'Building momentum \u2014 repost top performers for best results'
  const potentialReachPerPlatform = !selectedClip ? null : clipScore >= 80 ? 20 : clipScore >= 60 ? 15 : 8
  const potentialReach = potentialReachPerPlatform !== null && activePlatformCount > 0
    ? `${potentialReachPerPlatform * activePlatformCount}K`
    : '\u2014'

  // Strategy engine
  const now = new Date()
  const enabledPlatformIds = publishTargets.filter(t => t.enabled).map(t => t.platform)

  const frequencyRec = getPostFrequency({
    clipScore,
    dayOfWeek: now.getDay(),
    hourOfDay: now.getHours(),
    activePlatformCount,
    clipId: selectedClip?.id ?? '',
  })

  const priorityRec = getPlatformPriority({
    enabledPlatforms: enabledPlatformIds,
    clipScore,
    hourOfDay: now.getHours(),
    dayOfWeek: now.getDay(),
  })

  const baseStrategyMessage = getStrategyMessage({
    clipScore,
    aiEnabled: aiAutoDistribute,
    activePlatformCount,
    hourOfDay: now.getHours(),
    dayOfWeek: now.getDay(),
    hasPublishedBefore: publishHistory.length > 0,
  })
  const strategyMessage = sessionMemory.clipsPublished.length > 0
    ? getPersonalizedStrategyMessage(sessionMemory, clipScore, aiAutoDistribute)
    : baseStrategyMessage

  const personalizedInsights = getPersonalizedInsights(sessionMemory)

  const confidence = getConfidenceLevel({
    clipScore,
    platformCount: activePlatformCount,
    hasCaption: bioText.length > 0,
  })

  return (
    <div className="space-y-6 pb-12">
      {/* CSS for flow animation */}
      <style jsx>{`
        @keyframes flowDot {
          0% { top: -6px; opacity: 0; }
          20% { opacity: 1; }
          100% { top: calc(100% + 6px); opacity: 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(168,85,247,0.3); }
          50% { box-shadow: 0 0 20px rgba(168,85,247,0.6); }
        }
        @keyframes stepFade {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes orbitDot {
          0% { transform: translate(-50%, -4px) rotate(0deg) translateY(-28px); }
          100% { transform: translate(-50%, -4px) rotate(360deg) translateY(-28px); }
        }
      `}</style>

      {/* Reward toast */}
      {activeReward && (
        <div className="fixed top-4 right-4 z-50 max-w-xs" style={{ animation: 'scaleIn 0.4s ease-out' }}>
          <Card className={cn('p-4 border shadow-xl',
            activeReward.rarity === 'legendary' ? 'bg-amber-950/90 border-amber-500/40'
              : activeReward.rarity === 'rare' ? 'bg-purple-950/90 border-purple-500/40'
              : 'bg-card/95 border-border'
          )}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{activeReward.emoji}</span>
              <div>
                <p className="text-sm font-bold text-foreground">{activeReward.title}</p>
                <p className="text-[11px] text-muted-foreground">{activeReward.subtitle}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-500/10 via-card/80 to-card/60 border border-purple-500/20 px-6 py-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Radio className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Distribution</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Drop your enhanced clips into the bank, activate AI distribution, and let it handle the rest.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── STRATEGY BLOCK ─── */}
      <Card className="bg-card/60 border-border border-l-2 border-l-purple-500/40 px-5 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Target className={cn('h-3.5 w-3.5', aiAutoDistribute ? 'text-purple-400' : 'text-muted-foreground')} />
            <span className={cn('text-xs font-semibold', aiAutoDistribute ? 'text-purple-400' : 'text-muted-foreground')}>Strategy</span>
            <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded-full border',
              confidence.level === 'high' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                : confidence.level === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
            )}>{confidence.percent}%</span>
          </div>
          <div className="flex items-center gap-4 text-xs flex-1 min-w-0">
            <span className={cn(aiAutoDistribute ? 'text-purple-300' : 'text-muted-foreground')} title={frequencyRec.reasoning}>
              Frequency: <span className="font-medium">{frequencyRec.label}</span>
            </span>
            <span className={cn('hidden sm:inline', aiAutoDistribute ? 'text-purple-300' : 'text-muted-foreground')} title={priorityRec.reasoning}>
              Priority: <span className="font-medium">{priorityRec.label}</span>
            </span>
            <span className={cn(aiAutoDistribute ? 'text-purple-300' : 'text-muted-foreground')}>
              Next post: <span className="font-medium">in {countdown || '\u2014'}</span>
            </span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">{strategyMessage}</p>
      </Card>

      {/* ─── PERSONALIZED INSIGHTS ─── */}
      {personalizedInsights.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {personalizedInsights.slice(0, 2).map((insight, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[10px] text-purple-300/80 bg-purple-500/5 border border-purple-500/10 rounded-full px-2.5 py-1">
              <Sparkles className="h-2.5 w-2.5 flex-shrink-0" />
              {insight.text}
            </span>
          ))}
        </div>
      )}

      {/* ─── CLIP BANK ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Clip bank
          </h2>
          <span className="text-xs text-muted-foreground">{clipBank.length} clip{clipBank.length !== 1 ? 's' : ''}</span>
        </div>
        <Card className="bg-card/60 border-border p-4">
          {bankLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[72px] h-[128px] rounded-xl bg-zinc-800/50 border border-border animate-pulse" />
              ))}
            </div>
          ) : clipBank.length === 0 ? (
            /* ─── Empty State ─── */
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Film className="h-7 w-7 text-purple-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">No clips ready yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Enhance a trending clip or upload your own, then it will appear here for distribution.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all">
                  <Sparkles className="h-3.5 w-3.5" /> Browse clips
                </button>
                <button onClick={() => router.push('/dashboard?tab=upload')}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-purple-500/30 transition-all">
                  <Plus className="h-3.5 w-3.5" /> Upload
                </button>
              </div>
            </div>
          ) : (
            /* ─── Clip thumbnails ─── */
            <div className="flex gap-3 overflow-x-auto pb-2">
              {clipBank.map((clip, idx) => {
                const platProgress = Object.values(publishProgress)
                const clipPublished = hasAnyProgress && platProgress.every(p => p.status === 'published')
                return (
                  <button
                    key={clip.id}
                    title={clip.title || 'Untitled clip'}
                    onClick={() => { setSelectedClipId(clip.id); resetPublishProgress(); setPublishDone(false); setPublishSteps([]) }}
                    className={cn(
                      'relative flex-shrink-0 w-[72px] h-[128px] rounded-xl border-2 transition-all overflow-hidden group hover:scale-105 transition-transform duration-200',
                      selectedClipId === clip.id
                        ? 'border-purple-500 ring-2 ring-purple-500/30'
                        : clip.score !== null && clip.score >= 80
                          ? 'border-border hover:border-orange-500/40 hover:ring-2 hover:ring-orange-500/30'
                          : clip.score !== null && clip.score >= 60
                            ? 'border-border hover:border-emerald-500/40 hover:ring-2 hover:ring-emerald-500/30'
                            : 'border-border hover:border-purple-500/40'
                    )}
                  >
                    {clip.thumbnailUrl ? (
                      <img src={clip.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-b from-zinc-700 to-zinc-900" />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-purple-500/80 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white">{idx + 1}</span>
                    </div>
                    {/* Smart labels */}
                    <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                      {idx === 0 && (
                        <span className="text-[8px] font-bold px-1 py-px rounded bg-purple-500/70 text-white leading-tight">Best next</span>
                      )}
                      {clip.score !== null && clip.score >= 80 ? (
                        <span className="flex items-center gap-px text-[8px] font-bold px-1 py-px rounded bg-orange-500/60 text-white leading-tight">
                          <Flame className="h-2 w-2 flex-shrink-0" />Priority
                        </span>
                      ) : clip.score !== null && clip.score >= 60 ? (
                        <span className="text-[8px] font-bold px-1 py-px rounded bg-emerald-500/50 text-white leading-tight">Ready</span>
                      ) : (
                        <span className="text-[8px] font-bold px-1 py-px rounded bg-zinc-600/60 text-white leading-tight">Draft</span>
                      )}
                    </div>
                    {clip.score && (
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                        <span className="text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-full">{clip.score}</span>
                      </div>
                    )}
                    {clipPublished && selectedClipId === clip.id && (
                      <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                        <Check className="h-6 w-6 text-emerald-400" />
                      </div>
                    )}
                  </button>
                )
              })}
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-shrink-0 w-[72px] h-[128px] rounded-xl border-2 border-dashed border-border hover:border-purple-500/40 flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <Plus className="h-5 w-5 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">Add</span>
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* ─── BIO & PUBLISH ─── */}
      <div className={cn(
        'grid grid-cols-1 lg:grid-cols-2 gap-4 transition-all duration-300',
        selectedClip ? 'opacity-100 translate-y-0' : 'opacity-60 translate-y-1',
      )}>
        {/* Bio Generator */}
        <Card className={cn('bg-card/60 p-5', selectedClip ? 'border-purple-500/15' : 'border-border')}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5">
              <Wand2 className="h-3.5 w-3.5 text-purple-400" />
              AI-generated bio
            </h2>
            <button onClick={generateBio} disabled={bioGenerating || !selectedClip}
              className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all',
                bioGenerating ? 'text-muted-foreground border-border cursor-not-allowed'
                  : !selectedClip ? 'text-muted-foreground/50 border-border/50 cursor-not-allowed'
                  : 'text-purple-400 border-purple-500/30 hover:bg-purple-500/10')}>
              {bioGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {bioGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {/* Step-by-step loading sequence */}
          {bioGenerating && bioStep >= 0 && (
            <div className="mb-3 space-y-1.5">
              {BIO_STEPS.map((step, i) => (
                <div key={i} className={cn(
                  'flex items-center gap-2 text-xs transition-all duration-300',
                  i < bioStep ? 'text-emerald-400' : i === bioStep ? 'text-purple-400' : 'text-muted-foreground/30'
                )} style={i <= bioStep ? { animation: 'stepFade 0.3s ease-out' } : undefined}>
                  {i < bioStep ? (
                    <Check className="h-3 w-3 flex-shrink-0" />
                  ) : i === bioStep ? (
                    <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-3 h-3 flex-shrink-0" />
                  )}
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Variant selector tabs */}
          {bioVariants.length > 0 && !bioGenerating && (
            <div className="flex gap-2 mb-3">
              {bioVariants.map((v) => {
                const isSelected = selectedVariantId === v.id
                const colors = VARIANT_COLORS[v.color]
                return (
                  <button
                    key={v.id}
                    onClick={() => selectVariant(v)}
                    className={cn(
                      'flex-1 text-left px-3 py-2 rounded-lg border transition-all duration-200',
                      isSelected ? `${colors.active} shadow-sm` : 'border-border text-muted-foreground hover:border-border/80 hover:bg-card/40'
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', colors.dot)} />
                      <span className="text-xs font-semibold">{v.label}</span>
                      {v.id === 'high-ctr' && <span className="text-[8px] opacity-50 ml-1">recommended</span>}
                    </div>
                    <p className="text-[10px] opacity-60 mt-0.5 ml-3">{v.riskLabel} · {v.projectedReachLabel}</p>
                  </button>
                )
              })}
            </div>
          )}

          <textarea ref={bioRef} value={bioText}
            onChange={(e) => {
              if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null }
              setBioText(e.target.value)
            }}
            placeholder={selectedClip ? 'Click Generate to create an AI-optimized caption with trending hashtags...' : 'Select a clip first, then generate a bio...'}
            className="w-full min-h-[120px] rounded-lg border border-border bg-background/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all resize-vertical" />
          {bioText && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {bioText.match(/#\w+/g)?.map((tag, i) => (
                <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">{tag}</span>
              ))}
            </div>
          )}
        </Card>

        {/* Publish Panel */}
        <Card className={cn('bg-card/60 p-5 flex flex-col justify-between', selectedClip && activePlatformCount > 0 ? 'border-orange-500/15' : 'border-border')}>
          {/* Progress bar at top */}
          {publishSequenceActive && publishSteps.length > 0 && (
            <div className="h-1 rounded-full bg-zinc-800 mb-4 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  aiAutoDistribute
                    ? 'bg-gradient-to-r from-purple-500 to-purple-400'
                    : 'bg-gradient-to-r from-orange-500 to-amber-400'
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          <div>
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-purple-400" />
              Publish
            </h2>

            {/* Post-publish AI projections */}
            {publishDone && publishedPlatformCount > 0 && !publishSequenceActive ? (
              <div className="space-y-3" style={{ animation: 'scaleIn 0.4s ease-out' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <Rocket className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Distribution started!</p>
                    <p className="text-[11px] text-muted-foreground">AI Growth Projections</p>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground/50">Predicted performance · Based on clip analysis & platform trends</p>

                {trackingMetrics && (
                  <>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-3 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Views</span>
                        <span className="text-sm font-bold text-foreground">{formatMetricCount(trackingMetrics.views)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Likes</span>
                        <span className="text-sm font-bold text-foreground">{formatMetricCount(trackingMetrics.likes)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Comments</span>
                        <span className="text-sm font-bold text-foreground">{formatMetricCount(trackingMetrics.comments)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Shares</span>
                        <span className="text-sm font-bold text-foreground">{formatMetricCount(trackingMetrics.shares)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className={cn(
                        'font-medium',
                        trackingMetrics.growthPercent > 0 ? 'text-emerald-400' : 'text-muted-foreground'
                      )}>
                        {trackingMetrics.growthPercent > 0 ? '+' : ''}{trackingMetrics.growthPercent}% vs average clip
                      </span>
                      <span className="flex items-center gap-1 text-purple-400">
                        <Zap className="h-3 w-3" />
                        <span className="font-medium">{trackingMetrics.velocityLabel}</span>
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      <p className="font-medium text-muted-foreground/80 mb-1">Platform breakdown:</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {Object.entries(trackingMetrics.platformBreakdown).map(([pid, data]) => {
                          const p = PLATFORMS.find(pl => pl.id === pid)
                          const isPrimary = priorityRec.order[0] === pid
                          return (
                            <span key={pid} className={isPrimary ? 'text-purple-300' : undefined}>
                              {p?.label ?? pid}: {formatMetricCount(data.views)} views{isPrimary ? ' \u2191' : ''}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : selectedClip ? (
              <div className="space-y-3">
                {/* Clip preview */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border">
                  <div className="w-10 h-[56px] rounded-lg bg-gradient-to-b from-zinc-700 to-zinc-900 flex-shrink-0 overflow-hidden">
                    {selectedClip.thumbnailUrl && <img src={selectedClip.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedClip.title || 'Untitled clip'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Score: {selectedClip.score ?? '\u2014'} · {selectedClip.source === 'trending' ? 'Trending' : 'Upload'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>

                {/* Step-by-step publish sequence */}
                {publishSequenceActive || (publishDone && publishSteps.length > 0 && publishedPlatformCount === 0) ? (
                  <div className="space-y-1.5 pt-1">
                    {publishSteps.map((step, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center gap-2 text-xs transition-all duration-300',
                          step.status === 'done' ? 'text-emerald-400'
                            : step.status === 'active' ? 'text-purple-400'
                            : step.status === 'error' ? 'text-red-400'
                            : 'text-muted-foreground/30'
                        )}
                        style={step.status !== 'pending' ? { animation: 'stepFade 0.3s ease-out' } : undefined}
                      >
                        {step.status === 'done' ? (
                          <Check className="h-3 w-3 flex-shrink-0" />
                        ) : step.status === 'active' ? (
                          <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
                        ) : step.status === 'error' ? (
                          <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        ) : (
                          <div className="w-3 h-3 flex-shrink-0" />
                        )}
                        <span>{step.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>
                      Publishing to {activePlatformCount} platform{activePlatformCount !== 1 ? 's' : ''}
                      {aiAutoDistribute ? ' · AI timing active' : ''}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 gap-2 text-center">
                <Film className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Select a clip from the bank to publish</p>
              </div>
            )}
          </div>

          <button
            onClick={handlePublish}
            disabled={!selectedClip || activePlatformCount === 0 || isPublishing || publishSequenceActive}
            className={cn('w-full mt-4 rounded-xl p-[1px] transition-all duration-300 overflow-hidden',
              !selectedClip || activePlatformCount === 0 || isPublishing || publishSequenceActive ? 'bg-muted cursor-not-allowed'
                : aiAutoDistribute ? 'bg-gradient-to-b from-purple-500 to-purple-700 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.01]'
                : 'bg-gradient-to-b from-orange-400 to-orange-600 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.01]')}>
            <div className={cn('flex items-center justify-center gap-2 rounded-[11px] px-4 py-3 border-t transition-all',
              !selectedClip || activePlatformCount === 0 || isPublishing || publishSequenceActive ? 'bg-muted text-muted-foreground'
                : aiAutoDistribute ? 'bg-purple-950/80 border-purple-400/20 text-white'
                : 'bg-gradient-to-b from-orange-500/95 to-orange-700/95 border-white/15 text-white')}>
              {publishSequenceActive ? (
                <>
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  <div className="text-left flex-1">
                    <span className="text-sm font-bold block leading-tight">
                      Publishing... {platformStepsDone}/{platformStepsTotal} platform{platformStepsTotal !== 1 ? 's' : ''}
                    </span>
                    <div className="h-1 rounded-full bg-white/10 mt-1.5 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          aiAutoDistribute ? 'bg-purple-400' : 'bg-orange-400'
                        )}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : aiAutoDistribute ? (
                <Zap className="h-[18px] w-[18px]" />
              ) : (
                <Send className="h-[18px] w-[18px]" />
              )}
              {!publishSequenceActive && (
                <div className="text-left">
                  <span className="text-sm font-bold block leading-tight">
                    {aiAutoDistribute ? 'Activate AI distribution' : 'Publish now'}
                  </span>
                  <span className="text-[10px] opacity-60 block">
                    {aiAutoDistribute
                      ? `${clipBank.length} clip${clipBank.length !== 1 ? 's' : ''} queued · ${activePlatformCount} platform${activePlatformCount !== 1 ? 's' : ''}`
                      : `Send to ${activePlatformCount} platform${activePlatformCount !== 1 ? 's' : ''}`}
                  </span>
                </div>
              )}
            </div>
          </button>
        </Card>
      </div>

      {/* ─── SMART QUEUE — AI Schedule ─── */}
      <SmartQueueSection clipBank={clipBank} />

      {/* ─── FLOW LINE: Bank → AI ─── */}
      <FlowLine active={clipBank.length > 0} />

      {/* ─── AI ENGINE NODE ─── */}
      <div className="flex flex-col items-center py-2">
        {/* Outer glow ring */}
        <div className="relative">
          {aiAutoDistribute && (
            <div className="absolute inset-0 w-20 h-20 -m-2 rounded-full border border-purple-500/20"
              style={{ animation: 'pulseGlow 3s ease-in-out infinite' }} />
          )}
          <div className={cn(
            'relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-700',
            aiAutoDistribute
              ? 'bg-gradient-to-br from-purple-500/25 to-purple-600/15 border-2 border-purple-400/50 shadow-[0_0_30px_rgba(168,85,247,0.15)]'
              : 'bg-purple-500/10 border-2 border-purple-500/20'
          )} style={aiAutoDistribute ? { animation: 'pulseGlow 2s ease-in-out infinite' } : undefined}>
            <Sparkles className={cn(
              'h-7 w-7 transition-all duration-500',
              aiAutoDistribute ? 'text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'text-purple-400/70'
            )} />
          </div>
          {/* Orbiting dots when active */}
          {aiAutoDistribute && (
            <>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-1.5 h-1.5 rounded-full bg-purple-400/60" style={{ animation: 'orbitDot 4s linear infinite' }} />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-1 h-1 rounded-full bg-purple-400/40" style={{ animation: 'orbitDot 4s linear infinite 2s' }} />
            </>
          )}
        </div>
        <span className="text-sm font-semibold text-purple-400 mt-3 flex items-center gap-1.5">
          AI distribution engine
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">Beta</span>
        </span>
        <span className="text-[11px] text-muted-foreground mt-0.5">Bio, timing & platform optimization</span>

        <Card className="bg-card/60 border-border px-5 py-3 flex items-center gap-3 mt-3">
          <Zap className={cn('h-4 w-4 transition-colors', aiAutoDistribute ? 'text-emerald-400' : 'text-muted-foreground')} />
          <span className="text-sm font-medium">AI auto-distribute</span>
          <Switch checked={aiAutoDistribute} onCheckedChange={(v) => { setAiAutoDistribute(v); if (v) setShowSchedule(true) }} />
        </Card>

        {/* Schedule preview when AI is ON */}
        {aiAutoDistribute && showSchedule && (
          <Card className="bg-card/60 border-purple-500/20 px-4 py-3 mt-2 w-full max-w-md" style={{ animation: 'stepFade 0.3s ease-out' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-xs font-medium text-purple-400">Optimal posting times</span>
              </div>
              <span className="text-[9px] text-muted-foreground/60">Based on 12,482 viral clips analyzed</span>
            </div>
            <div className="space-y-1.5">
              {PLATFORMS.filter(p => p.supported && publishTargets.find(t => t.platform === p.id)?.enabled).map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{p.label}</span>
                  <div className="flex gap-1.5">
                    {getOptimalPostingTimes(p.id).map((h, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 text-[10px] font-medium">{h}</span>
                    ))}
                  </div>
                </div>
              ))}
              {PLATFORMS.filter(p => p.supported && publishTargets.find(t => t.platform === p.id)?.enabled).length === 0 && (
                <p className="text-[11px] text-muted-foreground">Enable platforms below to see optimal times</p>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* ─── FLOW LINE: AI → Platforms ─── */}
      <FlowLine active={aiAutoDistribute || activePlatformCount > 0} />

      {/* ─── PLATFORMS ─── */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3 text-center">Platforms</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PLATFORMS.map((platform) => {
            const isConnected = connectedPlatforms.includes(platform.id as 'tiktok' | 'youtube' | 'instagram')
            const isActive = (publishTargets.find(t => t.platform === platform.id)?.enabled ?? false) && isConnected
            const progress = publishProgress[platform.id]
            const isComingSoon = !platform.supported

            return (
              <Card key={platform.id} className={cn(
                'bg-card/60 border p-4 transition-all duration-300 relative overflow-hidden',
                isActive ? 'border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.08)]' : 'border-border',
                isComingSoon && 'opacity-50 grayscale'
              )}>
                {/* Active indicator glow */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />
                )}
                {/* Platform icon */}
                <div className={cn(
                  'w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-lg font-bold mb-3 bg-gradient-to-br',
                  platform.gradient,
                  'text-white',
                  !isConnected && !isComingSoon && 'opacity-30'
                )}>
                  {platform.icon}
                </div>

                <p className="text-xs font-semibold text-center">{platform.label}</p>

                {isComingSoon ? (
                  /* Coming Soon badge */
                  <div className="mt-3 text-center">
                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Coming soon
                    </span>
                  </div>
                ) : isConnected ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-emerald-400 font-medium">Connected</span>
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        checked={publishTargets.find(t => t.platform === platform.id)?.enabled ?? false}
                        onCheckedChange={() => togglePublishTarget(platform.id)}
                      />
                    </div>
                    {isActive && aiAutoDistribute && (
                      <div className="flex items-center justify-center gap-1 text-[10px] text-purple-400">
                        <Clock className="h-3 w-3" /><span>AI timing</span>
                      </div>
                    )}
                    {/* Publish progress */}
                    {progress?.status === 'publishing' && (
                      <div className="flex items-center justify-center gap-1 text-[10px] text-amber-400">
                        <Loader2 className="h-3 w-3 animate-spin" /><span>Publishing...</span>
                      </div>
                    )}
                    {progress?.status === 'published' && (
                      <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-400">
                        <Check className="h-3 w-3" /><span>Published!</span>
                      </div>
                    )}
                    {progress?.status === 'error' && (
                      <div className="flex items-center justify-center gap-1 text-[10px] text-red-400">
                        <AlertCircle className="h-3 w-3" /><span>Failed</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => router.push('/settings')}
                    className="mt-3 w-full text-[11px] font-semibold flex items-center justify-center gap-1.5 py-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/15 border border-orange-500/25 hover:border-orange-500/40 transition-all">
                    <ExternalLink className="h-3 w-3" /> Connect account
                  </button>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* ─── RECENT ACTIVITY ─── */}
      <Card className="bg-card/60 border-border p-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-2">
          <Clock className="h-3.5 w-3.5 text-purple-400" />
          Recent activity
        </h2>
        {publishHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 py-2">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {publishHistory.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50 border border-border/50 hover:border-border transition-colors">
                <div className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  entry.status === 'live' ? 'bg-emerald-400' : 'bg-red-400'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{entry.clipTitle}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {entry.status === 'live' && entry.views > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatMetricCount(entry.views)} views
                        {entry.growthPercent > 0 && <span className="text-emerald-400 ml-1">+{entry.growthPercent}%</span>}
                      </span>
                    )}
                    {entry.tone !== 'general' && (
                      <span className="text-[9px] text-purple-400/60">{entry.tone}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {entry.platforms.map(pid => {
                    const p = PLATFORMS.find(pl => pl.id === pid)
                    return p ? (
                      <span key={pid} className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-300" title={p.label}>
                        {p.icon}
                      </span>
                    ) : null
                  })}
                </div>
                <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{getRelativeTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ─── WHAT WORKED ─── */}
      {persistentStats.totalClipsPublished >= 2 && (() => {
        const ww = getWhatWorkedSummary(persistentStats)
        return (
          <Card className="bg-card/60 border-amber-500/15 px-5 py-3.5">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-2">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              What worked
            </h2>
            <div className="flex flex-wrap gap-3 text-xs">
              {ww.topTone && (
                <span className="text-muted-foreground">
                  Top tone: <span className="text-foreground font-medium">{ww.topTone.name}</span>
                  {ww.topTone.performanceVsAvg > 0 && <span className="text-emerald-400 ml-1">+{ww.topTone.performanceVsAvg}%</span>}
                </span>
              )}
              {ww.topPlatform && (
                <span className="text-muted-foreground">
                  Top platform: <span className="text-foreground font-medium">{ww.topPlatform.name}</span>
                  {ww.topPlatform.multiplierVsOthers > 1 && <span className="text-emerald-400 ml-1">{ww.topPlatform.multiplierVsOthers}x</span>}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">{ww.recommendation}</p>
          </Card>
        )
      })()}

      {/* ─── STATS ─── */}
      {(() => {
        const level = getCreatorLevel(persistentStats.totalClipsPublished)
        return (
          <div className="grid grid-cols-4 gap-3 pt-2">
            <Card className="bg-card/60 border-border p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{clipBank.length - publishedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Queue</p>
            </Card>
            <Card className="bg-card/60 border-purple-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">{persistentStats.totalClipsPublished}</p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </Card>
            <Card className="bg-card/60 border-border p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{activePlatformCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Platforms</p>
            </Card>
            <Card className="bg-gradient-to-b from-purple-500/5 to-card/60 border-border p-4 text-center">
              <p className="text-lg font-bold text-foreground">{level.title}</p>
              <div className="h-1 rounded-full bg-zinc-800 mt-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${level.progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Lv.{level.level} · {level.progress}%</p>
            </Card>
          </div>
        )
      })()}
    </div>
  )
}
