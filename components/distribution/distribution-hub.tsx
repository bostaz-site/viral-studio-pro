'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Loader2, Check, Plus, Clock, AlertCircle, Pause,
  Send, Radio, ExternalLink, Zap, Wand2, Film, ChevronRight,
  Calendar, TrendingUp, Target, Flame, Rocket, Trophy,
  Settings, Layers, Play, Brain, Copy, RefreshCw, MapPin, CheckCircle2, X,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useDistributionStore } from '@/stores/distribution-store'
import { createClient } from '@/lib/supabase/client'
import { generateVariants, detectTone, type BioVariant } from '@/lib/distribution/caption-engine'
import type { DistributionCaptionResult, CaptionVariant, YouTubeVariant } from '@/lib/ai/caption-engine'
import { simulatePostMetrics, formatMetricCount, type PostMetrics } from '@/lib/distribution/tracking-simulator'
import { getPostFrequency, getPlatformPriority, getStrategyMessage, getConfidenceLevel } from '@/lib/distribution/strategy-engine'
import { createSessionMemory, recordPublish, getPersonalizedInsights, getPersonalizedStrategyMessage, type UserSessionMemory } from '@/lib/distribution/user-memory'
import { loadPersistentStats, recordPersistentPublish, getWhatWorkedSummary, type PersistentStats } from '@/lib/distribution/session-persistence'
import { collectRewards, getCreatorLevel, type Reward } from '@/lib/distribution/reward-engine'
import { useQueueStore } from '@/stores/queue-store'
import type { QueueClip, MoodType } from '@/lib/distribution/smart-queue-engine'
import { getConfidenceLabel } from '@/types/learning'
import type { LearnedDistributionProfile } from '@/types/learning'
import ElectricBorder from '@/components/ui/ElectricBorder'
import { PlatformPickerModal } from './platform-picker-modal'
import { ClipPickerModal } from './clip-picker-modal'
import { ClipBankRail } from './clip-bank-rail'
import './distribution-hub.css'

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

type ClipState = 'scheduled' | 'best' | 'priority' | 'ready' | 'draft' | 'needs-video' | 'broken-preview'

function getClipState(clip: ClipBankItem, idx: number, brokenThumbs: Set<string>): ClipState {
  const hasThumb = !!clip.thumbnailUrl && !brokenThumbs.has(clip.id)
  if (clip.status === 'scheduled' && clip.scheduledAt) return 'scheduled'
  if (idx === 0) return 'best'
  if ((clip.score ?? 0) >= 80) return 'priority'
  if (!clip.thumbnailUrl) return 'needs-video'
  if (brokenThumbs.has(clip.id)) return 'broken-preview'
  if (clip.status === 'draft' && hasThumb) return 'draft'
  return 'ready'
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

const CAPTION_STEPS = [
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
/* ─── AI Caption helpers ─── */

function extractFirstCaption(result: DistributionCaptionResult): string | null {
  if (result.tiktok?.variants[0]) {
    const v = result.tiktok.variants[0]
    return v.caption + '\n\n' + v.hashtags.join(' ')
  }
  if (result.instagram?.variants[0]) {
    const v = result.instagram.variants[0]
    return v.caption + '\n\n' + v.hashtags.join(' ')
  }
  if (result.youtube?.variants[0]) {
    const v = result.youtube.variants[0]
    return v.title + '\n\n' + v.description + '\n\n' + v.tags.join(', ')
  }
  return null
}

const PLATFORM_CAPTION_ICONS: Record<string, { icon: string; label: string }> = {
  tiktok: { icon: '\u266A', label: 'TikTok' },
  youtube: { icon: '\u25B6', label: 'YouTube Shorts' },
  instagram: { icon: '\u25CE', label: 'Instagram Reels' },
}

function SmartQueueSection({ clipBank }: { clipBank: ClipBankItem[] }) {
  const { queue, isGenerating, init, setClipBank, setLearnedProfile, learnedProfile, getDoNothingPreview, showOverrideToast, confirmOverrideLearning, dismissOverrideToast } = useQueueStore()
  const [expanded, setExpanded] = useState(false)

  // Init store on mount
  useEffect(() => { init() }, [init])

  // Fetch learned profile from analytics API
  useEffect(() => {
    fetch('/api/analytics/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data) setLearnedProfile(data.data as LearnedDistributionProfile)
        else if (data?.totalPostsAnalyzed !== undefined) setLearnedProfile(data as LearnedDistributionProfile)
      })
      .catch(() => { /* continue without profile */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          {learnedProfile && learnedProfile.totalPostsAnalyzed >= 5 && (
            <span className={cn(
              'text-[9px] font-medium px-1.5 py-0.5 rounded-full border',
              learnedProfile.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : learnedProfile.confidence === 'medium' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            )} title={`Based on ${learnedProfile.totalPostsAnalyzed} published posts`}>
              Learning: {getConfidenceLabel(learnedProfile.confidence)}
            </span>
          )}
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

                {/* Learned profile reasons */}
                {post.learnedReasons && post.learnedReasons.length > 0 && (
                  <div className="mt-1 flex items-start gap-1" title={post.learnedReasons.join('\n')}>
                    <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 cursor-help">
                      <Sparkles className="h-2 w-2" />
                      AI Learned
                    </span>
                    <span className="text-[9px] text-cyan-400/60 mt-0.5 truncate">{post.learnedReasons[0]}</span>
                  </div>
                )}
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
  const { queue, init: initQueue, setClipBank: setQueueClipBank } = useQueueStore()

  const [clipBank, setClipBank] = useState<ClipBankItem[]>([])
  const [bankLoading, setBankLoading] = useState(true)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [aiAutoDistribute, setAiAutoDistribute] = useState(false)
  const [captionText, setBioText] = useState('')
  const [captionGenerating, setBioGenerating] = useState(false)
  const [captionStep, setBioStep] = useState(-1)
  const [captionVariants, setBioVariants] = useState<BioVariant[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [aiCaptions, setAiCaptions] = useState<DistributionCaptionResult | null>(null)
  const [aiCaptionError, setAiCaptionError] = useState<string | null>(null)
  const aiCaptionCacheRef = useRef<Map<string, DistributionCaptionResult>>(new Map())
  const [showSchedule, setShowSchedule] = useState(false)
  const captionRef = useRef<HTMLTextAreaElement>(null)
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
  const [showPlatformPicker, setShowPlatformPicker] = useState(false)
  const [showClipPicker, setShowClipPicker] = useState(false)
  const [clipPickerTab, setClipPickerTab] = useState<'bank' | 'remixes'>('bank')
  const [brokenThumbs, setBrokenThumbs] = useState<Set<string>>(new Set())
  const [removedClipIds, setRemovedClipIds] = useState<Set<string>>(() => new Set())
  const [removedClipsHydrated, setRemovedClipsHydrated] = useState(false)

  // Hydrate from sessionStorage AFTER mount (avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('viral-animal-removed-clips')
      if (stored) setRemovedClipIds(new Set(JSON.parse(stored) as string[]))
    } catch { /* ignore */ }
    setRemovedClipsHydrated(true)
  }, [])

  // Persist removedClipIds to sessionStorage (only after hydration to avoid wiping on first mount)
  useEffect(() => {
    if (!removedClipsHydrated) return
    try { sessionStorage.setItem('viral-animal-removed-clips', JSON.stringify([...removedClipIds])) } catch { /* full */ }
  }, [removedClipIds, removedClipsHydrated])

  // Connection map refs (for dynamic SVG paths from platforms to brain)
  const connectionMapRef = useRef<HTMLDivElement>(null)
  const brainCoreRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLButtonElement>(null)
  const platTiktokRef = useRef<HTMLDivElement>(null)
  const platYoutubeRef = useRef<HTMLDivElement>(null)
  const platInstagramRef = useRef<HTMLDivElement>(null)
  const platFacebookRef = useRef<HTMLDivElement>(null)
  const [flowPaths, setFlowPaths] = useState<{ tiktok: string; youtube: string; instagram: string; facebook: string }>({
    tiktok: '', youtube: '', instagram: '', facebook: ''
  })

  // Compute flow paths from each platform icon to the brain core
  useEffect(() => {
    const compute = () => {
      const map = connectionMapRef.current
      const brain = brainCoreRef.current
      if (!map || !brain) return
      const mapBox = map.getBoundingClientRect()
      const brainBox = brain.getBoundingClientRect()
      const targetX = brainBox.left + brainBox.width / 2 - mapBox.left
      const targetY = brainBox.top + brainBox.height / 2 - mapBox.top

      const pathTo = (ref: { current: HTMLDivElement | null }) => {
        const node = ref.current
        if (!node) return ''
        const box = node.getBoundingClientRect()
        const cardL = box.left - mapBox.left
        const cardT = box.top - mapBox.top
        const cardR = box.right - mapBox.left
        const cardB = box.bottom - mapBox.top
        const cardCx = (cardL + cardR) / 2
        const cardCy = (cardT + cardB) / 2
        // Line starts at the card's INNER CORNER (closest to brain center)
        const sx = cardCx < targetX ? cardR : cardL
        const sy = cardCy < targetY ? cardB : cardT
        // Curve toward brain edge (stop well before center so the panel below doesn't overlap)
        const dx = targetX - sx
        const dy = targetY - sy
        const dist = Math.hypot(dx, dy)
        const stopShort = 105
        const ex = sx + dx * (1 - stopShort / dist)
        const ey = sy + dy * (1 - stopShort / dist)
        // Control points: line LEAVES the brain horizontally, then curves vertically
        // (down for bottom apps, up for top apps) to land on the card's inner corner.
        // Stronger weights make the L-shape clearly visible even when the vertical
        // delta is small relative to the horizontal one.
        const c1x = sx
        const c1y = sy + (ey - sy) * 0.85   // long vertical from card (almost reaches brain y)
        const c2x = sx + (ex - sx) * 0.25   // short horizontal lead-in near card; long horizontal at brain
        const c2y = ey
        return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`
      }

      setFlowPaths({
        tiktok: pathTo(platTiktokRef),
        youtube: pathTo(platYoutubeRef),
        instagram: pathTo(platInstagramRef),
        facebook: pathTo(platFacebookRef),
      })
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    // Observe the container AND each platform ref + brain core so any layout shift recomputes paths
    if (connectionMapRef.current) ro.observe(connectionMapRef.current)
    if (brainCoreRef.current) ro.observe(brainCoreRef.current)
    if (platTiktokRef.current) ro.observe(platTiktokRef.current)
    if (platYoutubeRef.current) ro.observe(platYoutubeRef.current)
    if (platInstagramRef.current) ro.observe(platInstagramRef.current)
    if (platFacebookRef.current) ro.observe(platFacebookRef.current)
    window.addEventListener('resize', compute)
    // Recompute after fonts/layout/images settle
    const t1 = setTimeout(compute, 100)
    const t2 = setTimeout(compute, 500)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  // Init queue store
  useEffect(() => { initQueue() }, [initQueue])

  // Sync clip bank to queue store
  useEffect(() => {
    if (clipBank.length === 0) { setQueueClipBank([]); return }
    const queueClips: QueueClip[] = clipBank
      .filter(c => c.status === 'draft' || c.status === 'scheduled')
      .map(c => ({
        id: c.id,
        title: c.title || 'Untitled clip',
        viralScore: c.score ?? 50,
        mood: 'unknown' as MoodType,
        hookType: 'unknown' as const,
        freshness: Math.max(0, Math.min(100, 100 - (c.scheduledAt ? (Date.now() - new Date(c.scheduledAt).getTime()) / 3600000 : 24) * 2)),
        platformFit: { tiktok: 70, youtube: 65, instagram: 60 },
        createdAt: c.scheduledAt ?? new Date().toISOString(),
        thumbnailUrl: c.thumbnailUrl,
      }))
    setQueueClipBank(queueClips)
  }, [clipBank, setQueueClipBank])

  // Cleanup typewriter on unmount
  useEffect(() => {
    return () => { if (typewriterRef.current) clearInterval(typewriterRef.current) }
  }, [])

  // Modal Escape key close
  useEffect(() => {
    if (!showPlatformPicker && !showClipPicker) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPlatformPicker && !publishSequenceActive) setShowPlatformPicker(false)
        if (showClipPicker) setShowClipPicker(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showPlatformPicker, showClipPicker, publishSequenceActive])

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
      // Do NOT auto-select first clip — Publish strip stays empty until user explicitly stages a clip
      // (via Rocket button on bank card, or ?action=publish from Enhance)
      setBankLoading(false)
    }
    loadClipBank()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-select clip from URL query param (from Enhance -> Publish now / Place in bank)
  const [bankHighlightClipId, setBankHighlightClipId] = useState<string | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const clipParam = params.get('clip')
    const actionParam = params.get('action')
    const scrollTo = params.get('scrollTo')
    const highlightParam = params.get('highlight')

    if (clipParam && clipBank.length > 0) {
      const found = clipBank.find(c => c.id === clipParam)
      if (found) {
        setSelectedClipId(clipParam)
        if (actionParam === 'publish') {
          setShowPlatformPicker(true)
        }
        window.history.replaceState({}, '', window.location.pathname)
      }
    }

    // Scroll to bank + highlight a specific clip
    if (scrollTo === 'bank' && clipBank.length > 0) {
      if (highlightParam) setBankHighlightClipId(highlightParam)
      window.history.replaceState({}, '', window.location.pathname)
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

  /* AI caption generator — calls Claude Haiku via API */
  const generateCaption = useCallback(async () => {
    if (!selectedClip) return

    const enabledPlatforms = publishTargets
      .filter(t => t.enabled)
      .map(t => t.platform)
      .filter((p): p is 'tiktok' | 'youtube' | 'instagram' => ['tiktok', 'youtube', 'instagram'].includes(p))

    if (enabledPlatforms.length === 0) {
      enabledPlatforms.push('tiktok') // default if none selected
    }

    // Check session cache (skip if regenerating)
    const cacheKey = `${selectedClip.id}:${enabledPlatforms.sort().join(',')}`
    const isRegenerating = aiCaptions !== null || captionText !== ''
    const cached = !isRegenerating ? aiCaptionCacheRef.current.get(cacheKey) : undefined
    if (cached) {
      setAiCaptions(cached)
      setAiCaptionError(null)
      // Also set captionText from first available variant for publish flow
      const firstCaption = extractFirstCaption(cached)
      if (firstCaption) setBioText(firstCaption)
      return
    }

    setBioGenerating(true)
    setBioText('')
    setAiCaptions(null)
    setAiCaptionError(null)
    setBioVariants([])
    setSelectedVariantId(null)
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null }

    // Show generation steps
    for (let i = 0; i < CAPTION_STEPS.length; i++) {
      setBioStep(i)
      await new Promise((r) => setTimeout(r, CAPTION_STEPS[i].duration))
    }

    try {
      const { tone } = detectTone(selectedClip.title || '')
      const res = await fetch('/api/captions/distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId: selectedClip.id,
          transcript: selectedClip.title || '',
          mood: tone === 'general' ? 'hype' : tone,
          streamerName: undefined,
          sourceStreamer: undefined,
          platforms: enabledPlatforms,
        }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        throw new Error(json.error || `API error ${res.status}`)
      }

      const result = json.data as DistributionCaptionResult
      setAiCaptions(result)
      aiCaptionCacheRef.current.set(cacheKey, result)

      // Set captionText from first variant for the publish flow
      const firstCaption = extractFirstCaption(result)
      if (firstCaption) setBioText(firstCaption)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Caption generation failed'
      setAiCaptionError(msg)
      // Fallback to template engine
      const title = selectedClip.title || 'this clip'
      const enabledCount = publishTargets.filter(t => t.enabled).length
      const variants = generateVariants(title, selectedClip.id, {
        clipScore: selectedClip.score ?? 30,
        platformCount: enabledCount || 1,
      })
      setBioVariants(variants)
      selectVariant(variants[0])
    } finally {
      setBioStep(-1)
      setBioGenerating(false)
    }
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
    const hashtags = captionText.match(/#\w+/g) || []
    const caption = captionText.replace(/#\w+/g, '').trim()
    const now = new Date()
    await publishClip(selectedClip.id, caption, hashtags, {
      posted_hour_local: now.getHours(),
      posted_weekday: now.getDay(),
      blowup_chance_at_render: selectedClip.score ?? undefined,
    })

    // Let React process final publishProgress updates
    await new Promise(r => setTimeout(r, 50))
    setPublishSequenceActive(false)
    setPublishDone(true)
  }, [selectedClip, captionText, isPublishing, publishClip, publishSequenceActive, publishTargets])

  const connectedPlatforms = accounts.map((a) => a.platform)
  const activePlatformCount = publishTargets.filter(
    (t) => t.enabled && connectedPlatforms.includes(t.platform)
  ).length

  const isPlatActive = (pid: string) =>
    aiAutoDistribute &&
    connectedPlatforms.includes(pid as typeof connectedPlatforms[number]) &&
    (publishTargets.find(t => t.platform === pid)?.enabled ?? false)

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
    hasCaption: captionText.length > 0,
  })

  return (
    <div className="dist-page">
      {/* Reward toast */}
      {activeReward && (
        <div className="dist-reward-toast">
          <div className={`dist-reward-card ${activeReward.rarity === 'legendary' ? 'legendary' : activeReward.rarity === 'rare' ? 'rare' : 'common'}`}>
            <span style={{ fontSize: 28 }}>{activeReward.emoji}</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>{activeReward.title}</p>
              <p style={{ fontSize: 11, color: 'var(--va-text-muted)', margin: '2px 0 0' }}>{activeReward.subtitle}</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div className="dist-page-head">
        <div className="dist-title-block">
          <div className="dist-icon-mark">
            <Radio size={22} />
          </div>
          <div>
            <h1>Distribution</h1>
            <p className="sub">Your bank · the AI core · your routes — all running together.</p>
          </div>
        </div>
        <div className="dist-head-right">
          <div className={`dist-running-chip ${aiAutoDistribute ? '' : 'paused'}`}>
            <span className="dot" />
            CLIP FARM {aiAutoDistribute ? 'ONLINE' : 'PAUSED'}
          </div>
          <button className="dist-icon-btn" title="Settings" onClick={() => router.push('/settings')}>
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* ═══ PUBLISH STRIP — caption + publish ═══ */}
      <div id="publish-strip" className="dist-console-grid">
        {/* ─── Left: Caption ─── */}
        <div className="dist-glass dist-console-card">
          <div className="dist-console-card-head">
            <div className="dist-console-card-titles">
              <h3 className="dist-console-card-title">
                <Sparkles size={14} />
                Caption
              </h3>
              <p className="dist-console-card-sub">AI writes per-platform captions with trending hashtags.</p>
            </div>
            <button
              className="dist-cyan-btn"
              onClick={generateCaption}
              disabled={captionGenerating || !selectedClip}
            >
              {captionGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {captionGenerating ? 'Writing captions…' : (aiCaptions || captionText) ? 'Regenerate' : 'Generate AI captions'}
            </button>
          </div>

          {/* Generation steps */}
          {captionGenerating && captionStep >= 0 && (
            <div className="dist-console-steps">
              {CAPTION_STEPS.map((step, i) => (
                <div key={i} className={`dist-step-item ${i < captionStep ? 'done' : i === captionStep ? 'active' : 'pending'}`}>
                  {i < captionStep ? <Check size={12} /> : i === captionStep ? <Loader2 size={12} className="animate-spin" /> : <div style={{ width: 12, height: 12 }} />}
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* AI Caption results OR fallback OR empty state */}
          {aiCaptions ? (
            <div className="dist-ai-captions">
              {(['tiktok', 'instagram', 'youtube'] as const).map(pid => {
                const platData = aiCaptions[pid]
                if (!platData) return null
                const platInfo = PLATFORM_CAPTION_ICONS[pid]
                return (
                  <div key={pid} className="dist-ai-platform-group">
                    <div className="dist-ai-platform-header">
                      <span className="dist-ai-platform-icon">{platInfo.icon}</span>
                      <span className="dist-ai-platform-label">{platInfo.label}</span>
                    </div>
                    {'variants' in platData && (platData.variants as (CaptionVariant | YouTubeVariant)[]).map((variant, vi) => (
                      <div key={vi} className="dist-ai-variant-card">
                        <div className="dist-ai-variant-num">#{vi + 1}</div>
                        <div className="dist-ai-variant-body">
                          {pid === 'youtube' && 'title' in variant ? (
                            <>
                              <p className="dist-ai-variant-title">{(variant as YouTubeVariant).title}</p>
                              <p className="dist-ai-variant-desc">{(variant as YouTubeVariant).description}</p>
                              <div className="dist-ai-variant-tags">
                                {(variant as YouTubeVariant).tags.map((t, ti) => (
                                  <span key={ti} className="dist-ai-tag">{t}</span>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="dist-ai-variant-text">{(variant as CaptionVariant).caption}</p>
                              <div className="dist-ai-variant-tags">
                                {(variant as CaptionVariant).hashtags.map((h, hi) => (
                                  <span key={hi} className="dist-ai-tag">{h}</span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          className="dist-ai-copy-btn"
                          onClick={() => {
                            const text = pid === 'youtube' && 'title' in variant
                              ? `${(variant as YouTubeVariant).title}\n\n${(variant as YouTubeVariant).description}\n\n${(variant as YouTubeVariant).tags.join(', ')}`
                              : `${(variant as CaptionVariant).caption}\n\n${(variant as CaptionVariant).hashtags.join(' ')}`
                            navigator.clipboard?.writeText(text)
                            setBioText(text)
                          }}
                          title="Copy and use this variant"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ) : captionText ? (
            <>
              <div className="dist-caption-box">
                <textarea
                  ref={captionRef}
                  value={captionText}
                  onChange={(e) => {
                    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null }
                    setBioText(e.target.value)
                  }}
                  className="dist-caption-textarea"
                />
              </div>
              <div className="dist-caption-actions">
                <button
                  className="dist-ghost-btn"
                  onClick={() => navigator.clipboard?.writeText(captionText)}
                  title="Copy caption to clipboard"
                >
                  <Copy size={11} /> Copy
                </button>
              </div>
            </>
          ) : aiCaptionError ? (
            <div className="dist-caption-empty">
              <div className="empty-icon" style={{ color: 'rgba(239,68,68,0.7)' }}>
                <AlertCircle size={20} />
              </div>
              <p className="empty-title">Caption generation failed</p>
              <p className="empty-sub">{aiCaptionError}</p>
            </div>
          ) : !captionGenerating && (
            <div className="dist-caption-empty">
              <div className="empty-icon">
                <Sparkles size={20} />
              </div>
              <p className="empty-title">Generate AI captions for this clip.</p>
              <p className="empty-sub">Per-platform captions · trending hashtags · 3 variants each.</p>
            </div>
          )}
        </div>

        {/* ─── Right: Publish ─── */}
        <div className="dist-glass dist-console-card">
          <div className="dist-console-card-head">
            <div className="dist-console-card-titles">
              <h3 className="dist-console-card-title">
                <Send size={14} />
                Publish
              </h3>
              <p className="dist-console-card-sub">Send your clip to the connected platforms.</p>
            </div>
          </div>

          {publishDone && publishedPlatformCount > 0 && !publishSequenceActive ? (
            <div style={{ animation: 'dist-scaleIn 0.4s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(56,189,248,.15)', border: '1px solid rgba(56,189,248,.3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Rocket size={20} style={{ color: '#38BDF8' }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>Distribution started!</p>
                  <p style={{ fontSize: 11, color: 'var(--va-text-muted)', margin: 0 }}>AI Growth Projections</p>
                </div>
              </div>
              {trackingMetrics && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(42,42,62,.6)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'var(--va-text-dim)' }}>Views</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{formatMetricCount(trackingMetrics.views)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'var(--va-text-dim)' }}>Likes</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{formatMetricCount(trackingMetrics.likes)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'var(--va-text-dim)' }}>Comments</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{formatMetricCount(trackingMetrics.comments)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'var(--va-text-dim)' }}>Shares</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{formatMetricCount(trackingMetrics.shares)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : selectedClip ? (
            <>
              {/* Clip preview — click to change */}
              <button
                className="dist-next-clip dist-next-clip-btn"
                onClick={() => setShowClipPicker(true)}
                disabled={publishSequenceActive}
                title="Change clip"
              >
                <div className="dist-next-thumb">
                  {selectedClip.thumbnailUrl ? (
                    <img src={selectedClip.thumbnailUrl} alt="" />
                  ) : (
                    <div className="fill" />
                  )}
                  {(selectedClip.score ?? 0) >= 80 && (
                    <span className="thumb-score-badge">
                      <Flame size={9} /> {selectedClip.score}
                    </span>
                  )}
                </div>
                <div className="dist-next-info">
                  <div className="title">{selectedClip.title || 'Untitled clip'}</div>
                  <div className="meta">
                    <span>Score{' · '}<strong>{selectedClip.score ?? '—'}</strong></span>
                    <span className="dot">·</span>
                    <span>{selectedClip.source === 'trending' ? 'Remix' : 'Bank'}</span>
                  </div>
                </div>
                <span className="dist-next-clip-change">
                  <RefreshCw size={11} /> Change
                </span>
              </button>

              {/* Publish steps (during active publish) */}
              {(publishSequenceActive || (publishDone && publishSteps.length > 0 && publishedPlatformCount === 0)) && (
                <div className="dist-console-steps">
                  {publishSteps.map((step, i) => (
                    <div key={i} className={`dist-step-item ${step.status}`}>
                      {step.status === 'done' ? <Check size={12} /> : step.status === 'active' ? <Loader2 size={12} className="animate-spin" /> : step.status === 'error' ? <AlertCircle size={12} /> : <div style={{ width: 12, height: 12 }} />}
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Platforms target line — shows current selection */}
              <button
                className="dist-publish-targets dist-publish-targets-btn"
                onClick={() => setShowPlatformPicker(true)}
                disabled={publishSequenceActive}
                title="Choose platforms"
              >
                <TrendingUp size={12} />
                <span>
                  Posting to{' '}
                  <strong>
                    {activePlatformCount > 0
                      ? `${activePlatformCount} platform${activePlatformCount !== 1 ? 's' : ''}`
                      : 'no platform yet'}
                  </strong>
                </span>
                <ChevronRight size={13} className="chev" />
              </button>

              {/* Single primary action */}
              <button
                className="dist-cyan-btn primary"
                onClick={() => {
                  if (activePlatformCount === 0) {
                    setShowPlatformPicker(true)
                  } else {
                    setShowPlatformPicker(true)
                  }
                }}
                disabled={!selectedClip || isPublishing || publishSequenceActive}
              >
                {publishSequenceActive ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                {publishSequenceActive
                  ? `Publishing… ${platformStepsDone}/${platformStepsTotal}`
                  : activePlatformCount === 0 ? 'Choose platforms' : 'Post now'}
              </button>
            </>
          ) : (
            <div className="dist-next-empty">
              <Rocket size={28} style={{ color: 'rgba(56,189,248,0.4)' }} />
              <p className="empty-title">No clip staged</p>
              <p className="empty-sub">Pick a clip from your bank to publish now, or wait for AI Schedule.</p>
              <button
                className="dist-cyan-btn"
                style={{ marginTop: 10 }}
                onClick={() => document.getElementById('clip-bank-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              >
                <Film size={12} /> Pick from bank
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ CONNECTION MAP ═══ */}
      <div className="dist-connection-map" ref={connectionMapRef}>
        {/* Flow lines (dynamic paths — actually touch icons) + animated particles */}
        <svg className="dist-map-svg" preserveAspectRatio="none">
          <defs>
            <filter id="particle-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path id="flow-path-tiktok" className={`dist-flow-path ${isPlatActive('tiktok') ? 'blue' : 'dim'}`} d={flowPaths.tiktok} />
          <path id="flow-path-youtube" className={`dist-flow-path ${isPlatActive('youtube') ? 'blue' : 'dim'}`} d={flowPaths.youtube} />
          <path id="flow-path-instagram" className={`dist-flow-path ${isPlatActive('instagram') ? 'blue' : 'dim'}`} d={flowPaths.instagram} />
          <path id="flow-path-facebook" className="dist-flow-path dim" d={flowPaths.facebook} />
          {/* Animated glowing particles flowing along each path */}
          {flowPaths.tiktok && isPlatActive('tiktok') && (
            <>
              <circle r="3.5" fill="#38BDF8" filter="url(#particle-glow)">
                <animateMotion dur="2.6s" repeatCount="indefinite" path={flowPaths.tiktok} />
              </circle>
              <circle r="2" fill="#7dd3fc" filter="url(#particle-glow)" opacity="0.7">
                <animateMotion dur="2.6s" begin="0.9s" repeatCount="indefinite" path={flowPaths.tiktok} />
              </circle>
            </>
          )}
          {flowPaths.youtube && isPlatActive('youtube') && (
            <>
              <circle r="3.5" fill="#38BDF8" filter="url(#particle-glow)">
                <animateMotion dur="2.8s" repeatCount="indefinite" path={flowPaths.youtube} />
              </circle>
              <circle r="2" fill="#7dd3fc" filter="url(#particle-glow)" opacity="0.7">
                <animateMotion dur="2.8s" begin="1.2s" repeatCount="indefinite" path={flowPaths.youtube} />
              </circle>
            </>
          )}
          {flowPaths.instagram && isPlatActive('instagram') && (
            <>
              <circle r="3.5" fill="#38BDF8" filter="url(#particle-glow)">
                <animateMotion dur="2.5s" repeatCount="indefinite" path={flowPaths.instagram} />
              </circle>
              <circle r="2" fill="#7dd3fc" filter="url(#particle-glow)" opacity="0.7">
                <animateMotion dur="2.5s" begin="0.7s" repeatCount="indefinite" path={flowPaths.instagram} />
              </circle>
            </>
          )}
        </svg>

        {/* Platform nodes — compact icon style */}
        {PLATFORMS.filter(p => ['tiktok', 'youtube', 'instagram', 'facebook'].includes(p.id)).map((p) => {
          const isConn = connectedPlatforms.includes(p.id as typeof connectedPlatforms[number])
          const isComingSoon = !p.supported
          const isEnabled = publishTargets.find(t => t.platform === p.id)?.enabled ?? false
          const isActive = isConn && isEnabled && aiAutoDistribute
          const posClass = p.id === 'tiktok' ? 'pos-tl' : p.id === 'youtube' ? 'pos-bl' : p.id === 'instagram' ? 'pos-tr' : 'pos-br'
          const platRef = p.id === 'tiktok' ? platTiktokRef : p.id === 'youtube' ? platYoutubeRef : p.id === 'instagram' ? platInstagramRef : platFacebookRef
          return (
            <div key={p.id} ref={platRef} className={`dist-plat-node ${posClass} ${isActive ? 'active' : isComingSoon ? 'dim' : ''}`}>
              {isActive ? (
                <ElectricBorder color="#38BDF8" speed={0.8} chaos={0.08} borderRadius={20}>
                  <div className="plat-icon-wrap">{p.icon}</div>
                </ElectricBorder>
              ) : (
                <div className="plat-icon-wrap">{p.icon}</div>
              )}
              <span className="plat-name">{p.label}</span>
              {isComingSoon ? (
                <span className="plat-toggle soon">Soon</span>
              ) : isConn ? (
                <button className={`plat-toggle ${isActive ? 'on' : 'off'}`} onClick={() => togglePublishTarget(p.id)}>
                  <span className="toggle-dot" />
                  {isActive ? 'ON' : 'OFF'}
                </button>
              ) : (
                <button className="plat-toggle connect" onClick={() => router.push('/settings')}>Connect</button>
              )}
            </div>
          )
        })}

        {/* AI Brain Core — premium glass system */}
        <div ref={brainCoreRef} className={`dist-core-wrap ${aiAutoDistribute ? "" : "off"}`}>
          <div className="dist-core-glow" />
          <div className="dist-core-glass" />
          <svg className="dist-brain-svg" viewBox="0 0 320 320" aria-hidden="true">
            <defs>
              <linearGradient id="cyan-orange" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#F97316" />
              </linearGradient>
              <filter id="wolf-glow" x="-60%" y="-60%" width="220%" height="220%">
                {/* Tight bright halo right at the stroke edge */}
                <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#FED7AA" floodOpacity="0.85" />
                {/* Mid orange glow */}
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#FB923C" floodOpacity="0.55" />
                {/* Soft diffused outer aura */}
                <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#F97316" floodOpacity="0.22" />
              </filter>
              <filter id="brainGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="0 0 0 0 0.15  0 0 0 0 0.75  0 0 0 0 1  0 0 0 0.85 0"
                  result="glow"
                />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="brainStroke" x1="60" y1="60" x2="260" y2="260" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#7DD3FC" />
                <stop offset="50%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0EA5E9" />
              </linearGradient>
              <linearGradient id="brainSoftFill" x1="160" y1="50" x2="160" y2="270" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {/* ── Concentric glass rings ── */}
            <circle cx="160" cy="160" r="148" fill="rgba(8,15,28,0.32)" stroke="rgba(56,189,248,0.22)" strokeWidth="1" />
            <circle cx="160" cy="160" r="142" fill="none" stroke="rgba(56,189,248,0.12)" strokeWidth="0.6" />
            <circle cx="160" cy="160" r="128" fill="none" stroke="rgba(56,189,248,0.07)" strokeWidth="0.5" />

            {/* ── Outer ring (rotating dashes) with subtle brand accents ── */}
            <g className="dist-core-outer-ring">
              <circle cx="160" cy="160" r="148" fill="none" stroke="rgba(56,189,248,0.55)" strokeWidth="1.1" strokeDasharray="2 7" strokeLinecap="round" />
              {/* Cyan data nodes (rotate with ring) */}
              <circle cx="308" cy="160" r="2.5" fill="#7DD3FC" opacity="0.9" />
              <circle cx="12" cy="160" r="2" fill="#7DD3FC" opacity="0.6" />
              {/* Single subtle orange node — brand hint, not anomaly */}
              <circle cx="160" cy="12" r="2.5" fill="#FB923C" opacity="0.85">
                <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
              </circle>
            </g>

            {/* Static inner ring (counter-stable, gives depth without rotation) */}
            <circle cx="160" cy="160" r="138" fill="none" stroke="rgba(56,189,248,0.18)" strokeWidth="0.5" strokeDasharray="1 5" strokeLinecap="round" />

            {/* ── New Brain (shifted +30 to vertically center within 320x320 viewBox) ── */}
            <g transform="translate(0 30)">
              {/* Soft background fill */}
              <path
                d="M153 48 C132 24 92 30 79 58 C48 63 35 91 47 116 C23 138 35 176 65 184 C68 219 111 235 153 207 Z"
                fill="url(#brainSoftFill)"
                opacity="0.85"
              />
              <path
                d="M167 48 C188 24 228 30 241 58 C272 63 285 91 273 116 C297 138 285 176 255 184 C252 219 209 235 167 207 Z"
                fill="url(#brainSoftFill)"
                opacity="0.85"
              />

              {/* Outer lobes with glow */}
              <g filter="url(#brainGlow)" stroke="url(#brainStroke)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <path d="M153 48 C132 24 92 30 79 58 C48 63 35 91 47 116 C23 138 35 176 65 184 C68 219 111 235 153 207" />
                <path d="M167 48 C188 24 228 30 241 58 C272 63 285 91 273 116 C297 138 285 176 255 184 C252 219 209 235 167 207" />
                {/* Center fissure split into two segments — skips the wolf face/jaw area */}
                <path d="M160 45 L160 78" opacity="0.9" />
                <path d="M160 188 L160 218" opacity="0.9" />
                <path d="M151 55 C156 68 156 86 151 102" opacity="0.55" />
                <path d="M169 55 C164 68 164 86 169 102" opacity="0.55" />
              </g>

              {/* Inner grooves */}
              <g
                stroke="#38BDF8"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity="0.78"
              >
                {/* left upper */}
                <path d="M130 61 C108 61 92 72 88 91" />
                <path d="M137 78 C115 82 104 96 102 112" />
                <path d="M112 72 C104 82 103 92 111 101" />
                <path d="M81 91 C69 101 69 116 82 124" />
                {/* left middle */}
                <path d="M58 132 C78 123 101 126 116 140" />
                <path d="M83 149 C103 144 126 150 138 166" />
                <path d="M67 171 C92 169 113 179 127 195" />
                {/* left lower */}
                <path d="M101 202 C117 201 135 194 148 181" />
                <path d="M76 184 C86 194 101 200 116 198" />
                {/* right upper */}
                <path d="M190 61 C212 61 228 72 232 91" />
                <path d="M183 78 C205 82 216 96 218 112" />
                <path d="M208 72 C216 82 217 92 209 101" />
                <path d="M239 91 C251 101 251 116 238 124" />
                {/* right middle */}
                <path d="M262 132 C242 123 219 126 204 140" />
                <path d="M237 149 C217 144 194 150 182 166" />
                <path d="M253 171 C228 169 207 179 193 195" />
                {/* right lower */}
                <path d="M219 202 C203 201 185 194 172 181" />
                <path d="M244 184 C234 194 219 200 204 198" />
              </g>

              {/* Neural nodes */}
              <g fill="#7DD3FC" opacity="0.9">
                <circle cx="88" cy="91" r="3" />
                <circle cx="102" cy="112" r="2.6" />
                <circle cx="116" cy="140" r="2.6" />
                <circle cx="138" cy="166" r="2.6" />
                <circle cx="232" cy="91" r="3" />
                <circle cx="218" cy="112" r="2.6" />
                <circle cx="204" cy="140" r="2.6" />
                <circle cx="182" cy="166" r="2.6" />
              </g>

            </g>

            {/* ── Wolf — integrated in the brain's negative-space rect ── */}
            {/* Negative-space rect (after brain translate +30): x=118-202, y=106-216, center (160, 161).
                Wolf head bbox (4,4)-(144,149), center (74, 76.5).
                Matrix(0.55 0 0 0.55 119.3 118.925) places head center exactly at (160, 161). */}
            <g className="dist-brain-wolf" transform="matrix(0.55 0 0 0.55 119.3 118.925)" filter="url(#wolf-glow)">
              <path
                fill="rgba(2,6,23,0.55)"
                stroke="#FFC58A"
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
                fillRule="evenodd"
                d="M 16.0 5.0 L 16.0 46.0 L 21.0 63.0 L 27.0 59.0 L 24.0 27.0 L 41.0 53.0 L 35.0 53.0 L 36.0 69.0 L 28.0 63.0 L 8.0 80.0 L 17.0 85.0 L 4.0 103.0 L 14.0 102.0 L 14.0 112.0 L 31.0 111.0 L 28.0 101.0 L 40.0 111.0 L 41.0 106.0 L 50.0 112.0 L 49.0 125.0 L 62.0 149.0 L 63.0 142.0 L 71.0 138.0 L 62.0 126.0 L 64.0 122.0 L 85.0 123.0 L 77.0 137.0 L 84.0 141.0 L 86.0 149.0 L 98.0 127.0 L 96.0 111.0 L 106.0 106.0 L 108.0 110.0 L 119.0 101.0 L 116.0 111.0 L 134.0 112.0 L 132.0 103.0 L 144.0 103.0 L 130.0 85.0 L 139.0 80.0 L 119.0 63.0 L 111.0 69.0 L 113.0 53.0 L 106.0 53.0 L 123.0 27.0 L 120.0 59.0 L 126.0 64.0 L 131.0 44.0 L 130.0 4.0 L 88.0 41.0 L 59.0 41.0 Z M 51.0 137.0 L 56.0 163.0 L 64.0 173.0 L 64.0 172.0 L 66.0 171.0 L 72.0 177.0 L 74.0 178.0 L 76.0 177.0 L 81.0 172.0 L 83.0 173.0 L 89.0 167.0 L 92.0 162.0 L 92.0 159.0 L 93.0 158.0 L 93.0 153.0 L 94.0 152.0 L 94.0 148.0 L 95.0 147.0 L 96.0 138.0 L 94.0 142.0 L 94.0 145.0 L 91.0 150.0 L 90.0 155.0 L 87.0 160.0 L 85.0 159.0 L 83.0 153.0 L 82.0 157.0 L 81.0 158.0 L 81.0 161.0 L 79.0 164.0 L 68.0 164.0 L 67.0 163.0 L 67.0 159.0 L 66.0 158.0 L 65.0 153.0 L 62.0 160.0 L 61.0 160.0 L 59.0 158.0 L 58.0 154.0 L 56.0 151.0 L 55.0 146.0 L 53.0 143.0 L 52.0 138.0 Z M 110.0 82.0 L 110.0 83.0 L 109.0 84.0 L 109.0 86.0 L 108.0 87.0 L 108.0 89.0 L 107.0 90.0 L 107.0 91.0 L 106.0 92.0 L 105.0 95.0 L 103.0 97.0 L 101.0 97.0 L 100.0 98.0 L 95.0 98.0 L 94.0 99.0 L 91.0 100.0 L 91.0 101.0 L 90.0 102.0 L 89.0 102.0 L 87.0 104.0 L 86.0 104.0 L 85.0 103.0 L 85.0 101.0 L 86.0 100.0 L 86.0 96.0 L 89.0 93.0 L 90.0 93.0 L 92.0 91.0 L 93.0 91.0 L 95.0 89.0 L 96.0 89.0 L 98.0 87.0 L 99.0 87.0 L 104.0 83.0 L 105.0 83.0 L 108.0 81.0 L 109.0 81.0 Z M 38.0 82.0 L 39.0 81.0 L 42.0 82.0 L 44.0 84.0 L 45.0 84.0 L 47.0 86.0 L 48.0 86.0 L 50.0 88.0 L 51.0 88.0 L 53.0 90.0 L 54.0 90.0 L 56.0 92.0 L 57.0 92.0 L 59.0 94.0 L 60.0 94.0 L 61.0 95.0 L 61.0 98.0 L 62.0 99.0 L 62.0 103.0 L 61.0 104.0 L 60.0 104.0 L 55.0 99.0 L 52.0 99.0 L 51.0 98.0 L 47.0 98.0 L 46.0 97.0 L 45.0 97.0 L 42.0 94.0 L 42.0 93.0 L 40.0 90.0 L 40.0 88.0 L 38.0 85.0 Z M 28.0 116.0 L 31.0 117.0 L 33.0 119.0 L 34.0 119.0 L 36.0 121.0 L 37.0 121.0 L 37.0 119.0 L 36.0 118.0 L 36.0 116.0 L 34.0 113.0 L 32.0 113.0 L 30.0 115.0 L 29.0 115.0 Z M 119.0 116.0 L 118.0 115.0 L 117.0 115.0 L 115.0 113.0 L 113.0 113.0 L 113.0 114.0 L 112.0 115.0 L 112.0 117.0 L 111.0 118.0 L 111.0 120.0 L 110.0 121.0 L 113.0 120.0 L 115.0 118.0 L 116.0 118.0 L 118.0 116.0 Z M 103.0 88.0 L 100.0 89.0 L 98.0 91.0 L 97.0 91.0 L 95.0 93.0 L 94.0 93.0 L 93.0 94.0 L 99.0 94.0 L 100.0 93.0 L 101.0 93.0 L 102.0 92.0 L 102.0 90.0 L 103.0 89.0 Z M 45.0 88.0 L 45.0 90.0 L 46.0 91.0 L 46.0 92.0 L 48.0 94.0 L 54.0 94.0 L 52.0 92.0 L 51.0 92.0 L 49.0 90.0 L 48.0 90.0 Z"
              />
            </g>

            {/* ── Subtle bridges from inner-most neural nodes to wolf edges ── */}
            <g className="dist-brain-bridges" stroke="url(#cyan-orange)" strokeWidth="1" fill="none" strokeDasharray="2 4" strokeLinecap="round">
              {/* From left bottom node (138, 196) toward wolf bottom-left jaw */}
              <path d="M 138 196 Q 145 192, 150 189" />
              {/* From right bottom node (182, 196) toward wolf bottom-right jaw */}
              <path d="M 182 196 Q 175 192, 170 189" />
              {/* From left mid node (116, 170) toward wolf cheek-left */}
              <path d="M 116 170 Q 124 168, 130 167" />
              {/* From right mid node (204, 170) toward wolf cheek-right */}
              <path d="M 204 170 Q 196 168, 190 167" />
            </g>
          </svg>
          {/* Connector line from brain to panel */}
          <div className="dist-core-connector-line" />
          <div className={`dist-core-panel ${aiAutoDistribute ? 'on' : 'off'}`}>
            <div className="dist-core-panel-head">
              <span className="dist-core-panel-title">CLIP FARM {aiAutoDistribute ? 'RUNNING' : 'PAUSED'}</span>
              {aiAutoDistribute ? (
                <span className="dist-core-panel-subtext">
                  {(() => {
                    const syncedCount = clipBank.filter(c => !removedClipIds.has(c.id)).length
                    const scheduledCount = queue ? queue.posts.filter(p => !removedClipIds.has(p.clip.id)).length : 0
                    return `${syncedCount} clip${syncedCount !== 1 ? 's' : ''} synced \u00b7 ${scheduledCount} scheduled \u00b7 learning enabled`
                  })()}
                </span>
              ) : (
                <span className="dist-core-panel-hint">Your queue is safe. Nothing will post until you resume.</span>
              )}
            </div>
            <button
              ref={pillRef}
              className={`dist-core-pill ${aiAutoDistribute ? 'on' : 'off'}`}
              onClick={() => setAiAutoDistribute(prev => !prev)}
              aria-label={aiAutoDistribute ? 'Pause auto-distribute' : 'Resume auto-distribute'}
            >
              <span className="pill-orb" />
              <span className="pill-label">{aiAutoDistribute ? 'Auto-Distribute' : 'Resume Auto-Distribute'}</span>
              <span className="pill-state">{aiAutoDistribute ? 'On' : 'Off'}</span>
            </button>
            <div className="dist-core-panel-stats">
              {(() => {
                const visibleQueuePosts = queue?.posts.filter(p => !removedClipIds.has(p.clip.id)) ?? []
                const nextPost = visibleQueuePosts[0]
                return (
                  <>
                    <div className="dist-core-stat">
                      <span className="stat-label">Next post</span>
                      <span className="stat-value" style={!aiAutoDistribute ? { color: '#FBBF24', opacity: 0.7 } : undefined}>
                        {nextPost
                          ? `Today ${new Date(nextPost.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                          : '\u2014'}
                      </span>
                      <span className="stat-sub" style={!aiAutoDistribute && nextPost ? { color: '#F59E0B', opacity: 0.8, fontStyle: 'italic' } : undefined}>
                        {!aiAutoDistribute && nextPost
                          ? 'Paused'
                          : nextPost
                            ? (PLATFORMS.find(p => p.id === nextPost.platform)?.label
                               ?? (nextPost.platform.charAt(0).toUpperCase() + nextPost.platform.slice(1)))
                            : 'No posts'}
                      </span>
                    </div>
                    <div className="dist-core-stat-divider" />
                    <div className="dist-core-stat">
                      <span className="stat-label">Queue</span>
                      <span className="stat-value" style={!aiAutoDistribute ? { color: '#71717A' } : undefined}>
                        {visibleQueuePosts.length} scheduled
                      </span>
                      <span className="stat-sub" style={!aiAutoDistribute ? { color: 'rgba(245,158,11,0.7)' } : undefined}>
                        {!aiAutoDistribute
                          ? 'Waiting to resume'
                          : (() => {
                              const readyCount = clipBank.filter(c => !removedClipIds.has(c.id) && (c.score ?? 0) >= 60).length - visibleQueuePosts.length
                              return readyCount > 0 ? `+${readyCount} ready next` : ''
                            })()}
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FUNNEL — tight 3-line fan from CLIP FARM panel center down to Clip Bank ═══ */}
      {/* viewBox is 0 0 1316 100; convergence at (660, 100) which after scaleY(-1) becomes top-center */}
      {/* Tight fan (520-800 instead of 90-1230) so lines clearly emerge from the box, not the page edges */}
      <svg className="dist-funnel flipped" viewBox="0 0 1316 100" preserveAspectRatio="none" aria-hidden="true">
        <path className={`dist-flow-path ${aiAutoDistribute ? 'blue' : 'dim'}`} d="M 540 0 C 580 40, 620 70, 660 100" />
        <path className={`dist-flow-path ${aiAutoDistribute ? 'blue' : 'dim'}`} d="M 660 0 L 660 100" />
        <path className={`dist-flow-path ${aiAutoDistribute ? 'blue' : 'dim'}`} d="M 780 0 C 740 40, 700 70, 660 100" />
        {aiAutoDistribute && (
          <>
            <circle r="3" fill="#38BDF8" opacity=".9"><animateMotion dur="2.5s" repeatCount="indefinite" path="M 540 0 C 580 40, 620 70, 660 100" /></circle>
            <circle r="3" fill="#38BDF8" opacity=".9"><animateMotion dur="2.8s" begin="0.5s" repeatCount="indefinite" path="M 780 0 C 740 40, 700 70, 660 100" /></circle>
          </>
        )}
      </svg>

      {/* ═══ CLIP BANK ═══ */}
      <ClipBankRail
        clipBank={clipBank}
        removedClipIds={removedClipIds}
        selectedClipId={selectedClipId}
        brokenThumbs={brokenThumbs}
        bankLoading={bankLoading}
        queue={queue}
        hasAnyProgress={hasAnyProgress}
        publishProgress={publishProgress as Record<string, { status: string }>}
        isOn={aiAutoDistribute}
        highlightClipId={bankHighlightClipId}
        onSelect={(id) => { setSelectedClipId(id); resetPublishProgress(); setPublishDone(false); setPublishSteps([]) }}
        onRemove={(id) => {
          setRemovedClipIds(prev => { const next = new Set(prev); next.add(id); return next })
          if (selectedClipId === id) setSelectedClipId(null)
        }}
        onThumbError={(id) => setBrokenThumbs(prev => { const next = new Set(prev); next.add(id); return next })}
        onBrowse={() => router.push('/dashboard')}
        onUpload={() => router.push('/dashboard?tab=upload')}
        onScrollToToggle={() => {
          pillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          pillRef.current?.classList.add('dist-pill-pulse-highlight')
          setTimeout(() => pillRef.current?.classList.remove('dist-pill-pulse-highlight'), 2000)
        }}
        onQuickPublish={(id) => {
          setSelectedClipId(id)
          resetPublishProgress()
          setPublishDone(false)
          setPublishSteps([])
          document.getElementById('publish-strip')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          setTimeout(() => setShowPlatformPicker(true), 600)
        }}
      />


      {/* ═══ SMART QUEUE — AI Schedule ═══ */}
      {(() => {
        // Coherence rules:
        // 1. AI Schedule must match the visible Clip Bank (after user removes clips via X)
        // 2. If visible bank is empty → no schedule (nothing to schedule)
        // 3. If a queue post points to a removed clip → filter it out
        const visibleBankCount = clipBank.filter(c => !removedClipIds.has(c.id)).length
        const filteredQueuePosts = queue?.posts.filter(p => !removedClipIds.has(p.clip.id)) ?? []
        if (visibleBankCount === 0 || filteredQueuePosts.length === 0) return null
        const visiblePosts = filteredQueuePosts.slice(0, 3)
        let consecutiveWildcards = 0
        let hasBackToBackWildcards = false
        for (const p of visiblePosts) {
          if (p.riskLevel === 'wildcard') {
            consecutiveWildcards++
            if (consecutiveWildcards >= 2) hasBackToBackWildcards = true
          } else {
            consecutiveWildcards = 0
          }
        }
        const provenInBank = clipBank.some(c => (c.score ?? 0) >= 70)

        // Emotional mix actionable suggestion
        const mixData = queue ? EMOTIONAL_MIX_STYLES[queue.emotionalMix] : null
        const mixSuggestion = queue?.emotionalMix === 'repetitive'
          ? 'Swap one wildcard for a different mood'
          : queue?.emotionalMix === 'moderate'
          ? 'Add a different mood for stronger contrast'
          : null  // diverse → no suggestion

        // Smart reach display — never "0 — 0"
        const totalReachLow = queue?.totalEstReach?.low ?? 0
        const totalReachHigh = queue?.totalEstReach?.high ?? 0
        const hasRealReach = totalReachLow > 0 || totalReachHigh > 0
        const reachText = hasRealReach
          ? `${formatReach(totalReachLow)} — ${formatReach(totalReachHigh)}`
          : 'learning'

        return (
        <div className="dist-glass dist-schedule" style={!aiAutoDistribute ? { opacity: 0.7 } : undefined}>
          <div className="dist-sched-head">
            <h3>
              <Calendar size={15} style={{ color: aiAutoDistribute ? '#7DD3FC' : '#71717A' }} />
              Next up — AI Schedule
              <span className="dist-smart-pill" style={!aiAutoDistribute ? { background: 'rgba(63,63,70,0.4)', color: '#71717A', borderColor: 'rgba(63,63,70,0.5)' } : undefined}>
                {aiAutoDistribute ? 'Smart' : 'Paused'}
              </span>
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="dist-ghost-btn">Show all</button>
            </div>
          </div>

          {/* Paused-state reassurance — explains the queue is safe and what to do */}
          {!aiAutoDistribute && (
            <div style={{
              fontSize: 11,
              color: '#FBBF24',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.18)',
              padding: '8px 12px',
              borderRadius: 8,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <Pause size={11} />
              <span>
                <strong>{filteredQueuePosts.length} {filteredQueuePosts.length === 1 ? 'post is' : 'posts are'} ready</strong> but won&apos;t publish until auto-distribute is resumed.
              </span>
            </div>
          )}

          {/* Wildcard sequencing warning */}
          {hasBackToBackWildcards && (
            <div className="dist-sched-warning">
              <AlertCircle size={12} />
              {provenInBank
                ? 'Two wildcards in a row — consider reordering to Proven → Wildcard → Proven.'
                : 'Two wildcards in a row — no proven clips available in bank.'}
            </div>
          )}

          <div className="dist-sched-list">
            {visiblePosts.map((post, idx) => {
              const time = post.scheduledAt
              const timeStr = time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0')
              const isToday = time.toDateString() === new Date().toDateString()
              const dayLabel = isToday ? 'Today' : 'Tomorrow'
              const diffMs = time.getTime() - Date.now()
              const inHours = Math.floor(diffMs / 3600000)
              const inMins = Math.floor((diffMs % 3600000) / 60000)
              const inLabel = diffMs > 0 ? `in ${inHours}h ${inMins.toString().padStart(2, '0')}min` : 'now'
              const fitScore = post.breakoutProbability

              // CTA tier by AI Fit
              const ctaTier =
                fitScore >= 70 ? 'primary' :
                fitScore >= 50 ? 'secondary' :
                'weak'
              const fitClass = fitScore >= 70 ? '' : fitScore >= 50 ? 'mid' : 'low'

              const hasThumb = !!post.clip.thumbnailUrl

              return (
                <div key={`${post.clip.id}-${idx}`} className={[
                  'dist-post-card',
                  post.riskLevel === 'wildcard' ? 'wildcard' : '',
                  !hasThumb ? 'no-thumb' : '',
                ].filter(Boolean).join(' ')} style={!aiAutoDistribute ? { opacity: 0.75 } : undefined}>
                  <div className="dist-pc-time">
                    <div className="hh" style={!aiAutoDistribute ? { color: '#FBBF24' } : undefined}>{timeStr}</div>
                    <div className="day">{dayLabel}</div>
                    <div className="in" style={!aiAutoDistribute ? { color: 'rgba(245,158,11,0.7)', fontStyle: 'italic' } : undefined}>
                      {!aiAutoDistribute ? `${inLabel} (paused)` : inLabel}
                    </div>
                  </div>

                  {hasThumb ? (
                    <div className="dist-pc-thumb" style={{ backgroundImage: `url(${post.clip.thumbnailUrl})`, backgroundSize: 'cover' }} />
                  ) : (
                    <div className="dist-pc-thumb dist-pc-thumb-empty">
                      <Film size={14} />
                      <span>Preview unavailable</span>
                    </div>
                  )}

                  <div className="dist-pc-info">
                    <div className="dist-pc-title">{post.clip.title}</div>
                    <div className="dist-pc-meta">
                      <span className="dist-pl-badge">
                        {PLATFORM_LABELS_MAP[post.platform] ?? post.platform}
                      </span>
                      <span className={`dist-risk-pill ${post.riskLevel}`}>
                        {post.riskLevel === 'proven' ? '✓ Proven' : '◇ Wildcard'}
                      </span>
                      {post.slotQuality === 'prime' && <span className="dist-pc-prime">⚡ Prime time</span>}
                    </div>
                    <div className="dist-pc-reason">
                      <Target size={11} style={{ color: 'rgba(125,211,252,.7)', flexShrink: 0 }} />
                      <span><span className="why">Why:</span> {post.explanation}</span>
                    </div>
                  </div>

                  <div className={`dist-pc-fit ${fitClass}`}>
                    <div className="fit-num">{fitScore}%</div>
                    <div className="fit-lbl">AI Fit</div>
                    <div className="fit-bar"><span style={{ width: `${fitScore}%` }} /></div>
                  </div>

                  <div className="dist-pc-actions">
                    {ctaTier === 'primary' && (
                      <button
                        className="dist-pc-cta primary"
                        onClick={() => { setSelectedClipId(post.clip.id); handlePublish() }}
                        disabled={!aiAutoDistribute}
                        title={!aiAutoDistribute ? 'Turn on AUTO-DISTRIBUTE to enable scheduled posts' : undefined}
                        style={!aiAutoDistribute ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                      >
                        <Send size={12} /> Post now
                      </button>
                    )}
                    {ctaTier === 'secondary' && (
                      <button className="dist-pc-cta secondary" onClick={() => setSelectedClipId(post.clip.id)} disabled={!aiAutoDistribute} style={!aiAutoDistribute ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
                        Review
                      </button>
                    )}
                    {ctaTier === 'weak' && (
                      <button className="dist-pc-cta weak" onClick={() => setSelectedClipId(post.clip.id)} disabled={!aiAutoDistribute} style={!aiAutoDistribute ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
                        <RefreshCw size={11} /> Reschedule
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="dist-sched-foot" style={!aiAutoDistribute ? { opacity: 0.6 } : undefined}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              {filteredQueuePosts.length > 3 && <span><strong>+{filteredQueuePosts.length - 3}</strong> more scheduled</span>}
              <span>
                {!aiAutoDistribute && <span style={{ color: '#FBBF24', marginRight: 4 }}>Paused ·</span>}
                Emotional mix:{' '}
                <strong className={`dist-mix-${queue?.emotionalMix ?? 'diverse'}`}>{mixData?.label ?? 'Mixed'}</strong>
                {mixSuggestion && <span className="dist-mix-suggestion"> · {mixSuggestion}</span>}
              </span>
              <span className="dist-sched-reach">
                {!aiAutoDistribute
                  ? <>Est. reach: <strong>{reachText}</strong> <span style={{ color: '#A1A1AA', fontStyle: 'italic' }}>if resumed</span></>
                  : <>Est. reach: <strong>{reachText}</strong></>}
              </span>
            </div>
          </div>
        </div>
        )
      })()}

      {/* ═══ BOTTOM ROW ═══ */}
      {/* Collapsed into single compact card when both sections are empty */}
      {publishHistory.length === 0 && persistentStats.totalClipsPublished < 2 ? (
        <div className="dist-glass" style={{ padding: '16px 20px' }}>
          <div className="dist-section-label" style={{ marginBottom: 10 }}>
            <span className="dist-accent-bar" style={{ background: '#7DD3FC', boxShadow: '0 0 8px rgba(125,211,252,.4)' }} />
            System status
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--va-text-dim)' }}>
            <span>No recent activity</span>
            <span style={{ color: 'rgba(148,163,184,.5)' }}>&middot;</span>
            <span>{persistentStats.totalClipsPublished} clip{persistentStats.totalClipsPublished !== 1 ? 's' : ''} analyzed &middot; AI learning from your patterns</span>
          </div>
        </div>
      ) : (
      <div className="dist-grid-2-bottom">
        {/* Recent Activity */}
        <div className="dist-glass dist-activity">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="dist-section-label">
              <span className="dist-accent-bar" style={{ background: '#4ADE80', boxShadow: '0 0 8px rgba(74,222,128,.5)' }} />
              Recent activity
            </div>
            <div style={{ fontSize: 11, color: 'var(--va-text-dim)' }}>last 24h</div>
          </div>
          {publishHistory.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--va-text-dim)', padding: '8px 0' }}>No recent activity</p>
          ) : (
            publishHistory.map((entry, i) => (
              <div key={i} className="dist-act-row">
                <div className="dist-act-dot" style={entry.status === 'error' ? { background: '#F87171', boxShadow: '0 0 6px #F87171' } : {}} />
                <div className="title">{entry.clipTitle}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {entry.platforms.map(pid => {
                    const p = PLATFORMS.find(pl => pl.id === pid)
                    return p ? <span key={pid} style={{ fontSize: 12 }} title={p.label}>{p.icon}</span> : null
                  })}
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {entry.views > 0 && <div className="perf">+{formatMetricCount(entry.views)} views</div>}
                  <div className="when">{getRelativeTime(entry.timestamp)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* AI Learning */}
        <div className="dist-glass dist-learning">
          <div className="dist-section-label">
            <span className="dist-accent-bar" style={{ background: '#C4B5FD', boxShadow: '0 0 8px rgba(196,181,253,.5)' }} />
            AI is learning
          </div>
          <div className="dist-learning-list">
            {persistentStats.totalClipsPublished >= 2 ? (() => {
              const ww = getWhatWorkedSummary(persistentStats)
              return (
                <>
                  {ww.topTone && (
                    <div className="dist-learn-item">
                      <span className="dist-learn-bullet" />
                      <span><strong>{ww.topTone.name} tone</strong> outperforms by <strong>+{ww.topTone.performanceVsAvg}%</strong>. <span className="muted">Boosting weight.</span></span>
                    </div>
                  )}
                  {ww.topPlatform && (
                    <div className="dist-learn-item">
                      <span className="dist-learn-bullet" />
                      <span><strong>{ww.topPlatform.name}</strong> performs <strong>{ww.topPlatform.multiplierVsOthers}x</strong> vs others. <span className="muted">Prioritized.</span></span>
                    </div>
                  )}
                  <div className="dist-learn-item">
                    <span className="dist-learn-bullet" />
                    <span>{ww.recommendation} <span className="muted">Learning applied.</span></span>
                  </div>
                </>
              )
            })() : (
              <>
                <div className="dist-learn-item">
                  <span className="dist-learn-bullet" />
                  <span>Publish clips to start building your AI distribution profile. <span className="muted">Need 2+ clips.</span></span>
                </div>
                <div className="dist-learn-item">
                  <span className="dist-learn-bullet" />
                  <span>AI learns your <strong>best times</strong>, <strong>tones</strong>, and <strong>platforms</strong>. <span className="muted">Automatic.</span></span>
                </div>
              </>
            )}
          </div>
          <div className="dist-learning-footer">
            <span className="dist-learning-badge">{persistentStats.totalClipsPublished} clip{persistentStats.totalClipsPublished !== 1 ? 's' : ''} analyzed</span>
          </div>
        </div>
      </div>
      )}

      {/* ═══ CLIP PICKER MODAL ═══ */}
      {showClipPicker && (
        <ClipPickerModal
          clipBank={clipBank}
          selectedClipId={selectedClipId}
          brokenThumbs={brokenThumbs}
          removedClipIds={removedClipIds}
          onSelectClip={setSelectedClipId}
          onClose={() => setShowClipPicker(false)}
          onBrokenThumb={(id) => setBrokenThumbs(prev => { const next = new Set(prev); next.add(id); return next })}
        />
      )}

      {/* ═══ PLATFORM PICKER MODAL ═══ */}
      {showPlatformPicker && (
        <PlatformPickerModal
          platforms={PLATFORMS}
          connectedPlatforms={connectedPlatforms}
          publishTargets={publishTargets}
          togglePublishTarget={togglePublishTarget}
          selectedClip={selectedClip}
          activePlatformCount={activePlatformCount}
          publishSequenceActive={publishSequenceActive}
          onClose={() => setShowPlatformPicker(false)}
          onPublish={handlePublish}
        />
      )}

    </div>
  )
}
