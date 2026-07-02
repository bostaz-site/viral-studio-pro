'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  BarChart3, TrendingUp, Lock, ExternalLink, ArrowRight, Trophy,
  Flame, Film, RefreshCw, ChevronRight, AlertCircle, Clock, Target,
  Zap, CheckCircle2, Circle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAccountStore } from '@/stores/account-store'
import { CREATOR_RANK_CONFIG, type CreatorRank } from '@/lib/scoring/account-scorer'
import { loadPersistentStats, type PersistentStats } from '@/lib/distribution/session-persistence'
import { createClient } from '@/lib/supabase/client'
import { useQueueStore } from '@/stores/queue-store'
import { CreatorRankHero } from './creator-rank-hero'
import { InsightBarChart } from './charts/insight-bar-chart'
import { PostingHeatmap } from './charts/posting-heatmap'
import { PageHeader } from '@/components/dashboard/page-header'
import {
  getConfidenceLevel, getConfidenceLabel,
  getMinPostsForInsight,
  type ConfidenceLevel, type AccountBreakdown,
  type LearnedDistributionProfile, type LearnedInsight,
} from '@/types/learning'

/* ─── Platform display config ─── */

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
}

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '\u266A',
  youtube: '\u25B6',
  instagram: '\u25CE',
}

const PLATFORM_GRADIENTS: Record<string, string> = {
  tiktok: 'from-zinc-900 to-zinc-700',
  youtube: 'from-red-600 to-red-500',
  instagram: 'from-pink-600 to-purple-600',
}

/* ─── Confidence badge colors ─── */

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { bg: string; text: string; border: string }> = {
  none: { bg: 'bg-zinc-800/50', text: 'text-zinc-500', border: 'border-zinc-700' },
  collecting: { bg: 'bg-zinc-800/50', text: 'text-zinc-400', border: 'border-zinc-600' },
  early: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  medium: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  high: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
}

/* ─── Influence stages ─── */
const INFLUENCE_STAGES = [
  { min: 0, max: 4, label: 'Ignored', desc: 'Need 5 tracked posts' },
  { min: 5, max: 14, label: 'Soft hint', desc: '30% influence on queue' },
  { min: 15, max: 29, label: 'Strong influence', desc: '70% influence on queue' },
  { min: 30, max: Infinity, label: 'Full reorder', desc: '100% influence on queue' },
]

/* ─── Types ─── */

interface TopClip {
  id: string
  title: string
  score: number | null
  thumbnailUrl: string | null
  source: string
  createdAt: string
}

interface SocialAccountRow {
  id: string
  platform: string
  username: string | null
  creator_score: number | null
  creator_rank: string | null
  last_synced_at?: string | null
}

function formatTimeAgo(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  return `${Math.floor(diffMin / 1440)}d ago`
}

/* ─── Main Component ─── */

/* ─── CSS for animations ─── */
function AnalyticsStyles() {
  return (
    <style jsx global>{`
      @keyframes analytics-stripe {
        0% { background-position: 0 0; }
        100% { background-position: 28px 0; }
      }
      .analytics-stripe-bar {
        background-image: linear-gradient(
          -45deg,
          rgba(255,255,255,0.08) 25%, transparent 25%,
          transparent 50%, rgba(255,255,255,0.08) 50%,
          rgba(255,255,255,0.08) 75%, transparent 75%
        );
        background-size: 28px 28px;
        animation: analytics-stripe 1.2s linear infinite;
      }
      .analytics-card-hover {
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .analytics-card-hover:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 20px rgba(56,189,248,0.12);
      }
      @media (prefers-reduced-motion: reduce) {
        .analytics-stripe-bar { animation: none; }
        .analytics-card-hover { transition: none; }
        .analytics-card-hover:hover { transform: none; }
        .animate-in { animation: none !important; }
      }
    `}</style>
  )
}

export function AnalyticsDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<PersistentStats | null>(null)
  const [topClips, setTopClips] = useState<TopClip[]>([])
  const [clipsLoading, setClipsLoading] = useState(true)
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccountRow[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [profile, setProfile] = useState<LearnedDistributionProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const { score: accountScore, fetchAccountScore, syncAccount, syncing, canSyncToday, lastSyncedAt } = useAccountStore()
  const { applyAdjustment, isAdjustmentApplied } = useQueueStore()

  useEffect(() => { fetchAccountScore() }, [fetchAccountScore])
  useEffect(() => { setStats(loadPersistentStats()) }, [])

  // Fetch learned profile
  useEffect(() => {
    async function loadProfile() {
      setProfileLoading(true)
      try {
        const res = await fetch('/api/analytics/profile')
        if (res.ok) {
          const json = await res.json()
          if (json.data) setProfile(json.data)
        }
      } catch { /* silent */ }
      setProfileLoading(false)
    }
    loadProfile()
  }, [])

  // Fetch connected accounts
  useEffect(() => {
    async function loadAccounts() {
      setAccountsLoading(true)
      try {
        const res = await fetch('/api/social-accounts')
        const json = await res.json()
        if (json.data) setConnectedAccounts(json.data)
      } catch { /* silent */ }
      setAccountsLoading(false)
    }
    loadAccounts()
  }, [])

  // Fetch top clips (post history)
  useEffect(() => {
    async function loadTopClips() {
      setClipsLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setClipsLoading(false); return }

      const { data: jobs } = await supabase
        .from('render_jobs')
        .select('clip_id, source, created_at')
        .eq('user_id', user.id)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!jobs || jobs.length === 0) { setClipsLoading(false); return }

      const trendingIds = jobs.filter(j => j.source !== 'upload').map(j => j.clip_id)
      const trendingMap: Record<string, { title: string; score: number | null; thumb: string | null }> = {}

      if (trendingIds.length > 0) {
        const { data } = await supabase
          .from('trending_clips')
          .select('id, title, velocity_score, thumbnail_url')
          .in('id', trendingIds)
        if (data) {
          for (const c of data) {
            trendingMap[c.id] = {
              title: c.title || 'Untitled',
              score: c.velocity_score ? Math.round(c.velocity_score) : null,
              thumb: c.thumbnail_url,
            }
          }
        }
      }

      const seen = new Map<string, TopClip>()
      for (const j of jobs) {
        if (!seen.has(j.clip_id)) {
          seen.set(j.clip_id, {
            id: j.clip_id,
            title: trendingMap[j.clip_id]?.title || 'Uploaded clip',
            score: trendingMap[j.clip_id]?.score ?? null,
            thumbnailUrl: trendingMap[j.clip_id]?.thumb ?? null,
            source: j.source,
            createdAt: j.created_at ?? new Date().toISOString(),
          })
        }
      }
      setTopClips(Array.from(seen.values()).slice(0, 20))
      setClipsLoading(false)
    }
    loadTopClips()
  }, [])

  // ── Derived state ──
  const totalPublished = stats?.totalClipsPublished ?? 0
  const trackedPosts = profile?.totalPostsAnalyzed ?? 0
  const confidence = getConfidenceLevel(trackedPosts)
  const confidenceLabel = getConfidenceLabel(confidence)
  const confidenceStyle = CONFIDENCE_STYLES[confidence]
  const minPosts = getMinPostsForInsight()
  const profileConfidence = profile?.confidence ?? 'none'
  const hasRealInsights = profile !== null && (profileConfidence === 'early' || profileConfidence === 'medium' || profileConfidence === 'high')
  const accountCount = connectedAccounts.length
  const currentStreak = stats?.currentStreak ?? 0

  const hasYouTube = accountScore !== null && (accountScore.creator_score ?? 0) > 0
  const creatorRank: CreatorRank = accountScore?.creator_rank ?? 'scout'
  const creatorScore = accountScore?.creator_score ?? 0

  const syncAgo = lastSyncedAt
    ? (() => {
        const diffMin = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 60000)
        if (diffMin < 60) return `${diffMin}m ago`
        if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
        return `${Math.floor(diffMin / 1440)}d ago`
      })()
    : null

  const syncStale = lastSyncedAt
    ? (Date.now() - new Date(lastSyncedAt).getTime()) > 7 * 24 * 60 * 60 * 1000
    : false

  // Build working/not-working insights from profile
  const workingInsights: LearnedInsight[] = []
  const notWorkingInsights: LearnedInsight[] = []

  if (profile) {
    for (const [platform, moods] of Object.entries(profile.bestMoodsByPlatform)) {
      for (const m of moods) {
        if (m.multiplier >= 1.2) {
          workingInsights.push({ platform, pattern: `${m.mood} clips`, multiplier: m.multiplier, postCount: m.postCount, confidence: profile.confidence })
        }
      }
    }
    for (const w of profile.bestPostingWindows) {
      if (w.multiplier >= 1.2) {
        workingInsights.push({ platform: w.platform, pattern: `Posts at ${w.startHour}:00\u2013${w.endHour}:00`, multiplier: w.multiplier, postCount: w.postCount, confidence: profile.confidence })
      }
    }
    for (const c of profile.bestCaptionStyles) {
      if (c.multiplier >= 1.2) {
        workingInsights.push({ platform: c.platform, pattern: `${c.style} captions`, multiplier: c.multiplier, postCount: c.postCount, confidence: profile.confidence })
      }
    }
    for (const u of profile.underperformingPatterns) {
      notWorkingInsights.push({ platform: u.platform, pattern: u.pattern, multiplier: -(u.penalty), postCount: u.postCount, confidence: profile.confidence })
    }
  }
  workingInsights.sort((a, b) => b.multiplier - a.multiplier)
  notWorkingInsights.sort((a, b) => a.multiplier - b.multiplier)

  // Next unlock milestone
  const nextUnlock = trackedPosts < 5
    ? { label: "What's Working", target: 5, desc: 'Publish 5 tracked clips to unlock early insights.' }
    : trackedPosts < 15
    ? { label: 'Medium confidence', target: 15, desc: 'Publish more clips to strengthen Smart Queue influence.' }
    : trackedPosts < 30
    ? { label: 'Full learning', target: 30, desc: 'Reach 30 tracked posts for maximum Smart Queue reorder power.' }
    : null

  // Current influence stage
  const currentStage = INFLUENCE_STAGES.findIndex(s => trackedPosts >= s.min && trackedPosts <= s.max)

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsStyles />

      {/* ─── 0. PAGE HEADER (unified across Browse/Enhance/Distribution/Analytics/Settings) ─── */}
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        subtitle="What's working. What's not. What to change."
        accent="cyan"
      />

      {/* ─── 1. CREATOR RANK HERO ─── */}
      {hasYouTube && (
        <CreatorRankHero
          score={creatorScore}
          rank={creatorRank}
          lastSyncedAt={lastSyncedAt}
          syncing={syncing}
          onSync={async () => {
            await syncAccount()
            try {
              const res = await fetch('/api/analytics/profile?force=true')
              if (res.ok) {
                const json = await res.json()
                if (json.data) setProfile(json.data)
              }
            } catch { /* silent */ }
          }}
          canSyncToday={canSyncToday}
        />
      )}

      {/* ─── 2. NEXT UNLOCK CARD ─── */}
      {nextUnlock ? (
        <Card className="bg-cyan-500/[0.04] border-cyan-500/20 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Target className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider">Next unlock: {nextUnlock.label}</p>
              <p className="text-sm text-foreground/80 mt-0.5">{nextUnlock.desc}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-zinc-800/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-700 analytics-stripe-bar"
                    style={{ width: `${Math.min(100, (trackedPosts / nextUnlock.target) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{trackedPosts} / {nextUnlock.target}</span>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="bg-emerald-500/[0.04] border-emerald-500/20 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300">Full learning active</span>
            <span className="text-[10px] text-muted-foreground">{trackedPosts} tracked posts</span>
          </div>
        </Card>
      )}

      {/* ─── 3. LEARNING STATUS ─── */}
      <Card className="bg-zinc-900/50 backdrop-blur-sm border-border px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs text-foreground font-medium">
              {accountCount} account{accountCount !== 1 ? 's' : ''} connected
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">{trackedPosts} tracked post{trackedPosts !== 1 ? 's' : ''}</span>
          {currentStreak >= 3 && (
            <span className="text-[10px] text-orange-400 font-medium flex items-center gap-0.5">
              <Flame className="h-2.5 w-2.5" />{currentStreak}-day streak
            </span>
          )}
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', confidenceStyle.bg, confidenceStyle.text, confidenceStyle.border)}>
            {confidenceLabel}
          </span>
          {syncAgo && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> {syncAgo}
              {syncStale && <span className="text-amber-400 font-medium ml-1">Sync recommended</span>}
            </span>
          )}
          {accountCount === 0 && !accountsLoading && (
            <button onClick={() => router.push('/settings')} className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium ml-auto">
              Connect account <ChevronRight className="h-2.5 w-2.5 inline" />
            </button>
          )}
          {accountCount > 0 && totalPublished === 0 && (
            <button onClick={() => router.push('/dashboard/distribution')} className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium ml-auto">
              Open Distribution <ChevronRight className="h-2.5 w-2.5 inline" />
            </button>
          )}
        </div>
      </Card>

      {/* ─── 4. SMART QUEUE ADJUSTMENTS (promoted) ─── */}
      <div className="animate-in fade-in duration-500" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
          <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
          Smart Queue adjustments
        </h2>

        {hasRealInsights && profile && profile.adjustments.length > 0 ? (
          <div className="space-y-2.5">
            {profile.adjustments.map((adj, i) => (
              <Card key={i} className="border-l-4 border-l-cyan-500 bg-cyan-500/[0.03] px-5 py-4 analytics-card-hover">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium">{adj.change}</p>
                    <p className="text-xs text-foreground/70 mt-1">{adj.reason}</p>
                    <span className={cn(
                      'inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border mt-2',
                      CONFIDENCE_STYLES[adj.confidence].bg, CONFIDENCE_STYLES[adj.confidence].text, CONFIDENCE_STYLES[adj.confidence].border,
                    )}>
                      {getConfidenceLabel(adj.confidence)}
                    </span>
                  </div>
                  {isAdjustmentApplied(adj.change) ? (
                    <span className="flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/12 border border-emerald-500/25 text-emerald-400">
                      Applied
                    </span>
                  ) : (
                    <button
                      onClick={() => applyAdjustment(adj.change)}
                      className="flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-cyan-500/12 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all"
                    >
                      Apply
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-card/60 border-border px-5 py-5" style={{ maxHeight: 180 }}>
            <div className="flex items-start gap-3">
              <Zap className="h-4 w-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-foreground/80 font-medium">No adjustments yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Smart Queue starts adapting after {minPosts} tracked posts. Each publish sharpens the system.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ─── 5. SMART QUEUE INFLUENCE INDICATOR ─── */}
      <Card className="bg-card/60 border-border px-5 py-4">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">Distribution Learning Impact</h3>
        <div className="flex items-center gap-1 mb-2">
          {INFLUENCE_STAGES.map((stage, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className={cn(
                'h-2 w-full rounded-full transition-all',
                i <= currentStage ? 'bg-cyan-500' : 'bg-zinc-800/60',
                i === currentStage && 'ring-1 ring-cyan-400/40',
              )} />
              <span className={cn(
                'text-[9px] font-medium',
                i <= currentStage ? 'text-cyan-400' : 'text-zinc-600',
              )}>
                {stage.label}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Currently: <strong className="text-foreground">{INFLUENCE_STAGES[currentStage >= 0 ? currentStage : 0].label}</strong>
          {' \u2014 '}{INFLUENCE_STAGES[currentStage >= 0 ? currentStage : 0].desc}
        </p>
      </Card>

      {/* ─── 6. WHAT'S WORKING ─── */}
      <div className="animate-in fade-in duration-500" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          What&apos;s working
        </h2>

        {hasRealInsights && workingInsights.length > 0 ? (
          <Card className="bg-card/60 border-border p-5">
            {workingInsights[0] && (
              <div className="mb-4 p-3 rounded-lg border border-cyan-500/25 bg-cyan-500/[0.04] analytics-card-hover" style={{ boxShadow: '0 0 12px rgba(56,189,248,0.08)' }}>
                <span className="text-[9px] uppercase tracking-wider font-bold text-cyan-400 mb-1 block">Top insight</span>
                <p className="text-sm text-foreground">
                  <strong>{PLATFORM_LABELS[workingInsights[0].platform] ?? workingInsights[0].platform}</strong>{' '}
                  {workingInsights[0].pattern} {'\u2192'}{' '}
                  <span className="font-bold text-cyan-300">{workingInsights[0].multiplier}x</span> above your average
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Based on {workingInsights[0].postCount} posts</p>
              </div>
            )}
            <InsightBarChart
              title="Performance by pattern"
              data={workingInsights.slice(0, 6).map(i => ({
                label: i.pattern,
                multiplier: i.multiplier,
                postCount: i.postCount,
                platform: PLATFORM_LABELS[i.platform] ?? i.platform,
              }))}
            />
          </Card>
        ) : (
          <Card className="bg-card/60 border-border px-5 py-5" style={{ maxHeight: 220 }}>
            <p className="text-xs text-foreground/60 font-medium mb-3">What we'll detect:</p>
            <div className="space-y-2">
              {[
                { icon: Flame, text: 'Best moods \u2014 which clip tones outperform your average' },
                { icon: BarChart3, text: 'Best platforms \u2014 which platform amplifies your style' },
                { icon: Film, text: 'Best formats \u2014 short clips, specific captions, hooks that retain' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <item.icon className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-3">Publish {Math.max(0, minPosts - trackedPosts)} more tracked clip{minPosts - trackedPosts !== 1 ? 's' : ''} to unlock</p>
          </Card>
        )}
      </div>

      {/* ─── 7. BEST POSTING TIMES ─── */}
      <div className="animate-in fade-in duration-500" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
          <Clock className="h-3.5 w-3.5 text-cyan-400" />
          Best posting times
        </h2>

        {hasRealInsights && profile && profile.bestPostingWindows.length > 0 ? (
          <Card className="bg-card/60 border-border p-5">
            <PostingHeatmap
              data={profile.bestPostingWindows.map(w => ({
                hour: w.startHour + 1,
                weekday: 0,
                multiplier: w.multiplier,
                postCount: w.postCount,
              }))}
            />
            {profile.bestPostingWindows[0] && (
              <p className="text-xs text-foreground/80 mt-3">
                Best window: <strong>{PLATFORM_LABELS[profile.bestPostingWindows[0].platform] ?? profile.bestPostingWindows[0].platform}</strong>{' '}
                {profile.bestPostingWindows[0].startHour}:00\u2013{profile.bestPostingWindows[0].endHour}:00{' '}
                <span className="text-cyan-400">(+{Math.round((profile.bestPostingWindows[0].multiplier - 1) * 100)}% above average)</span>
              </p>
            )}
          </Card>
        ) : (
          <Card className="bg-card/60 border-border px-5 py-5" style={{ maxHeight: 220 }}>
            <p className="text-xs text-foreground/60 font-medium mb-3">What we need to map your hours:</p>
            <div className="space-y-2">
              {[
                { label: 'Morning (6\u201312h)', icon: Circle },
                { label: 'Afternoon (12\u201318h)', icon: Circle },
                { label: 'Evening (18\u201324h)', icon: Circle },
                { label: 'Late night (0\u20136h)', icon: Circle },
              ].map((w, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <w.icon className="h-3 w-3 text-zinc-700 flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">{w.label}: <span className="text-zinc-600">0 posts</span></span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-3">Post across 3+ time windows to unlock</p>
          </Card>
        )}
      </div>

      {/* ─── 8. WHAT'S NOT WORKING ─── */}
      <div className="animate-in fade-in duration-500" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          What&apos;s not working
        </h2>

        {hasRealInsights && notWorkingInsights.length > 0 ? (
          <div className="space-y-2.5">
            {notWorkingInsights.slice(0, 5).map((insight, i) => (
              <Card key={i} className="border-l-4 border-l-red-500/50 bg-red-500/[0.02] px-5 py-4 analytics-card-hover">
                <p className="text-sm text-foreground">
                  <strong>{PLATFORM_LABELS[insight.platform] ?? insight.platform}</strong> {'\u00B7'} {insight.pattern}
                </p>
                <p className="text-xs text-red-400/80 mt-1 font-medium">{Math.round(Math.abs(insight.multiplier) * 100)}% below your average</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Based on {insight.postCount} posts</p>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-card/60 border-border px-5 py-5" style={{ maxHeight: 180 }}>
            <p className="text-sm text-foreground/60">Once {minPosts} tracked posts are analyzed, we'll flag patterns hurting your reach.</p>
          </Card>
        )}
      </div>

      {/* ─── 9. CONNECTED ACCOUNTS ─── */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
          <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
          Connected accounts
        </h2>

        {accountsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-zinc-800/30 animate-pulse border border-border" />)}
          </div>
        ) : accountCount === 0 ? (
          <Card className="bg-card/60 border-border px-5 py-4">
            <p className="text-sm text-muted-foreground">
              No accounts connected.{' '}
              <button onClick={() => router.push('/settings')} className="text-cyan-400 hover:text-cyan-300 font-medium">Connect in Settings</button>
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {connectedAccounts.map(acc => {
              const label = PLATFORM_LABELS[acc.platform] ?? acc.platform
              const icon = PLATFORM_ICONS[acc.platform] ?? '?'
              const gradient = PLATFORM_GRADIENTS[acc.platform] ?? 'from-zinc-700 to-zinc-600'
              const isYt = acc.platform === 'youtube' && hasYouTube
              const accSyncAgo = acc.last_synced_at ? formatTimeAgo(acc.last_synced_at) : null

              return (
                <Card key={acc.id} className="bg-zinc-900 border-border p-4">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold bg-gradient-to-br text-white', gradient)}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400">Connected</span>
                        {acc.username && <span className="text-[10px] text-muted-foreground">{'\u00B7'} @{acc.username}</span>}
                        {accSyncAgo && <span className="text-[10px] text-muted-foreground">{'\u00B7'} {accSyncAgo}</span>}
                      </div>
                    </div>
                  </div>
                  {isYt ? (
                    <div className="flex items-center justify-between text-xs mt-3 pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Score: <strong className="text-foreground">{creatorScore}</strong></span>
                      <span className="text-cyan-400 font-medium">{CREATOR_RANK_CONFIG[creatorRank]?.label}</span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/50 mt-2">Waiting for {label} API approval</p>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── 10. POST HISTORY ─── */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
          <Film className="h-3.5 w-3.5 text-cyan-400" />
          Post history
        </h2>

        {clipsLoading ? (
          <Card className="bg-card/60 border-border p-4">
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-14 rounded-lg bg-zinc-800/50 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 bg-zinc-800/50 rounded animate-pulse" />
                    <div className="h-2.5 w-1/3 bg-zinc-800/50 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : topClips.length === 0 ? (
          <Card className="bg-card/60 border-border px-5 py-5" style={{ maxHeight: 180 }}>
            <p className="text-sm text-muted-foreground">No published clips yet. Each post sharpens the system.</p>
            <button onClick={() => router.push('/dashboard/distribution')} className="text-xs text-cyan-400 hover:text-cyan-300 font-medium mt-2 inline-block">
              Open Distribution {'\u2192'}
            </button>
          </Card>
        ) : (
          <Card className="bg-card/60 border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium uppercase tracking-wider">Clip</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium uppercase tracking-wider">Source</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium uppercase tracking-wider">Score</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium uppercase tracking-wider">Tracking</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium uppercase tracking-wider">Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {topClips.slice(0, 20).map((clip) => (
                    <tr key={clip.id} className="border-b border-border/30 hover:bg-background/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-11 rounded bg-gradient-to-b from-zinc-700 to-zinc-900 flex-shrink-0 overflow-hidden">
                            {clip.thumbnailUrl && <Image src={clip.thumbnailUrl} alt="" width={32} height={44} className="w-full h-full object-cover" />}
                          </div>
                          <span className="text-foreground font-medium truncate max-w-[180px]">{clip.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{clip.source === 'upload' ? 'Upload' : 'Trending'}</td>
                      <td className="px-4 py-3">
                        {clip.score !== null ? (
                          <span className={cn(
                            'font-bold px-2 py-0.5 rounded-full text-[10px]',
                            clip.score >= 80 ? 'bg-orange-500/15 text-orange-400'
                              : clip.score >= 60 ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-zinc-700/50 text-zinc-400'
                          )}>{clip.score}</span>
                        ) : (
                          <span className="text-muted-foreground/50">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] text-amber-400/70 font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/15">
                          Metrics pending
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatTimeAgo(clip.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {topClips.length > 20 && (
              <div className="px-4 py-2 border-t border-border/30 text-center">
                <span className="text-[10px] text-muted-foreground">Showing 20 of {topClips.length} clips</span>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
