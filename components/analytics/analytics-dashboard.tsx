'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3, TrendingUp, Lock, ExternalLink, ArrowRight,
  Flame, Film, RefreshCw, ChevronRight, AlertCircle, Clock,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAccountStore } from '@/stores/account-store'
import { CREATOR_RANK_CONFIG, type CreatorRank } from '@/lib/scoring/account-scorer'
import { loadPersistentStats, type PersistentStats } from '@/lib/distribution/session-persistence'
import { createClient } from '@/lib/supabase/client'
import {
  getConfidenceLevel, getConfidenceLabel,
  getMinPostsForInsight,
  type ConfidenceLevel, type AccountBreakdown,
} from '@/types/learning'

/* ─── Example insights for locked cards ─── */

const EXAMPLE_WORKING = [
  { platform: 'TikTok', pattern: 'Funny clips posted 7-10 PM', multiplier: '2.4x', posts: 18 },
  { platform: 'YouTube Shorts', pattern: 'Hype clips with word-pop captions', multiplier: '1.8x', posts: 12 },
  { platform: 'Instagram Reels', pattern: 'Short clips under 30s', multiplier: '1.6x', posts: 9 },
]

const EXAMPLE_NOT_WORKING = [
  { platform: 'TikTok', pattern: 'Drama clips posted mornings', multiplier: '-0.6x', posts: 7 },
  { platform: 'YouTube Shorts', pattern: 'Clips over 50s without hook', multiplier: '-0.4x', posts: 5 },
]

const EXAMPLE_ADJUSTMENTS = [
  { change: 'Prioritize funny/hype clips on TikTok', reason: 'Funny clips performed 2.1x above account average (based on 12 posts)', confidence: 'medium' as ConfidenceLevel },
  { change: 'Shift posting window to 7-10 PM', reason: 'Evening posts reach 1.8x more viewers than morning posts', confidence: 'early' as ConfidenceLevel },
  { change: 'Enable word-pop captions by default', reason: 'Clips with word-pop get 40% more retention', confidence: 'medium' as ConfidenceLevel },
]

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

/* ─── Top clip type ─── */

interface TopClip {
  id: string
  title: string
  score: number | null
  thumbnailUrl: string | null
  source: string
  createdAt: string
}

/* ─── Social account from API ─── */

interface SocialAccountRow {
  id: string
  platform: string
  username: string | null
  creator_score: number | null
  creator_rank: string | null
}

/* ─── Main Component ─── */

export function AnalyticsDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<PersistentStats | null>(null)
  const [topClips, setTopClips] = useState<TopClip[]>([])
  const [clipsLoading, setClipsLoading] = useState(true)
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccountRow[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const { score: accountScore, fetchAccountScore, followers, medianViews, engagementRate, lastSyncedAt } = useAccountStore()

  useEffect(() => { fetchAccountScore() }, [fetchAccountScore])
  useEffect(() => { setStats(loadPersistentStats()) }, [])

  // Fetch connected accounts
  useEffect(() => {
    async function loadAccounts() {
      setAccountsLoading(true)
      try {
        const res = await fetch('/api/social-accounts')
        const json = await res.json()
        if (json.data) {
          setConnectedAccounts(json.data)
        }
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

      const clips: TopClip[] = jobs.map(j => ({
        id: j.clip_id,
        title: trendingMap[j.clip_id]?.title || 'Uploaded clip',
        score: trendingMap[j.clip_id]?.score ?? null,
        thumbnailUrl: trendingMap[j.clip_id]?.thumb ?? null,
        source: j.source,
        createdAt: j.created_at ?? new Date().toISOString(),
      }))

      setTopClips(clips)
      setClipsLoading(false)
    }
    loadTopClips()
  }, [])

  // Derived
  const totalPosts = stats?.totalClipsPublished ?? 0
  const confidence = getConfidenceLevel(totalPosts)
  const confidenceLabel = getConfidenceLabel(confidence)
  const confidenceStyle = CONFIDENCE_STYLES[confidence]
  const hasEnoughData = totalPosts >= getMinPostsForInsight()
  const accountCount = connectedAccounts.length
  const currentStreak = stats?.currentStreak ?? 0

  const hasYouTube = accountScore !== null && (accountScore.creator_score ?? 0) > 0
  const creatorRank: CreatorRank = accountScore?.creator_rank ?? 'newcomer'
  const creatorScore = accountScore?.creator_score ?? 0

  const syncAgo = lastSyncedAt
    ? (() => {
        const diffMin = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 60000)
        if (diffMin < 60) return `${diffMin}m ago`
        if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
        return `${Math.floor(diffMin / 1440)}d ago`
      })()
    : null

  // Build account breakdowns
  const accountBreakdowns: AccountBreakdown[] = connectedAccounts.map(acc => {
    const isYt = acc.platform === 'youtube' && hasYouTube
    return {
      accountId: acc.id,
      platform: acc.platform,
      username: acc.username,
      postsAnalyzed: 0, // No real tracking yet
      bestMood: null,
      bestTime: null,
      bestFormat: null,
      avoid: null,
      confidence: 'none',
      hasApiTracking: false,
      creatorScore: isYt ? creatorScore : undefined,
      creatorRank: isYt ? CREATOR_RANK_CONFIG[creatorRank]?.label : undefined,
    }
  })

  return (
    <div className="space-y-6 pb-12">
      {/* ─── SECTION 1: LEARNING SUMMARY ─── */}
      <Card className="bg-zinc-900/50 backdrop-blur-sm border-border sticky top-0 z-10 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="h-4 w-4 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground truncate">
                {accountCount > 0
                  ? `Your system is learning from ${accountCount} connected account${accountCount !== 1 ? 's' : ''}.`
                  : 'Connect your accounts to start learning.'}
              </h1>
              {totalPosts > 0 && currentStreak >= 1 && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{totalPosts} clip{totalPosts !== 1 ? 's' : ''} published</span>
                  {currentStreak >= 3 && (
                    <span className="text-[10px] text-orange-400 font-medium flex items-center gap-0.5">
                      <Flame className="h-2.5 w-2.5" />{currentStreak}-day streak
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={cn(
              'text-[10px] font-medium px-2.5 py-1 rounded-full border',
              confidenceStyle.bg, confidenceStyle.text, confidenceStyle.border,
            )}>
              {confidenceLabel}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Posts: {totalPosts}
            </span>
            {syncAgo && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {syncAgo}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* ─── NO ACCOUNTS CTA ─── */}
      {!accountsLoading && accountCount === 0 && (
        <Card className="bg-card/60 border-border p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <ExternalLink className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Connect your accounts to start learning</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Link your TikTok, YouTube, or Instagram to let the system analyze your performance and optimize distribution.
              </p>
            </div>
            <button
              onClick={() => router.push('/settings')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm font-semibold hover:from-purple-700 hover:to-purple-800 transition-all"
            >
              <ExternalLink className="h-4 w-4" />
              Go to Settings
            </button>
          </div>
        </Card>
      )}

      {/* ─── NO POSTS CTA ─── */}
      {accountCount > 0 && totalPosts === 0 && (
        <Card className="bg-card/60 border-border p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Film className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Publish your first clip to start learning</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Head to Distribution, pick a clip, and publish. The system will start analyzing patterns immediately.
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/distribution')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold hover:from-orange-600 hover:to-amber-600 transition-all"
            >
              Go to Distribution
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/* ─── SECTION 2: WHAT'S WORKING ─── */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          What&apos;s working
        </h2>

        {hasEnoughData ? (
          <Card className="bg-card/60 border-border p-5">
            <p className="text-sm text-muted-foreground">
              Not enough data in any single pattern yet. Publish more clips to see what works.
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {EXAMPLE_WORKING.map((ex, i) => (
              <LockedInsightCard
                key={i}
                borderColor="border-l-emerald-500"
                bgColor="bg-emerald-500/[0.03]"
                platform={ex.platform}
                pattern={ex.pattern}
                metric={`${ex.multiplier} above your average`}
                detail={`Based on ${ex.posts} posts`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── SECTION 3: WHAT'S NOT WORKING ─── */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          What&apos;s not working
        </h2>

        {hasEnoughData ? (
          <Card className="bg-card/60 border-border p-5">
            <p className="text-sm text-muted-foreground">
              Not enough data to detect underperforming patterns yet.
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {EXAMPLE_NOT_WORKING.map((ex, i) => (
              <LockedInsightCard
                key={i}
                borderColor="border-l-red-500"
                bgColor="bg-red-500/[0.03]"
                platform={ex.platform}
                pattern={ex.pattern}
                metric={`${ex.multiplier} below your average`}
                detail={`Based on ${ex.posts} posts`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── SECTION 4: DISTRIBUTION ADJUSTMENTS ─── */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
          <ArrowRight className="h-3.5 w-3.5 text-blue-400" />
          Distribution adjustments
        </h2>

        {hasEnoughData ? (
          <Card className="bg-card/60 border-border p-5">
            <p className="text-sm text-muted-foreground">
              Not enough data yet. Publish {getMinPostsForInsight() - totalPosts} more clip{getMinPostsForInsight() - totalPosts !== 1 ? 's' : ''} to see the first adjustments.
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {EXAMPLE_ADJUSTMENTS.map((ex, i) => (
              <LockedAdjustmentCard
                key={i}
                change={ex.change}
                reason={ex.reason}
                confidence={ex.confidence}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── SECTION 5: ACCOUNT BREAKDOWN ─── */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
          <BarChart3 className="h-3.5 w-3.5 text-purple-400" />
          Account breakdown
        </h2>

        {accountsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 rounded-xl bg-zinc-800/30 animate-pulse border border-border" />
            ))}
          </div>
        ) : accountBreakdowns.length === 0 ? (
          <Card className="bg-card/60 border-border p-5">
            <p className="text-sm text-muted-foreground">
              No accounts connected.{' '}
              <button onClick={() => router.push('/settings')} className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Connect in Settings
              </button>
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accountBreakdowns.map(acc => (
              <AccountCard key={acc.accountId} account={acc} />
            ))}
          </div>
        )}
      </div>

      {/* ─── SECTION 6: POST HISTORY ─── */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5 mb-3">
          <Film className="h-3.5 w-3.5 text-purple-400" />
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
          <Card className="bg-card/60 border-border p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <Film className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No published clips yet. Head to Distribution to post your first clip.
              </p>
              <button
                onClick={() => router.push('/dashboard/distribution')}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Go to Distribution &rarr;
              </button>
            </div>
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
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium uppercase tracking-wider">Views</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium uppercase tracking-wider">Likes</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium uppercase tracking-wider">Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {topClips.slice(0, 20).map((clip) => (
                    <tr key={clip.id} className="border-b border-border/30 hover:bg-background/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-11 rounded bg-gradient-to-b from-zinc-700 to-zinc-900 flex-shrink-0 overflow-hidden">
                            {clip.thumbnailUrl && <img src={clip.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
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
                        <span className="text-muted-foreground/40 flex items-center gap-1">
                          <Lock className="h-2.5 w-2.5" /> &mdash;
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground/40 flex items-center gap-1">
                          <Lock className="h-2.5 w-2.5" /> &mdash;
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(clip.createdAt)}
                      </td>
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

            {/* Refresh hint */}
            <div className="px-4 py-2.5 border-t border-border/30 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/50">Views and likes will appear when platform API tracking is approved</span>
              <button
                disabled
                className="flex items-center gap-1 text-[10px] text-muted-foreground/30 cursor-not-allowed"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                Refresh stats
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

/* ─── Locked Insight Card ─── */
function LockedInsightCard({ borderColor, bgColor, platform, pattern, metric, detail }: {
  borderColor: string
  bgColor: string
  platform: string
  pattern: string
  metric: string
  detail: string
}) {
  return (
    <Card className={cn(
      'relative border-l-4 px-5 py-4 opacity-40 border-dashed',
      borderColor, bgColor,
    )}>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="flex flex-col items-center gap-1">
          <Lock className="h-4 w-4 text-muted-foreground/50" />
        </div>
      </div>
      <div className="blur-[1px]">
        <p className="text-[10px] text-muted-foreground/80 italic mb-1.5">Example insight:</p>
        <p className="text-sm text-foreground/70">
          <span className="font-semibold">{platform}</span> &middot; {pattern}
        </p>
        <p className="text-xs text-foreground/50 mt-1">{metric}</p>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{detail}</p>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-2 relative z-10 text-center">
        Coming soon &mdash; Publish clips and connect accounts to see real insights
      </p>
    </Card>
  )
}

/* ─── Locked Adjustment Card ─── */
function LockedAdjustmentCard({ change, reason, confidence }: {
  change: string
  reason: string
  confidence: ConfidenceLevel
}) {
  const cStyle = CONFIDENCE_STYLES[confidence]
  return (
    <Card className="relative border-l-4 border-l-blue-500 bg-blue-500/[0.03] px-5 py-4 opacity-40 border-dashed">
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <Lock className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <div className="blur-[1px]">
        <p className="text-[10px] text-muted-foreground/80 italic mb-1.5">Example adjustment:</p>
        <div className="space-y-1">
          <p className="text-sm text-foreground/70">
            <span className="font-semibold">Change:</span> {change}
          </p>
          <p className="text-xs text-foreground/50">
            <span className="font-semibold">Why:</span> {reason}
          </p>
          <span className={cn(
            'inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border',
            cStyle.bg, cStyle.text, cStyle.border,
          )}>
            {getConfidenceLabel(confidence)}
          </span>
        </div>
      </div>
    </Card>
  )
}

/* ─── Account Card ─── */
function AccountCard({ account }: { account: AccountBreakdown }) {
  const platformLabel = PLATFORM_LABELS[account.platform] ?? account.platform
  const platformIcon = PLATFORM_ICONS[account.platform] ?? '?'
  const platformGradient = PLATFORM_GRADIENTS[account.platform] ?? 'from-zinc-700 to-zinc-600'
  const hasYtData = account.creatorScore !== undefined && account.creatorScore > 0

  return (
    <Card className="bg-zinc-900 border-border p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold bg-gradient-to-br text-white',
          platformGradient,
        )}>
          {platformIcon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {account.username ? `@${account.username}` : platformLabel}
          </p>
          <span className="text-[10px] text-muted-foreground">{platformLabel}</span>
        </div>
      </div>

      {hasYtData ? (
        /* YouTube with real data */
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Creator Score</span>
            <span className="font-bold text-foreground">{account.creatorScore}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Creator Rank</span>
            <span className="font-medium text-purple-400">{account.creatorRank}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <Lock className="h-2.5 w-2.5" />
              <span>Performance tracking coming soon</span>
            </div>
          </div>
        </div>
      ) : (
        /* Other platforms — locked */
        <div className="flex flex-col items-center py-4 gap-2 text-center">
          <Lock className="h-5 w-5 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground/60">Performance tracking coming soon</p>
          <p className="text-[10px] text-muted-foreground/40">
            Waiting for {platformLabel} API approval
          </p>
        </div>
      )}
    </Card>
  )
}

/* ─── Helpers ─── */

function formatTimeAgo(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  const days = Math.floor(diffMin / 1440)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}
