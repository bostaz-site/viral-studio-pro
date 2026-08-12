/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Sparkles, Download, CheckCircle, Check,
  Type, Wand2, Eye, ExternalLink, Play,
  Monitor, Zap, Send,
  Flame, Focus, X, Plus, Volume2, Scissors, RotateCcw, Rocket, Bell, SlidersHorizontal, Gift,
} from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { ErrorCard, classifyError } from '@/components/ui/error-card'
import { createClient } from '@/lib/supabase/client'
import { useTrendingStore } from '@/stores/trending-store'
import { cn } from '@/lib/utils'
import { ALL_MOODS, MOOD_PRESETS, MOOD_COLORS, PLATFORM_THEME, getMoodPresetForClip, type ClipMood, type MoodPreset } from '@/lib/ai/mood-presets'
import { captureHookOverlayPNG } from '@/lib/capture-hook-overlay'
import { captureTagOverlayPNG } from '@/lib/capture-tag-overlay'
import {
  CAPTION_STYLES, EMPHASIS_EFFECTS, EMPHASIS_COLORS, TAG_STYLES,
  formatCount, computeScores, computeCurrentScore, computeBaselineScore, getScoreLabel, computeScoreBreakdown,
  type TrendingClipData, type EnhanceSettings, type ScoredOption, type ScoreBreakdown,
} from '@/lib/enhance/scoring'
import { LivePreview, ScoreBadge } from '@/components/enhance/live-preview'
import { COMING_SOON_FEATURES } from '@/lib/enhance/feature-flags'
import { AIAnalysisSequence } from '@/components/enhance/ai-analysis-sequence'
import { TagPanel } from '@/components/enhance/tag-panel'
import { BlowupChanceBar } from '@/components/enhance/blowup-chance-bar'
import { CaptionsSection } from '@/components/enhance/accordion-sections/captions-section'
import { PageHeader } from '@/components/dashboard/page-header'
import { UnifiedPublishDialog } from '@/components/distribution/unified-publish-dialog'
import { PaywallModal } from '@/components/paywall-modal'
import { PLANS } from '@/lib/plans'
import { track } from '@/lib/analytics'

// ─── Types ──────────────────────────────────────────────────────────────────

interface HookVariant {
  style: string
  label: string
  text: string
}

interface HookAnalysis {
  peak: { peakTime: number; peakScore: number; scores: number[]; windowSize: number }
  hooks: HookVariant[]
  reorder: { segments: { start: number; end: number; duration: number; label: string }[]; totalDuration: number; peakTime: number }
}

// Scoring constants, functions, ScoreBadge and LivePreview are imported from:
// - @/lib/enhance/scoring
// - @/components/enhance/live-preview

// ─── Render stages (labeled FFmpeg pipeline steps) ──────────────────────────

const RENDER_STAGES = ['Downloading', 'Applying captions', 'Compositing', 'Uploading'] as const
// Approximate durations in ms before advancing to next stage (simulated — VPS doesn't report stages)
const RENDER_STAGE_DURATIONS_MS = [8000, 15000, 20000] // indices 0→1, 1→2, 2→3

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function EnhancePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const clipId = params.clipId as string
  const sourceParam = searchParams.get('source') // 'upload' for user-uploaded videos

  const [clip, setClip] = useState<TrendingClipData | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [placedInBank, setPlacedInBank] = useState(false)
  const [nextBestClip, setNextBestClip] = useState<{ id: string; title: string | null; velocity_score: number | null; thumbnail_url: string | null; tier: string | null } | null>(null)
  const [showPublishDialog, setShowPublishDialog] = useState(searchParams.get('publish') === '1')
  const [renderMessage, setRenderMessage] = useState<string | null>(null)
  const [renderOriginalUrl, setRenderOriginalUrl] = useState<string | null>(null)
  const [renderDownloadUrl, setRenderDownloadUrl] = useState<string | null>(null)
  const [renderJobId, setRenderJobId] = useState<string | null>(null)
  const [isRenderedVideo, setIsRenderedVideo] = useState(false)
  const [renderedThumbnailUrl, setRenderedThumbnailUrl] = useState<string | null>(null)
  const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null)
  const [settingsChangedSinceRender, setSettingsChangedSinceRender] = useState(false)
  const [bankLoading, setBankLoading] = useState(false)
  const [bankError, setBankError] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const hasUserChangedSettings = useRef(false)
  const [renderStageIdx, setRenderStageIdx] = useState<number>(-1)
  const [notifyOnDone, setNotifyOnDone] = useState(false)
  const notifyOnDoneRef = useRef(false)
  const renderStageTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [showEnhancements, setShowEnhancements] = useState(false)
  const [hookAnalysis, setHookAnalysis] = useState<HookAnalysis | null>(null)
  const [hookGenerating, setHookGenerating] = useState(false)

  // Paywall state
  const [showPaywall, setShowPaywall] = useState(false)
  const [paywallSaveUsed, setPaywallSaveUsed] = useState(true) // assume used until bootstrap loads
  const [userPlan, setUserPlan] = useState<string>('free')
  const [monthlyUsed, setMonthlyUsed] = useState(0)
  const [bonusVideos, setBonusVideos] = useState(0)
  const [referralLink, setReferralLink] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [hookError, setHookError] = useState<string | null>(null)
  // Burned-in caption detection state
  const [burnedCaptions, setBurnedCaptions] = useState<{ detected: boolean; position: string | null; confidence: number } | null>(null)
  const paywallRef = useRef({ userPlan, monthlyUsed, bonusVideos })
  const router = useRouter()
  const sectionRefs = {
    captions: useRef<HTMLDivElement>(null),
    splitscreen: useRef<HTMLDivElement>(null),
    tags: useRef<HTMLDivElement>(null),
  }

  // "Viral Boost" preset — page opens render-ready with zero configuration.
  // Captions ON (hormozi style, font 78, highlight animation), 9:16, streamer tag ON.
  const DEFAULT_SETTINGS: EnhanceSettings = {
    captionsEnabled: true,
    captionStyle: 'hormozi',
    emphasisEffect: 'highlight',
    emphasisColor: 'red',
    customImportantWords: [],
    captionPosition: 72,
    wordsPerLine: 4,
    videoZoom: 'contain',
    tagStyle: 'viral-glow',
    tagSize: 100,
    aspectRatio: '9:16',
    smartZoomEnabled: false,
    smartZoomMode: 'micro',
    audioEnhanceEnabled: false,
    bassBoost: 'off',
    speedRamp: 'off',
    autoCutEnabled: false,
    autoCutThreshold: 0.7,
    hookEnabled: false,
    hookTextEnabled: true,
    hookReorderEnabled: false, // frozen (COMING_SOON_FEATURES)
    hookText: '',
    hookStyle: 'suspense',
    hookTextPosition: 15,
    hookLength: 0,
    hookReorder: null,
  }

  const [settings, setSettings] = useState<EnhanceSettings>({ ...DEFAULT_SETTINGS })

  // Load clip data — try uploaded video, trending store, then Supabase trending_clips
  const storeClips = useTrendingStore((s) => s.clips)

  useEffect(() => {
    async function loadClip() {
      const supabase = createClient()

      // 0. If source=upload, load from videos table (user-uploaded clips)
      if (sourceParam === 'upload') {
        try {
          const { data: video, error: videoError } = await supabase
            .from('videos')
            .select('id, title, storage_path, status, created_at')
            .eq('id', clipId)
            .single()

          if (videoError || !video) throw new Error(videoError?.message || 'Video not found')

          // Get a signed URL for the video preview
          const { data: signedData } = await supabase.storage
            .from('videos')
            .createSignedUrl(video.storage_path, 3600)

          if (signedData?.signedUrl) {
            setVideoUrl(signedData.signedUrl)
          }

          const clipData: TrendingClipData = {
            id: video.id,
            external_url: video.storage_path, // storage path for render API
            platform: 'upload',
            author_name: 'You',
            author_handle: null,
            title: video.title || 'Your clip',
            description: null,
            niche: null,
            view_count: null,
            like_count: null,
            velocity_score: null,
            thumbnail_url: null,
            duration_seconds: null,
          }
          setClip(clipData)
          setLoading(false)
          return
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load video')
          setLoading(false)
          return
        }
      }

      // 1. Try the trending store (works for seed data + already-fetched clips)
      const storeClip = storeClips.find((c) => c.id === clipId)
      if (storeClip) {
        const clipData: TrendingClipData = {
          id: storeClip.id,
          external_url: storeClip.external_url,
          platform: storeClip.platform,
          author_name: storeClip.author_name,
          author_handle: storeClip.author_handle,
          title: storeClip.title,
          description: storeClip.description,
          niche: storeClip.niche,
          view_count: storeClip.view_count,
          like_count: storeClip.like_count,
          velocity_score: storeClip.velocity_score,
          thumbnail_url: storeClip.thumbnail_url,
          duration_seconds: storeClip.duration_seconds ?? null,
        }
        setClip(clipData)
        setLoading(false)
        return
      }

      // 2. Fallback to Supabase query (trending_clips)
      try {
        const { data, error: dbError } = await supabase
          .from('trending_clips')
          .select('*')
          .eq('id', clipId)
          .single()

        if (dbError) throw new Error(dbError.message)
        if (!data) throw new Error('Clip not found')

        const clipData = data as TrendingClipData
        setClip(clipData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }

    loadClip()
  }, [clipId, storeClips, sourceParam])

  // Detect burned-in captions when clip loads (fire-and-forget, non-blocking)
  useEffect(() => {
    if (!clip?.external_url) return
    // Only detect for trending clips (uploads are user's own content — less likely to have burned captions)
    if (sourceParam === 'upload') return

    let cancelled = false
    async function detect() {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 35_000)
        const res = await fetch('/api/enhance/detect-captions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: clip!.external_url,
            duration: clip!.duration_seconds ?? undefined,
          }),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (cancelled) return
        const json = await res.json()
        if (json.data) {
          setBurnedCaptions({
            detected: !!json.data.burned_captions,
            position: json.data.position ?? null,
            confidence: json.data.confidence ?? 0,
          })
        }
      } catch {
        // Silent failure — detection is assistive, never blocking
      }
    }
    detect()
    return () => { cancelled = true }
  }, [clip?.external_url, clip?.duration_seconds, sourceParam])

  // Bootstrap paywall data (plan, usage, save status)
  useEffect(() => {
    async function loadPaywallData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('plan, monthly_videos_used, bonus_videos, paywall_save_used, referral_code, is_comp')
        .eq('id', user.id)
        .single()

      if (profile) {
        // Comp/pack accounts get Pro access
        setUserPlan(profile.is_comp ? 'pro' : (profile.plan ?? 'free'))
        setMonthlyUsed(profile.monthly_videos_used ?? 0)
        setBonusVideos(profile.bonus_videos ?? 0)
        setPaywallSaveUsed(profile.paywall_save_used ?? false)
        if (profile.referral_code) setReferralCode(profile.referral_code)
      }

      // Load referral link if exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: code } = await (supabase as any)
        .from('affiliate_codes')
        .select('code')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (code?.code) {
        setReferralLink(`${window.location.origin}/r/${code.code}`)
      }
    }
    loadPaywallData()
  }, [])

  // Keep paywall ref in sync for stale-closure-safe reads in handleRender
  useEffect(() => { paywallRef.current = { userPlan, monthlyUsed, bonusVideos } }, [userPlan, monthlyUsed, bonusVideos])

  // Resolve direct MP4 URL for live preview (Twitch + Kick)
  useEffect(() => {
    if (!clip || !clip.external_url) return
    const platform = clip.platform
    if (platform !== 'twitch' && platform !== 'kick') return

    let slug: string | null = null
    if (platform === 'twitch') {
      const m = clip.external_url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)|\/clip\/([A-Za-z0-9_-]+)/)
      slug = m ? (m[1] || m[2]) : null
    } else {
      // Kick clip URLs: https://kick.com/CHANNEL?clip=SLUG or https://kick.com/CHANNEL/clips/SLUG
      const m = clip.external_url.match(/[?&]clip=([A-Za-z0-9_-]+)|\/clips\/([A-Za-z0-9_-]+)/)
      slug = m ? (m[1] || m[2]) : null
      // Fallback: use clip ID itself as slug for Kick API
      if (!slug) slug = clip.id
    }
    if (!slug) return

    let cancelled = false
    fetch(`/api/clips/video-url?slug=${encodeURIComponent(slug)}&platform=${platform}`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (!cancelled && j?.video_url) setVideoUrl(j.video_url) })
      .catch(() => { /* silent — fallback to thumbnail */ })
    return () => { cancelled = true }
  }, [clip])

  // Fetch next best clip when user places current one in bank (chain farming)
  useEffect(() => {
    if (!placedInBank) return
    let cancelled = false
    fetch(`/api/trending/next-best?exclude=${encodeURIComponent(clipId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (!cancelled && j?.data) setNextBestClip(j.data) })
      .catch(() => { /* silent */ })
    return () => { cancelled = true }
  }, [placedInBank, clipId])


  const scores = useMemo(() => {
    if (!clip) return null
    return computeScores(clip)
  }, [clip])

  const baselineScore = useMemo(() => {
    if (!clip) return 0
    return computeBaselineScore(clip)
  }, [clip])

  // currentScore is computed after mood state declarations (below)

  // ── Polling for render job status ──
  const startPolling = useCallback((jobId: string) => {
    // Clear any existing poll
    if (pollRef.current) clearInterval(pollRef.current)

    setRenderJobId(jobId)
    setRenderDownloadUrl(null)

    // Persist the jobId so a refresh / accidental navigation can resume polling
    try { sessionStorage.setItem(`render-job:${clipId}`, jobId) } catch { /* ignore */ }

    let pollCount = 0
    // 200 × 3s = 10 minutes — long clips + a couple of slots ahead in the
    // render queue can legitimately take 5-8 minutes. After 10 we stop
    // polling but leave the jobId in sessionStorage so the user can refresh
    // and resume.
    const maxPolls = 200

    pollRef.current = setInterval(async () => {
      pollCount++
      if (pollCount > maxPolls) {
        if (pollRef.current) clearInterval(pollRef.current)
        setRenderMessage('⚠️ Render is taking more than 10 min — refresh the page to resume tracking, it\'s probably still running.')
        setRendering(false)
        return
      }

      try {
        const res = await fetch(`/api/render/status?jobId=${jobId}`)
        const json = await res.json() as {
          data: {
            status: string
            downloadUrl?: string | null
            publicUrl?: string | null
            thumbnailUrl?: string | null
            errorMessage?: string | null
            qualityTier?: string | null
            reducedQuality?: boolean
            queuePosition?: number | null
          } | null
          message: string
        }

        if (!json.data) return

        if (json.data.status === 'done' && json.data.downloadUrl) {
          if (pollRef.current) clearInterval(pollRef.current)
          // Persist render-done before removing render-job (kill switch for refresh)
          try {
            localStorage.setItem(`render-done:${clipId}`, JSON.stringify({
              url: json.data.downloadUrl,
              timestamp: Date.now(),
            }))
          } catch { /* ignore */ }
          try { sessionStorage.removeItem(`render-job:${clipId}`) } catch { /* ignore */ }
          setRenderDownloadUrl(json.data.downloadUrl)
          // Save rendered video URL and AUTO-SWITCH to the Rendered tab
          // (Enhanced CSS preview becomes redundant once we have the actual MP4)
          if (json.data.publicUrl) {
            setOriginalVideoUrl(videoUrl)
            setVideoUrl(json.data.publicUrl)
            if (json.data.thumbnailUrl) {
              setRenderedThumbnailUrl(json.data.thumbnailUrl)
            }
          }
          // Auto-switch to Rendered view
          setIsRenderedVideo(true)
          setShowEnhancements(true)
          setRenderMessage(
            json.data.reducedQuality
              ? '✅ Rendered at reduced quality (server load) — re-generate to try full quality.'
              : '✅ Clip rendered with captions! Check the preview above.'
          )
          setRendering(false)
          setMonthlyUsed(prev => prev + 1)
          setSettingsChangedSinceRender(false)
          setPlacedInBank(false)
          setBankError(null)
          // Auto-open publish dialog (primary CTA post-render)
          setShowPublishDialog(true)
          // Browser notification (user opted in via Notification API)
          if (notifyOnDoneRef.current && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try { new Notification('Your clip is ready! 🎬', { body: 'Click to download or publish your viral clip.', icon: '/favicon.ico' }) } catch { /* silent */ }
          }
        } else if (json.data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current)
          try { sessionStorage.removeItem(`render-job:${clipId}`) } catch { /* ignore */ }
          setRenderMessage(`❌ Error: ${json.data.errorMessage || 'Unknown error'}`)
          setRendering(false)
        } else if (['failed', 'canceled', 'expired'].includes(json.data.status)) {
          if (pollRef.current) clearInterval(pollRef.current)
          try { sessionStorage.removeItem(`render-job:${clipId}`) } catch { /* ignore */ }
          setRenderMessage(`❌ ${json.message || 'Render failed'}`)
          setRendering(false)
        } else if (json.data.status === 'queued') {
          const pos = json.data.queuePosition
          if (typeof pos === 'number' && pos > 0) {
            setRenderMessage(`⏳ In queue — position ${pos}. Your clip will be processed soon.`)
          } else {
            setRenderMessage('⏳ Queued — waiting for a render slot...')
          }
        } else if (json.data.status === 'rendering') {
          const pos = json.data.queuePosition
          if (typeof pos === 'number' && pos > 0) {
            setRenderMessage(`⏳ In queue — position ${pos}. Your clip will be processed soon.`)
          } else {
            setRenderMessage('⏳ Rendering... this may take 30-60 seconds.')
          }
        }
      } catch {
        // Silently retry on network errors
      }
    }, 3000) // Poll every 3 seconds
  }, [clipId, videoUrl])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Keep notifyOnDoneRef in sync so startPolling closure can read latest value
  useEffect(() => { notifyOnDoneRef.current = notifyOnDone }, [notifyOnDone])

  // Resume polling on mount if a render is already in flight for this clip
  // (user refreshed the page mid-render, or came back after the previous
  // polling window timed out).
  useEffect(() => {
    if (!clip) return
    let storedJobId: string | null = null
    try { storedJobId = sessionStorage.getItem(`render-job:${clipId}`) } catch { /* ignore */ }
    if (!storedJobId) return
    // Quick status probe — if the job is already done/error, skip polling
    // and show the final state immediately.
    fetch(`/api/render/status?jobId=${storedJobId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json: { data: { status: string } | null } | null) => {
        if (!json?.data) {
          try { sessionStorage.removeItem(`render-job:${clipId}`) } catch { /* ignore */ }
          return
        }
        if (json.data.status === 'done' || json.data.status === 'error') {
          // Let startPolling handle the terminal state + cleanup in one tick
          setRendering(true)
          setRenderMessage('⏳ Resuming tracking...')
          startPolling(storedJobId!)
        } else {
          setRendering(true)
          setRenderMessage('⏳ Resuming render tracking...')
          startPolling(storedJobId!)
        }
      })
      .catch(() => { /* silent */ })
  }, [clip, clipId, startPolling])

  // Restore post-render CTA from localStorage on mount (survives refresh)
  useEffect(() => {
    if (!clip || renderDownloadUrl || rendering) return
    // Skip if sessionStorage has an active job (handled by resume polling above)
    try { if (sessionStorage.getItem(`render-job:${clipId}`)) return } catch { /* ignore */ }
    let cancelled = false
    try {
      const stored = localStorage.getItem(`render-done:${clipId}`)
      if (!stored) return
      const { timestamp } = JSON.parse(stored)
      if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`render-done:${clipId}`)
        return
      }
      // Server kill switch: fetch fresh signed URLs
      fetch(`/api/render/status?clip_id=${encodeURIComponent(clipId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          if (cancelled) return
          if (!json?.data || json.data.status !== 'done' || !json.data.downloadUrl) return
          setRenderDownloadUrl(json.data.downloadUrl)
          setRenderMessage('✅ Clip rendered — ready to publish or bank.')
        })
        .catch(() => { /* silent */ })
    } catch { /* ignore */ }
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip, clipId])

  const handleRender = useCallback(async () => {
    if (!clip) return

    // Paywall check: plan quota exceeded on client (server is still source of truth)
    const pw = paywallRef.current
    const planLimit = PLANS[(pw.userPlan as 'free' | 'pro' | 'studio') ?? 'free']?.limits.maxVideosPerMonth ?? 3
    if (pw.monthlyUsed >= planLimit && pw.bonusVideos <= 0) {
      track('paywall_shown', { userId, monthlyUsed: pw.monthlyUsed, bonusVideos: pw.bonusVideos })
      setShowPaywall(true)
      return
    }

    setRendering(true)
    setRenderMessage('⏳ Starting render...')
    setRenderDownloadUrl(null)
    setRenderOriginalUrl(null)
    setSettingsChangedSinceRender(false)
    setPlacedInBank(false)
    setBankError(null)
    // Revert to CSS preview mode (restore original video URL if we were showing rendered video)
    if (isRenderedVideo && originalVideoUrl) {
      setVideoUrl(originalVideoUrl)
    }
    setIsRenderedVideo(false)

    try {
      // Capture overlays as PNGs from browser (pixel-perfect match to CSS preview)
      setRenderMessage('📸 Capturing overlays...')

      // Resolve platform theme for overlay colors
      const platformKey = (clip.platform ?? 'twitch') as keyof typeof PLATFORM_THEME
      const theme = PLATFORM_THEME[platformKey] ?? PLATFORM_THEME.twitch

      let hookOverlayData: { png: string; capsuleW: number; capsuleH: number; positionPct: number } | null = null
      if (settings.hookEnabled && settings.hookTextEnabled && settings.hookText) {
        hookOverlayData = await captureHookOverlayPNG({
          text: settings.hookText,
          positionPct: settings.hookTextPosition,
          videoWidth: 1080,
          videoHeight: 1920,
          glowColor: theme.hookGlowColor,
        })
      }

      let tagOverlayData: { png: string; w: number; h: number; anchorX: number; anchorY: number } | null = null
      const streamerName = clip.author_handle ? `@${clip.author_handle}` : (clip.author_name || null)
      if (settings.tagStyle && settings.tagStyle !== 'none' && streamerName) {
        tagOverlayData = await captureTagOverlayPNG({
          streamerName,
          style: settings.tagStyle as 'viral-glow' | 'kick-glow' | 'twitch-minimal' | 'kick-minimal',
          tagSize: settings.tagSize || 100,
          videoWidth: 1080,
          videoHeight: 1920,
        })
      }

      setRenderMessage('⏳ Starting render...')
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip_id: clip.id,
          source: sourceParam === 'upload' ? 'clips' : 'trending',
          settings: {
            captions: {
              enabled: settings.captionsEnabled,
              style: settings.captionStyle,
              wordsPerLine: settings.wordsPerLine,
              animation: CAPTION_STYLES.find(s => s.id === settings.captionStyle)?.animation ?? 'highlight',
              emphasisEffect: settings.emphasisEffect,
              emphasisColor: settings.emphasisColor,
              customImportantWords: settings.customImportantWords,
              position: settings.captionPosition,
            },
            tag: {
              style: settings.tagStyle,
              size: settings.tagSize || 100,
              authorName: clip.author_name || null,
              authorHandle: clip.author_handle || null,
              overlayPng: tagOverlayData?.png || null,
              overlayAnchorX: tagOverlayData?.anchorX || null,
              overlayAnchorY: tagOverlayData?.anchorY || null,
            },
            format: {
              aspectRatio: settings.aspectRatio,
              videoZoom: settings.videoZoom,
            },
            smartZoom: {
              enabled: false, // frozen (COMING_SOON_FEATURES)
              mode: settings.smartZoomMode,
            },
            audioEnhance: {
              enabled: settings.audioEnhanceEnabled,
            },
            autoCut: {
              enabled: settings.autoCutEnabled,
              silenceThreshold: settings.autoCutThreshold,
              mood: (selectedMood ?? detectedMood) || undefined,
            },
            hook: (() => {
              return {
              enabled: settings.hookEnabled,
              textEnabled: settings.hookTextEnabled,
              reorderEnabled: false, // frozen (COMING_SOON_FEATURES)
              text: settings.hookText,
              style: (['shock', 'curiosity', 'suspense'].includes(settings.hookStyle) ? settings.hookStyle : 'suspense') as 'shock' | 'curiosity' | 'suspense',
              textPosition: settings.hookTextPosition,
              length: 0,
              reorder: settings.hookReorder,
              overlayPng: hookOverlayData?.png || null,
              overlayCapsuleW: hookOverlayData?.capsuleW || null,
              overlayCapsuleH: hookOverlayData?.capsuleH || null,
            }})(),
          },
        }),
      })
      const data = await res.json() as {
        data: { clip_id: string; jobId?: string; rendered: boolean; vpsReady?: boolean; originalUrl?: string } | null
        error: string | null
        message: string
      }

      if (!res.ok || !data.data) {
        if (res.status === 402 && data.error === 'quota_exceeded') {
          setRendering(false)
          setShowPaywall(true)
          return
        }
        setRenderMessage(`❌ ${data.error || data.message || 'Render failed'}`)
        setRendering(false)
      } else if (data.data.vpsReady === false) {
        setRenderMessage(`⚠️ ${data.message}`)
        if (data.data.originalUrl) {
          setRenderOriginalUrl(data.data.originalUrl)
        }
        setRendering(false)
      } else if (data.data.jobId) {
        // Start polling for job completion
        setRenderMessage('⏳ Rendering... this may take 30-60 seconds.')
        startPolling(data.data.jobId)
      } else {
        setRenderMessage('✅ Render started!')
        setRendering(false)
      }
    } catch {
      setRenderMessage('Network error')
      setRendering(false)
    }
  }, [clip, settings, startPolling])

  const [makeViralLoading, setMakeViralLoading] = useState(false)
  const [analysisSequenceActive, setAnalysisSequenceActive] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)

  // ── Bonus reveal state (UX: bonuses only shown on action, never on arrival) ──
  const [revealedBonuses, setRevealedBonuses] = useState<Set<string>>(new Set())
  const [ephemeralDelta, setEphemeralDelta] = useState<{ section: string; value: number } | null>(null)
  const ephemeralTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Advance render stages while rendering (simulated — VPS doesn't report stages)
  useEffect(() => {
    if (!rendering || analysisSequenceActive) {
      setRenderStageIdx(-1)
      if (renderStageTimerRef.current) clearTimeout(renderStageTimerRef.current)
      return
    }
    setRenderStageIdx(0)
    let idx = 0
    function advance() {
      idx++
      if (idx < RENDER_STAGES.length) {
        setRenderStageIdx(idx)
        if (idx < RENDER_STAGE_DURATIONS_MS.length) {
          renderStageTimerRef.current = setTimeout(advance, RENDER_STAGE_DURATIONS_MS[idx])
        }
      }
    }
    renderStageTimerRef.current = setTimeout(advance, RENDER_STAGE_DURATIONS_MS[0])
    return () => {
      if (renderStageTimerRef.current) clearTimeout(renderStageTimerRef.current)
    }
  }, [rendering, analysisSequenceActive])
  const pendingAutoRenderRef = useRef(false)
  const appliedCaptionStyleRef = useRef<string | null>(null)

  // Preview render state (set by handlePreview if re-enabled)
  const [previewVideoUrl] = useState<string | null>(null)
  const [previewRenderTime] = useState<number | null>(null)

  // Pending preset for incremental application during AI Analysis Sequence
  // (settings get applied step-by-step so the Blowup Chance score climbs in real-time)
  const pendingPresetRef = useRef<MoodPreset | null>(null)

  // Mood detection state
  const [detectedMood, setDetectedMood] = useState<ClipMood | null>(null)
  const [moodConfidence, setMoodConfidence] = useState<number>(0)
  const [moodExplanation, setMoodExplanation] = useState<string | null>(null)
  const [secondaryMood, setSecondaryMood] = useState<ClipMood | null>(null)
  const [selectedMood, setSelectedMood] = useState<ClipMood | null>(null)
  const [moodAiDetected, setMoodAiDetected] = useState(false)
  const [aiReasons, setAiReasons] = useState<{ caption?: string; emphasis?: string; hook?: string }>({})

  // Viral score — mood-match bonus uses detected/selected mood
  const currentScore = useMemo(() => {
    if (!scores) return baselineScore
    const activeMood = selectedMood ?? detectedMood
    return computeCurrentScore(settings, scores, baselineScore, activeMood)
  }, [settings, scores, baselineScore, selectedMood, detectedMood])

  // ── Animated score count-up ──
  const [displayScore, setDisplayScore] = useState(currentScore)
  const prevScoreRef = useRef(currentScore)
  useEffect(() => {
    const from = prevScoreRef.current
    const to = currentScore
    prevScoreRef.current = to
    if (from === to) return
    const duration = 500 // ms
    const startTime = performance.now()
    let raf: number
    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = Math.round((from + (to - from) * eased) * 10) / 10
      setDisplayScore(value)
      if (progress < 1) {
        raf = requestAnimationFrame(animate)
      }
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [currentScore])

  // Per-section score breakdown for "+X pts" labels
  const scoreBreakdown = useMemo(() => {
    const activeMood = selectedMood ?? detectedMood
    return computeScoreBreakdown(settings, baselineScore, activeMood)
  }, [settings, baselineScore, selectedMood, detectedMood])

  // ── updateSetting with ephemeral delta (defined here because it depends on state above) ──
  const SETTING_TO_SECTION: Record<string, keyof Omit<ScoreBreakdown, 'total'>> = useMemo(() => ({
    captionsEnabled: 'captions', captionStyle: 'captions', emphasisEffect: 'captions',
    emphasisColor: 'captions', captionPosition: 'captions', wordsPerLine: 'captions',
    tagStyle: 'tag', tagSize: 'tag',
    smartZoomEnabled: 'smartZoom', smartZoomMode: 'smartZoom',
    audioEnhanceEnabled: 'audio', bassBoost: 'audio', speedRamp: 'audio',
    autoCutEnabled: 'autoCut', autoCutThreshold: 'autoCut',
    hookEnabled: 'hook', hookTextEnabled: 'hook', hookReorderEnabled: 'hook',
    hookStyle: 'hook', hookTextPosition: 'hook', hookLength: 'hook', hookText: 'hook', hookReorder: 'hook',
  }), [])

  const updateSetting = useCallback(<K extends keyof EnhanceSettings>(key: K, value: EnhanceSettings[K]) => {
    // Compute ephemeral delta for manual changes (not during AI optimize)
    if (!analysisSequenceActive) {
      const section = SETTING_TO_SECTION[key as string]
      if (section && !revealedBonuses.has(section)) {
        const activeMood = selectedMood ?? detectedMood
        setSettings((prev) => {
          const newSettings = { ...prev, [key]: value }
          const oldBreakdown = computeScoreBreakdown(prev, baselineScore, activeMood)
          const newBreakdown = computeScoreBreakdown(newSettings, baselineScore, activeMood)
          const delta = Math.round((newBreakdown[section] - oldBreakdown[section]) * 10) / 10
          if (delta !== 0) {
            setEphemeralDelta({ section, value: delta })
            if (ephemeralTimerRef.current) clearTimeout(ephemeralTimerRef.current)
            ephemeralTimerRef.current = setTimeout(() => setEphemeralDelta(null), 2500)
          }
          return newSettings
        })
      } else {
        setSettings((s) => ({ ...s, [key]: value }))
      }
    } else {
      setSettings((s) => ({ ...s, [key]: value }))
    }
    // Auto-switch to Enhanced preview on first change
    if (!hasUserChangedSettings.current) {
      hasUserChangedSettings.current = true
      setShowEnhancements(true)
    }
    // Mark that settings changed since last render (keep CTA panel visible)
    if (renderDownloadUrl) {
      if (isRenderedVideo) setIsRenderedVideo(false)
      setSettingsChangedSinceRender(true)
    }
  }, [isRenderedVideo, renderDownloadUrl, analysisSequenceActive, SETTING_TO_SECTION, selectedMood, detectedMood, baselineScore, revealedBonuses])

  // Helper: compute real impact on "Blowup Chance" for each option
  // Helper: compute real impact on "Blowup Chance" using diminishing returns
  // Only show score badges AFTER the user has clicked "Make it viral" or manually selected a mood.
  // Before that, no points are attributed to any option.
  const hasAiAnalyzed = !!(selectedMood || detectedMood)

  const getRealImpact = useCallback((
    category: 'caption' | 'emphasis' | 'tag',
    optionId: string,
    bestId: string
  ): { impact: number; isMoodPick: boolean } => {
    // No scores until AI has analyzed
    if (!selectedMood && !detectedMood) return { impact: 0, isMoodPick: false }

    const headroom = Math.max(0, 99 - baselineScore)
    const BASE_W: Record<string, number> = { caption: 0.14, emphasis: 0.08, tag: 0.08 }
    const MOOD_W: Record<string, number> = { caption: 0.06, emphasis: 0.04, tag: 0 }

    if (optionId === 'none') {
      if (selectedMood) {
        const preset = MOOD_PRESETS[selectedMood]
        const moodVal = category === 'caption' ? preset.captionStyle
          : category === 'emphasis' ? preset.emphasisEffect
          : preset.tagStyle
        if (moodVal === 'none') return { impact: 0, isMoodPick: true }
      }
      return { impact: 0, isMoodPick: false }
    }

    let weight = BASE_W[category]
    let isMoodPick = false

    if (selectedMood) {
      const preset = MOOD_PRESETS[selectedMood]
      const moodVal = category === 'caption' ? preset.captionStyle
        : category === 'emphasis' ? preset.emphasisEffect
        : preset.tagStyle
      if (optionId === moodVal) {
        weight += MOOD_W[category]
        isMoodPick = true
      }
    }

    const impact = Math.round(headroom * weight * 10) / 10
    return { impact, isMoodPick }
  }, [selectedMood, detectedMood, baselineScore])

  // Helper: compute points for a given weight (used for toggle options in zoom/audio/cut/hook)
  const getOptionPts = useCallback((weight: number): number => {
    if (!hasAiAnalyzed) return 0
    const headroom = Math.max(0, 99 - baselineScore)
    return Math.round(headroom * weight * 10) / 10
  }, [hasAiAnalyzed, baselineScore])

  const applyMoodPreset = useCallback((preset: MoodPreset) => {
    appliedCaptionStyleRef.current = preset.captionStyle

    // Correct cross-platform tags
    let tagStyle = preset.tagStyle
    const p = (clip?.platform ?? '').toLowerCase()
    if (p === 'twitch') {
      if (tagStyle === 'kick-glow') tagStyle = 'viral-glow'
      else if (tagStyle === 'kick-minimal') tagStyle = 'twitch-minimal'
    } else if (p === 'kick') {
      if (tagStyle === 'viral-glow') tagStyle = 'kick-glow'
      else if (tagStyle === 'twitch-minimal') tagStyle = 'kick-minimal'
    }

    setSettings((s) => ({
      ...s,
      captionsEnabled: true,
      captionStyle: preset.captionStyle,
      emphasisEffect: preset.emphasisEffect,
      emphasisColor: preset.emphasisColor,
      captionPosition: preset.captionPosition,
      wordsPerLine: preset.wordsPerLine,
      videoZoom: preset.videoZoom,
      tagStyle,
      tagSize: preset.tagSize,
      aspectRatio: preset.aspectRatio,
      smartZoomEnabled: false, // frozen (COMING_SOON_FEATURES)
      smartZoomMode: preset.smartZoomMode,
      audioEnhanceEnabled: preset.audioEnhanceEnabled,
      autoCutEnabled: preset.autoCutEnabled,
      autoCutThreshold: preset.autoCutThreshold,
      hookEnabled: preset.hookEnabled,
      hookTextEnabled: preset.hookTextEnabled,
      hookReorderEnabled: false, // frozen (COMING_SOON_FEATURES)
      hookStyle: preset.hookStyle,
      hookTextPosition: preset.hookTextPosition,
      hookLength: preset.hookLength,
    }))
  }, [clip?.platform])

  const handleMoodSelect = useCallback((mood: ClipMood) => {
    setSelectedMood(mood)
    setMoodAiDetected(false) // user override
    applyMoodPreset(getMoodPresetForClip(mood, clip?.platform ?? 'twitch'))
  }, [applyMoodPreset, clip])

  // Apply mood preset INCREMENTALLY as the AI Analysis Sequence advances.
  // Each step that completes triggers application of the settings for the NEXT step,
  // so when the next phrase appears, the Blowup Chance score has already updated.
  // This makes the score climb in real-time as the user watches the AI "work".
  const applyMoodPresetStage = useCallback((completedStepIdx: number) => {
    const preset = pendingPresetRef.current
    if (!preset) return

    let tagStyle = preset.tagStyle
    const p = (clip?.platform ?? '').toLowerCase()
    if (p === 'twitch') {
      if (tagStyle === 'kick-glow') tagStyle = 'viral-glow'
      else if (tagStyle === 'kick-minimal') tagStyle = 'twitch-minimal'
    } else if (p === 'kick') {
      if (tagStyle === 'viral-glow') tagStyle = 'kick-glow'
      else if (tagStyle === 'twitch-minimal') tagStyle = 'kick-minimal'
    }

    setSettings((s) => {
      // Apply settings for the step ABOUT TO display (completedStepIdx + 1)
      switch (completedStepIdx) {
        case 0: // Next: "Detecting emotional peaks..." → small frame match bonus
          return {
            ...s,
            videoZoom: preset.videoZoom,
            aspectRatio: preset.aspectRatio,
          }
        case 1: { // Next: "Optimizing caption style..." → big captions boost
          // If burned-in captions detected with high confidence, disable ours to avoid doubling
          const skipCaptions = burnedCaptions?.detected && burnedCaptions.confidence >= 0.7
          return {
            ...s,
            captionsEnabled: !skipCaptions,
            captionStyle: skipCaptions ? 'none' : preset.captionStyle,
            captionPosition: preset.captionPosition,
            wordsPerLine: preset.wordsPerLine,
          }
        }
        case 2: // Next: "Selecting emphasis & color..." → emphasis boost
          return {
            ...s,
            emphasisEffect: preset.emphasisEffect,
            emphasisColor: preset.emphasisColor,
          }
        case 3: // Next: "Crafting viral hook..." → hook text boost (zoom+reorder frozen)
          return {
            ...s,
            hookEnabled: preset.hookEnabled,
            hookTextEnabled: preset.hookTextEnabled,
            hookReorderEnabled: false, // frozen (COMING_SOON_FEATURES)
            hookStyle: preset.hookStyle,
            hookTextPosition: preset.hookTextPosition,
            hookLength: preset.hookLength,
            smartZoomEnabled: false, // frozen (COMING_SOON_FEATURES)
            smartZoomMode: preset.smartZoomMode,
          }
        case 4: // Next: "Finalizing parameters..." → tag + audio + autocut remaining
          return {
            ...s,
            tagStyle,
            tagSize: preset.tagSize,
            audioEnhanceEnabled: preset.audioEnhanceEnabled,
            autoCutEnabled: preset.autoCutEnabled,
            autoCutThreshold: preset.autoCutThreshold,
          }
        default:
          return s
      }
    })
  }, [clip?.platform, burnedCaptions])

  const applyBestCombo = useCallback(async () => {
    if (!clip) return
    setMakeViralLoading(true)
    setAnalysisComplete(false)

    try {
    // 1. Detect mood via AI + generate hook — both run, then sequence plays
    const platform = clip.platform ?? 'twitch'
    let preset: MoodPreset = getMoodPresetForClip('hype', platform) // fallback
    try {
      const moodController = new AbortController()
      const moodTimeout = setTimeout(() => moodController.abort(), 15000)
      const moodRes = await fetch('/api/enhance/ai-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: clip.description || clip.title || '',
          title: clip.title || '',
          streamer: clip.author_name || clip.author_handle || '',
          niche: clip.niche || 'irl',
        }),
        signal: moodController.signal,
      })
      clearTimeout(moodTimeout)
      const moodJson = await moodRes.json()
      if (moodRes.ok && !moodJson.error && moodJson.data) {
        const detected = moodJson.data.mood as ClipMood
        preset = getMoodPresetForClip(detected, platform)
        setDetectedMood(detected)
        setSelectedMood(detected)
        setMoodConfidence(moodJson.data.confidence ?? 0)
        setMoodExplanation(moodJson.data.explanation ?? null)
        setSecondaryMood(moodJson.data.secondary_mood ?? null)
        setMoodAiDetected(true)
        // Store AI-generated justifications for the analysis sequence
        setAiReasons({
          caption: typeof moodJson.data.caption_reason === 'string' ? moodJson.data.caption_reason : undefined,
          emphasis: typeof moodJson.data.emphasis_reason === 'string' ? moodJson.data.emphasis_reason : undefined,
          hook: typeof moodJson.data.hook_reason === 'string' ? moodJson.data.hook_reason : undefined,
        })
        // Auto-populate important words from AI detection
        const aiWords = moodJson.data.important_words
        if (Array.isArray(aiWords) && aiWords.length > 0) {
          setSettings((s) => ({ ...s, customImportantWords: aiWords }))
        }
      }
    } catch {
      // Fallback silently to hype
      setDetectedMood('hype')
      setSelectedMood('hype')
      setMoodConfidence(30)
      setMoodExplanation('Default preset applied')
      setMoodAiDetected(false)
    }

    // 2. Stash preset for incremental application during the analysis sequence
    // (settings get applied piece-by-piece via applyMoodPresetStage so the score climbs
    // in real-time as each step displays). appliedCaptionStyleRef is still set so the
    // auto-render guard can verify correct captionStyle was applied at the end.
    pendingPresetRef.current = preset
    appliedCaptionStyleRef.current = preset.captionStyle

    // 3. Generate hook (Claude API) with the mood's hookStyle
    setHookGenerating(true)
    setHookError(null)
    try {
      const hookController = new AbortController()
      const hookTimeout = setTimeout(() => hookController.abort(), 15000)
      const res = await fetch('/api/render/hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: clip.description || '',
          title: clip.title || '',
          wordTimestamps: [],
          audioPeaks: [],
          duration: 30,
          streamerName: clip.author_name || clip.author_handle || '',
          niche: clip.niche || 'irl',
          hookLength: preset.hookLength,
          maxContext: 8,
        }),
        signal: hookController.signal,
      })
      clearTimeout(hookTimeout)
      const json = await res.json()
      if (res.ok && !json.error && json.data) {
        setHookAnalysis(json.data)
        // Auto-select the hook matching the mood's hookStyle
        const matchedHook = json.data.hooks.find((h: HookVariant) => h.style === preset.hookStyle)
        const bestHook = matchedHook || json.data.hooks[0]
        setSettings((s) => ({
          ...s,
          ...(bestHook ? {
            hookText: bestHook.text,
            hookStyle: bestHook.style as 'shock' | 'curiosity' | 'suspense',
          } : {}),
          hookReorder: null, // reorder frozen (COMING_SOON_FEATURES)
          hookReorderEnabled: false,
        }))
      }
    } catch {
      setSettings((s) => ({ ...s, hookReorderEnabled: false, hookReorder: null }))
    } finally {
      setHookGenerating(false)
    }

    // 4. API calls done, data is ready — NOW start the analysis sequence
    setMakeViralLoading(false)
    setAnalysisSequenceActive(true)
    setShowEnhancements(true)

    // 5. Auto-render will trigger after sequence completes (onComplete callback)
    pendingAutoRenderRef.current = true
    } catch {
      setMakeViralLoading(false)
    }
  }, [clip, applyMoodPreset])

  // Auto-render is now triggered from the AIAnalysisSequence onComplete callback
  // (after ALL staged settings have been applied), so the render uses the full preset.
  // We keep this useEffect as a safety net in case the sequence is somehow skipped:
  // it only fires if the sequence is no longer active AND analysis is complete.
  useEffect(() => {
    if (!pendingAutoRenderRef.current) return
    if (rendering) return
    if (analysisSequenceActive) return // wait for sequence to finish before auto-rendering
    if (!analysisComplete) return // need full analysis cycle done
    // Check captionStyle matches the applied preset (final staged setting)
    const expected = appliedCaptionStyleRef.current
    if (expected && settings.captionStyle !== expected) return
    // Hook reorder: if enabled but missing, proceed anyway (render works without reorder)
    pendingAutoRenderRef.current = false
    appliedCaptionStyleRef.current = null
    handleRender()
  }, [settings, rendering, handleRender, analysisSequenceActive, analysisComplete])

  // ── Hook Generator ────────────────────────────────────────────────────
  const generateHook = useCallback(async () => {
    if (!clip) return
    setHookGenerating(true)
    setHookError(null)
    try {
      const hookController = new AbortController()
      const hookTimeout = setTimeout(() => hookController.abort(), 15000)
      const res = await fetch('/api/render/hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: clip.description || '',
          title: clip.title || '',
          wordTimestamps: [],
          audioPeaks: [],
          duration: 30,
          streamerName: clip.author_name || clip.author_handle || '',
          niche: clip.niche || 'irl',
          hookLength: settings.hookLength,
          maxContext: 8,
        }),
        signal: hookController.signal,
      })
      clearTimeout(hookTimeout)
      const json = await res.json()
      if (!res.ok || json.error) {
        setHookError(json.message || json.error || 'Error generating hooks')
        return
      }
      setHookAnalysis(json.data)
      // Always store reorder data (even if no matching hook text)
      const matchingHook = json.data.hooks.find((h: HookVariant) => h.style === settings.hookStyle)
      const bestHook = matchingHook || json.data.hooks?.[0]
      setSettings((s) => ({
        ...s,
        ...(bestHook ? { hookText: bestHook.text } : {}),
        hookReorder: json.data.reorder,
      }))
    } catch {
      setHookError('Network error')
    } finally {
      setHookGenerating(false)
    }
  }, [clip, settings.hookLength, settings.hookStyle])

  // ── Loading / Error ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-in fade-in duration-300">
        {/* Header skeleton */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-md bg-muted/40 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-2/3 rounded bg-muted/40 animate-pulse" />
            <div className="h-4 w-1/3 rounded bg-muted/30 animate-pulse" />
          </div>
        </div>

        {/* 2-column skeleton matching real layout */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
          {/* Left: settings panels */}
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card/40 p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted/40" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-1/3 rounded bg-muted/40" />
                    <div className="h-3 w-1/2 rounded bg-muted/30" />
                  </div>
                  <div className="w-10 h-6 rounded-full bg-muted/40" />
                </div>
                <div className="h-20 rounded-md bg-muted/20" />
              </div>
            ))}
          </div>

          {/* Right: sticky preview */}
          <div className="space-y-3">
            <div className="aspect-[9/16] rounded-xl bg-muted/40 animate-pulse" />
            <div className="h-10 rounded-md bg-muted/30 animate-pulse" />
            <div className="h-10 rounded-md bg-muted/30 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !clip) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <p className="text-destructive font-medium">{error ?? 'Clip not found'}</p>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to feed
          </Button>
        </Link>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────────────

  return (
    <div className="animate-in fade-in duration-500">
      <style jsx>{`
        @keyframes stepFade {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Back button + unified PageHeader (Wand2 icon + cyan accent for brand consistency) */}
      <PageHeader
        icon={Wand2}
        title="Enhance Clip"
        subtitle={`${clip.title ?? 'Clip de stream'} — ${clip.author_handle ? `@${clip.author_handle}` : clip.author_name}`}
        accent="cyan"
        rightSlot={
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5 h-9">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
        }
      />

      {/* Two-column layout: Sticky Preview | Scrollable Settings */}
      <div className="grid lg:grid-cols-[330px_1fr] gap-6">
        {/* Left: Preview only — truly sticky with its own overflow so it
            never clips behind the viewport even when the preview block
            (toggle + 9:16 video + generate button + status) is taller
            than the available space. */}
        <div
          className="lg:sticky lg:top-4 lg:self-start space-y-3 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]"
        >
          {/* ── Preview Toggle ──
              Initial: [Original | Enhanced] — Original active by default (user sees raw material first)
              AI Optimize / manual change → auto-switch to Enhanced (before/after moment)
              After render: [Original | Rendered] — Enhanced replaced by actual baked MP4 */}
          {/* Compact preview pills */}
          <div className="flex gap-1.5 justify-center">
            <button
              onClick={() => { setShowEnhancements(false); setIsRenderedVideo(false) }}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-semibold transition-all',
                !showEnhancements
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              Original
            </button>
            {(!renderDownloadUrl || settingsChangedSinceRender) && (
              <button
                onClick={() => { setShowEnhancements(true); setIsRenderedVideo(false) }}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-semibold transition-all',
                  showEnhancements && !isRenderedVideo
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                Enhanced
              </button>
            )}
            {renderDownloadUrl && (
              <button
                onClick={() => { setIsRenderedVideo(true); setShowEnhancements(true) }}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-semibold transition-all',
                  isRenderedVideo
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                Rendered
              </button>
            )}
          </div>

          {/* ── Preview ── */}
          {/* 3 modes: Original (no overlays), Enhanced (CSS overlays on original video), Rendered (baked MP4) */}
          <LivePreview
            clip={clip}
            videoUrl={isRenderedVideo ? videoUrl : (originalVideoUrl ?? videoUrl)}
            settings={settings}
            showEnhancements={!isRenderedVideo && showEnhancements}
            isRenderedVideo={isRenderedVideo}
            renderedThumbnailUrl={renderedThumbnailUrl}
          />
          {/* Kill switch safeguard: caption overlay is a CSS approximation.
              Timing and exact font metrics differ from FFmpeg ASS rendering. */}
          {showEnhancements && settings.captionsEnabled && !isRenderedVideo && (
            <p className="text-[10px] text-zinc-600 text-center leading-snug px-1">
              Preview approximates the final render — caption timing may vary slightly
            </p>
          )}

          {/* Quota counter (free plan only) */}
          {userPlan === 'free' && !renderDownloadUrl && !rendering && (
            <p className="text-xs text-zinc-500 text-center">
              Free plan: render {monthlyUsed} of {PLANS.free.limits.maxVideosPerMonth} this month
              {bonusVideos > 0 && <span className="text-amber-400"> (+{bonusVideos} bonus)</span>}
            </p>
          )}

          {/* Generate button — hidden when AI flow active or render done */}
          {!renderDownloadUrl && !makeViralLoading && !analysisSequenceActive && !rendering && (
            <Button
              className="w-full h-12 font-bold text-base gap-2 rounded-xl text-amber-950"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)', boxShadow: '0 0 20px rgba(245, 158, 11, 0.22)' }}
              onClick={handleRender}
            >
              <Zap className="h-5 w-5" /> Generate clip
            </Button>
          )}

          {/* Render error messages */}
          {renderMessage && (renderMessage.includes('Error') || renderMessage.includes('❌')) && (() => {
            const cleaned = renderMessage.replace(/^❌\s*/, '').replace(/^Error\s*:\s*/, '')
            const kind = classifyError(cleaned)
            return (
              <ErrorCard
                kind={kind}
                title="Render failed"
                description={
                  kind === 'timeout'
                    ? "The render server timed out. Your clip might be too long — try again or shorten it."
                    : kind === 'quota'
                      ? 'You\'ve reached your clip limit this month.'
                      : kind === 'network'
                        ? 'Check your internet connection and try again.'
                        : 'Something went wrong on our end. Try again — if it persists, we\'ll look into it.'
                }
                details={cleaned}
                onRetry={() => {
                  setRenderMessage(null)
                  handleRender()
                }}
                secondaryAction={
                  kind === 'quota'
                    ? { label: 'See options', onClick: () => setShowPaywall(true) }
                    : undefined
                }
              />
            )
          })()}

          {/* Download + Publish — visible once AI flow starts or render done */}
          {(makeViralLoading || analysisSequenceActive || rendering || renderDownloadUrl) && (
            <div className="flex flex-col gap-2">
              {/* Progress / success message */}
              {renderMessage && !renderMessage.includes('Error') && !renderMessage.includes('❌') && (
                <p className={cn(
                  'text-sm font-medium text-center',
                  renderMessage.includes('⚠️') ? 'text-amber-400' :
                  renderMessage.includes('⏳') || renderMessage.includes('📸') ? 'text-blue-400' :
                  'text-green-400'
                )}>
                  {renderMessage}
                </p>
              )}

              {/* Rendering progress is now shown inside the va-panel card in the sticky preview column */}

              {/* Post-render CTAs — Bank is primary (autofarm), Publish is secondary, Download is tertiary */}
              {renderDownloadUrl && (
                <div className="flex flex-col gap-2.5" style={{ animation: 'stepFade 0.4s ease-out' }}>
                  {/* Re-generate notice when settings changed since last render */}
                  {settingsChangedSinceRender && (
                    <div className="flex flex-col gap-1.5" style={{ animation: 'stepFade 0.3s ease-out' }}>
                      <p className="text-[10px] text-amber-400/70 text-center">Options below apply to your last render</p>
                      <button
                        onClick={handleRender}
                        disabled={rendering}
                        className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl font-bold text-sm transition-all text-amber-950 disabled:opacity-70"
                        style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)', boxShadow: '0 0 16px rgba(245, 158, 11, 0.18)' }}
                      >
                        <Zap className="h-4 w-4" />
                        Re-generate with new settings
                      </button>
                    </div>
                  )}
                  {/* PRIMARY: Place in bank — amber constitution gradient, main autofarm flow */}
                  {bankError && (
                    <p className="text-xs text-red-400 text-center">{bankError}</p>
                  )}
                  {!placedInBank ? (
                    <button
                      onClick={async () => {
                        setBankLoading(true)
                        setBankError(null)
                        try {
                          const res = await fetch('/api/distribution/bank', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ clipId }),
                          })
                          const json = await res.json()
                          if (!res.ok || json.error) {
                            setBankError(json.error || json.message || 'Failed to place in bank')
                            return
                          }
                          setPlacedInBank(true)
                          setRenderMessage('✓ Clip placed in your bank — Smart Queue will schedule it.')
                        } catch {
                          setBankError('Network error — try again')
                        } finally {
                          setBankLoading(false)
                        }
                      }}
                      disabled={bankLoading}
                      className="group inline-flex flex-col items-center justify-center gap-1 w-full h-16 rounded-xl font-bold text-amber-950 transition-all hover:scale-[1.01] disabled:opacity-70"
                      style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)', boxShadow: '0 0 20px rgba(245, 158, 11, 0.22)' }}
                    >
                      <span className="inline-flex items-center gap-2.5 text-lg">
                        {bankLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                        {bankLoading ? 'Placing...' : 'Place in bank'}
                      </span>
                      <span className="text-[10px] font-medium text-amber-950/70">Smart Queue picks the optimal time + platform</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push(`/dashboard/distribution?scrollTo=bank&highlight=${clipId}`)}
                      className="inline-flex flex-col items-center justify-center gap-1 w-full h-16 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.01]"
                    >
                      <span className="inline-flex items-center gap-2.5 text-lg">
                        <Check className="h-5 w-5" />
                        In bank
                      </span>
                      <span className="text-[10px] font-medium opacity-90">View in Distribution</span>
                    </button>
                  )}

                  {/* CHAIN FARMING: Next best clip card — shown after banking */}
                  {placedInBank && (
                    nextBestClip ? (
                      <button
                        onClick={() => {
                          track('chain_farm_next_clip', { from_clip: clipId, to_clip: nextBestClip.id })
                          router.push(`/dashboard/enhance/${nextBestClip.id}`)
                        }}
                        className="group w-full rounded-xl border border-amber-500/40 bg-amber-500/8 hover:bg-amber-500/15 hover:border-amber-500/60 p-3 text-left transition-all"
                        style={{ animation: 'stepFade 0.4s ease-out' }}
                      >
                        <div className="flex items-center gap-3">
                          {nextBestClip.thumbnail_url && (
                            <img
                              src={nextBestClip.thumbnail_url}
                              alt=""
                              className="w-14 h-10 rounded-md object-cover shrink-0 border border-white/10"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80 block mb-0.5">Next best clip</span>
                            <span className="text-xs font-semibold text-foreground block truncate">
                              {nextBestClip.title || 'Untitled clip'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {nextBestClip.velocity_score != null && `Score ${Math.round(nextBestClip.velocity_score)}`}
                              {nextBestClip.tier && ` · ${nextBestClip.tier.replace('_', ' ')}`}
                            </span>
                          </div>
                          <span className="text-amber-400 text-xs font-bold whitespace-nowrap group-hover:translate-x-0.5 transition-transform">
                            <Zap className="h-3.5 w-3.5 inline mr-0.5" />
                            Enhance →
                          </span>
                        </div>
                      </button>
                    ) : (
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 text-xs font-bold transition-all"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Find your next clip
                      </Link>
                    )
                  )}

                  {/* SECONDARY: Publish now — soft/outline amber */}
                  <button
                    onClick={() => setShowPublishDialog(true)}
                    className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-lg border border-amber-500/40 bg-amber-500/8 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/60 text-sm font-bold transition-all"
                  >
                    <Send className="h-4 w-4" />
                    Publish now
                  </button>

                  {/* TERTIARY: Download — outline discret, smaller */}
                  <a
                    href={renderDownloadUrl}
                    download="viral-clip.mp4"
                    className="inline-flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-zinc-700/60 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-all"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download MP4
                  </a>

                  {/* Referral invite CTA */}
                  {referralCode && (
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/signup?ref=${referralCode}`
                        if (navigator.share) {
                          navigator.share({ title: 'Viral Animal', text: 'Make your clips go viral — we both get +3 bonus clips!', url }).catch(() => {})
                        } else {
                          navigator.clipboard.writeText(url).catch(() => {})
                          setRenderMessage('Invite link copied!')
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 text-xs font-medium transition-all"
                    >
                      <Gift className="h-3.5 w-3.5" />
                      Invite a friend — you both get +3 clips
                    </button>
                  )}

                  {/* Back to Browse — discrete link for chain farming alternative */}
                  {placedInBank && (
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center justify-center gap-1.5 w-full h-8 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      Back to Browse
                    </Link>
                  )}

                  {/* Reset */}
                  <button
                    onClick={() => {
                      setSettings({ ...DEFAULT_SETTINGS })
                      setIsRenderedVideo(false)
                      setRenderDownloadUrl(null)
                      setRenderMessage(null)
                      setDetectedMood(null)
                      setSelectedMood(null)
                      setMoodAiDetected(false)
                      setHookAnalysis(null)
                      setMakeViralLoading(false)
                      setAnalysisSequenceActive(false)
                      setAnalysisComplete(false)
                      setRendering(false)
                      setShowEnhancements(false)
                      setPlacedInBank(false)
                      setSettingsChangedSinceRender(false)
                      setBankLoading(false)
                      setBankError(null)
                      hasUserChangedSettings.current = false
                      if (originalVideoUrl) setVideoUrl(originalVideoUrl)
                    }}
                    className="inline-flex items-center justify-center gap-2 w-full h-9 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset &amp; start over
                  </button>
                </div>
              )}

              {/* During render: single "Rendering your clip" card replaces all actions */}
              {!renderDownloadUrl && rendering && !analysisSequenceActive && (
                <div className="va-panel flex flex-col items-center gap-3 text-center">
                  <WolfLoader variant="sequence" mode="amber" size={64} progress={renderStageIdx >= 0 ? Math.round(((renderStageIdx + 1) / RENDER_STAGES.length) * 100) : 0} />
                  <div>
                    <p className="text-sm font-bold text-zinc-100">Rendering your clip</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{renderStageIdx >= 0 ? RENDER_STAGES[renderStageIdx] : 'Starting'}...</p>
                  </div>
                  {/* FFmpeg stage pipeline — desktop: full labels, mobile: single progress bar */}
                  <div className="hidden md:flex items-start gap-1 w-full">
                    {RENDER_STAGES.map((stage, i) => (
                      <div key={stage} className="flex flex-col items-center gap-1 flex-1">
                        <div className={cn(
                          'w-full h-1 rounded-full transition-all duration-700',
                          i < renderStageIdx ? 'bg-emerald-500' :
                          i === renderStageIdx ? 'bg-amber-400 animate-pulse' :
                          'bg-zinc-800'
                        )} />
                        <span className={cn(
                          'text-[8px] font-medium text-center leading-tight',
                          i < renderStageIdx ? 'text-emerald-400' :
                          i === renderStageIdx ? 'text-amber-400' :
                          'text-zinc-600'
                        )}>
                          {stage}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Mobile: compact progress */}
                  <div className="md:hidden w-full space-y-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-zinc-400">Rendering — step {Math.max(1, renderStageIdx + 1)}/{RENDER_STAGES.length}</span>
                      <span className="text-amber-400 font-medium">{renderStageIdx >= 0 ? RENDER_STAGES[renderStageIdx] : 'Starting'}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-700"
                        style={{ width: `${renderStageIdx >= 0 ? Math.round(((renderStageIdx + 1) / RENDER_STAGES.length) * 100) : 5}%` }}
                      />
                    </div>
                  </div>
                  {/* Notification opt-in */}
                  {!notifyOnDone && typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied' && (
                    <button
                      onClick={async () => {
                        const perm = await Notification.requestPermission()
                        if (perm === 'granted') setNotifyOnDone(true)
                      }}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
                    >
                      <Bell className="h-3 w-3" />
                      Notify me when done
                    </button>
                  )}
                  {notifyOnDone && (
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <Bell className="h-3 w-3" />
                      You&apos;ll be notified when done
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions + Settings — scrollable */}
        <div className="space-y-6">

          {/* ── Quick Mode (mobile only) ── */}
          <div className="lg:hidden">
            {(() => {
              const qmBusy = makeViralLoading || analysisSequenceActive || pendingAutoRenderRef.current || rendering
              const qmDone = analysisComplete && !qmBusy
              return (
                <div className="va-panel p-4 space-y-3">
                  {!qmDone ? (
                    <>
                      <div>
                        <p className="text-sm font-bold text-foreground">Make it viral</p>
                        <p className="text-[11px] text-zinc-400">AI picks the optimal setup for this clip</p>
                      </div>
                      <button
                        onClick={applyBestCombo}
                        disabled={qmBusy}
                        className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                        style={{
                          background: 'linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)',
                          color: '#451a03',
                          boxShadow: '0 0 20px rgba(245,158,11,.22)',
                        }}
                      >
                        {qmBusy ? (
                          <><WolfLoader variant="spinner" size={16} mode="amber" /> Analyzing...</>
                        ) : (
                          <><Zap className="h-4 w-4" /> Make it Viral</>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <Check className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-emerald-400">Optimized</p>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {CAPTION_STYLES.find(s => s.id === settings.captionStyle)?.label ?? 'Captions'}
                            {settings.hookEnabled && ' · Hook on'}
                            {settings.tagStyle !== 'none' && ' · Tag'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg font-black text-amber-400">{displayScore}</span>
                          <span className="text-[10px] text-zinc-500 block">score</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            {/* Separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-[11px] text-zinc-500 font-medium">or customize</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
          </div>

          {/* ── AI Optimize button (hero — desktop only, Quick Mode replaces on mobile) ── */}
          <div className="hidden lg:block">
          {(() => {
            const viralBusy = makeViralLoading || analysisSequenceActive || pendingAutoRenderRef.current || rendering
            const isAnalyzing = makeViralLoading || analysisSequenceActive
            const isComplete = analysisComplete && !viralBusy

            return (
              <button
                onClick={applyBestCombo}
                disabled={viralBusy}
                className={cn(
                  'group relative w-full rounded-2xl transition-all duration-500 overflow-hidden',
                  isComplete
                    ? 'shadow-md'
                    : viralBusy
                      ? 'shadow-lg'
                      : 'shadow-lg hover:scale-[1.015] hover:shadow-[0_0_28px_rgba(245,158,11,0.35)]'
                )}
                style={{
                  height: '58px',
                  background: isComplete
                    ? 'linear-gradient(135deg, #34d399, #10b981 45%, #059669)'
                    : 'linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)',
                  boxShadow: isComplete
                    ? '0 0 20px rgba(16, 185, 129, 0.22)'
                    : viralBusy
                      ? '0 0 20px rgba(245, 158, 11, 0.18)'
                      : '0 0 20px rgba(245, 158, 11, 0.22)',
                }}
              >
                {/* Shine sweep — idle invitation, only when not busy and not complete */}
                {!viralBusy && !isComplete && (
                  <div className="absolute inset-0 -translate-x-full animate-[shineSweep_5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
                )}
                {/* Shimmer effect during loading */}
                {isAnalyzing && (
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                )}
                <div className="relative flex items-center gap-3 px-5 h-full">
                  {isAnalyzing ? (
                    <WolfLoader variant="spinner" size={18} mode="amber" className="shrink-0" />
                  ) : isComplete ? (
                    <Check className="h-[18px] w-[18px] text-emerald-950 shrink-0" />
                  ) : (
                    <Sparkles className="h-[18px] w-[18px] text-amber-950 shrink-0 animate-[sparkPulse_5s_ease-in-out_infinite] group-hover:rotate-12 transition-transform" />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <span className={cn(
                      'text-sm font-bold tracking-tight block leading-tight',
                      isComplete ? 'text-emerald-950' : 'text-amber-950'
                    )}>
                      {isAnalyzing ? 'Analyzing clip...' : rendering ? 'Rendering...' : isComplete ? 'Optimized' : 'AI Optimize'}
                    </span>
                    <span className={cn(
                      'text-[10px] block',
                      isComplete ? 'text-emerald-950/60' : 'text-amber-950/60'
                    )}>
                      {isAnalyzing ? 'Tuning every parameter' : rendering ? 'Applying settings' : isComplete ? 'All settings tuned for this clip' : 'Best settings in one click'}
                    </span>
                  </div>
                </div>
              </button>
            )
          })()}
          </div>

          {/* ── AI Analysis Sequence (plays in right panel after API calls) ── */}
          {analysisSequenceActive && (
            <AIAnalysisSequence
              clipId={clip?.id ?? ''}
              clipDuration={clip?.duration_seconds}
              detectedMood={detectedMood}
              confidence={moodConfidence}
              captionStyle={settings.captionStyle}
              emphasisEffect={settings.emphasisEffect}
              emphasisColor={settings.emphasisColor}
              hookText={settings.hookText ?? null}
              audioPeaksCount={hookAnalysis ? hookAnalysis.peak.scores.length : undefined}
              peakTime={hookAnalysis?.peak.peakTime}
              peakScore={hookAnalysis?.peak.peakScore}
              wordTimestampsCount={undefined}
              aiReasons={moodAiDetected ? aiReasons : undefined}
              isActive={analysisSequenceActive}
              onStepComplete={applyMoodPresetStage}
              onComplete={() => {
                setAnalysisComplete(true)
                setAnalysisSequenceActive(false)
                // Stagger-reveal section bonuses (~200ms apart)
                const sections = ['captions', 'tag', 'smartZoom', 'audio', 'autoCut', 'hook', '_total'] as const
                sections.forEach((key, i) => {
                  setTimeout(() => {
                    setRevealedBonuses((prev) => new Set([...prev, key]))
                  }, i * 200)
                })
              }}
            />
          )}

          {/* ── Export CTA — secondary until AI Optimize done, then primary ── */}
          {!renderDownloadUrl && !rendering && !analysisSequenceActive && (
            analysisComplete ? (
              <Button
                className="w-full h-12 font-bold text-base gap-2 rounded-xl text-amber-950"
                style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)', boxShadow: '0 0 20px rgba(245, 158, 11, 0.22)' }}
                onClick={handleRender}
              >
                <Rocket className="h-5 w-5" /> Export Now
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full h-10 gap-2 border-zinc-700 hover:border-zinc-600 text-zinc-300 rounded-xl"
                onClick={handleRender}
              >
                <Rocket className="h-4 w-4" /> Export with current settings
              </Button>
            )
          )}

          {/* Preview video player (from real render) */}
          {previewVideoUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-green-400 flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Real FFmpeg preview
                </p>
                {previewRenderTime && (
                  <p className="text-[10px] text-zinc-500">Rendered in {previewRenderTime.toFixed(1)}s</p>
                )}
              </div>
              <video
                src={previewVideoUrl}
                controls
                autoPlay
                loop
                muted
                className="w-full rounded-xl border border-white/10 max-h-[300px] object-contain bg-black"
              />
              <p className="text-[10px] text-zinc-500 text-center">
                This is what the final render will look like. 480p preview — full render is HD.
              </p>
            </div>
          )}

          {/* ── Settings ── */}
          <div className="opacity-90 hover:opacity-100 transition-opacity duration-300">

          {/* Blowup score bar */}
          <BlowupChanceBar
            currentScore={currentScore}
            displayScore={displayScore}
            baselineScore={baselineScore}
            scoreBreakdown={scoreBreakdown}
            showBoost={revealedBonuses.has('_total')}
          />

            <Accordion multiple defaultValue={typeof window !== 'undefined' && window.innerWidth < 1024 ? [] : ['captions']} className="space-y-3 [&_[data-state]]:outline-none">

            {/* ─── Captions Section ─── */}
            <CaptionsSection
              settings={settings}
              updateSetting={updateSetting}
              scoreBreakdown={scoreBreakdown}
              hasAiAnalyzed={hasAiAnalyzed}
              analysisComplete={analysisComplete}
              moodAiDetected={moodAiDetected}
              selectedMood={selectedMood}
              detectedMood={detectedMood}
              getRealImpact={getRealImpact}
              getOptionPts={getOptionPts}
              scores={scores}
              sectionRef={sectionRefs.captions}
              hideGranular
              showBonus={revealedBonuses.has('captions')}
              ephemeralDelta={ephemeralDelta?.section === 'captions' ? ephemeralDelta.value : null}
              burnedCaptionsDetected={burnedCaptions?.detected && burnedCaptions.confidence >= 0.7}
            />

            {/* ─── Tags Section ─── */}
            <AccordionItem value="tags" ref={sectionRefs.tags} className={cn("scroll-mt-32 va-panel px-4 overflow-hidden", settings.tagStyle !== 'none' ? 'va-panel-active' : 'va-panel-muted')}>
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className={settings.tagStyle !== 'none' ? 'text-amber-400' : 'text-zinc-500'}>@</span>
                  Streamer tag
                  <span className="text-xs text-zinc-500 font-normal">
                    {settings.tagStyle !== 'none'
                      ? `· ${TAG_STYLES.find(t => t.id === settings.tagStyle)?.label ?? settings.tagStyle}`
                      : '· Off'}
                  </span>
                  {revealedBonuses.has('tag') && scoreBreakdown.tag > 0 && (
                    <span className="ml-auto text-[11px] font-bold text-emerald-400 animate-[scorePop_0.4s_ease-out]">+{Math.round(scoreBreakdown.tag)} pts</span>
                  )}
                  {!revealedBonuses.has('tag') && ephemeralDelta?.section === 'tag' && ephemeralDelta.value !== 0 && (
                    <span className={cn("ml-auto text-[11px] font-bold animate-[scorePop_0.4s_ease-out]", ephemeralDelta.value > 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {ephemeralDelta.value > 0 ? '+' : ''}{ephemeralDelta.value} pts
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <TagPanel
                  settings={settings}
                  updateSetting={updateSetting}
                  scores={scores}
                  selectedMood={selectedMood}
                  baselineScore={baselineScore}
                  hasMoodActive={hasAiAnalyzed}
                  analysisComplete={analysisComplete}
                  moodAiDetected={moodAiDetected}
                  noCard
                  platform={clip?.platform}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Format is locked to 9:16 — no UI selector */}

            {/* ─── Smart Zoom Section ─── */}
            <AccordionItem value="smartzoom" className="scroll-mt-32 va-panel px-4 overflow-hidden va-panel-muted" style={{ opacity: 0.5, pointerEvents: 'none' }}>
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Focus className="h-4 w-4 text-zinc-500" />
                  Smart Zoom
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-400 border border-zinc-600/40">Coming Soon</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {/* Master toggle */}
                  <button
                    onClick={() => updateSetting('smartZoomEnabled', !settings.smartZoomEnabled)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-all flex items-center justify-between',
                      settings.smartZoomEnabled
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <div>
                      <span className="text-sm font-semibold text-foreground block">
                        {settings.smartZoomEnabled ? 'Enabled' : 'Disabled'}
                        {hasAiAnalyzed && <span className="text-[10px] font-bold text-emerald-400 ml-2">+{getOptionPts(0.05)} pts</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Dynamic zoom for more movement & retention
                      </span>
                    </div>
                    <div className={cn(
                      'w-10 h-5 rounded-full relative transition-all',
                      settings.smartZoomEnabled ? 'bg-emerald-500' : 'bg-border'
                    )}>
                      <div className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                        settings.smartZoomEnabled ? 'left-[22px]' : 'left-0.5'
                      )} />
                    </div>
                  </button>

                  {/* Mode selector */}
                  {settings.smartZoomEnabled && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mode</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {([
                          {
                            id: 'micro' as const,
                            label: 'Micro zoom',
                            desc: 'Breathing zoom cinematic (1.05 → 1.21). Subtle & pro.',
                            badge: 'Safe',
                          },
                          {
                            id: 'dynamic' as const,
                            label: 'Dynamic',
                            desc: 'Punch zooms on audio peaks + 2.5s cooldown. Max impact.',
                            badge: 'New',
                          },
                          {
                            id: 'follow' as const,
                            label: 'Follow face',
                            desc: 'Tracks face with smooth cinematic panning. Auto-detect + smooth pan.',
                            badge: 'New',
                          },
                        ]).map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => updateSetting('smartZoomMode', mode.id)}
                            className={cn(
                              'rounded-xl border p-3 text-left transition-all',
                              settings.smartZoomMode === mode.id
                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                : 'border-border hover:border-primary/40'
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground flex-1">{mode.label}</span>
                              {hasAiAnalyzed && (() => {
                                const activeMood = selectedMood ?? detectedMood
                                const isMoodMatch = activeMood && MOOD_PRESETS[activeMood].smartZoomMode === mode.id
                                return isMoodMatch ? (
                                  <span className="text-[9px] font-bold text-emerald-400">+{getOptionPts(0.02)}</span>
                                ) : null
                              })()}
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                {mode.badge}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{mode.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ─── Audio Enhancement Section ─── */}
            <AccordionItem value="audio" className={cn("scroll-mt-32 va-panel px-4 overflow-hidden", settings.audioEnhanceEnabled ? 'va-panel-active' : 'va-panel-muted')}>
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Volume2 className={cn("h-4 w-4", settings.audioEnhanceEnabled ? 'text-amber-400' : 'text-zinc-500')} />
                  Audio Enhancement
                  <span className="text-xs text-zinc-500 font-normal">
                    {settings.audioEnhanceEnabled ? '· On' : '· Off'}
                  </span>
                  {revealedBonuses.has('audio') && scoreBreakdown.audio > 0 && (
                    <span className="ml-auto text-[11px] font-bold text-emerald-400 animate-[scorePop_0.4s_ease-out]">+{Math.round(scoreBreakdown.audio)} pts</span>
                  )}
                  {!revealedBonuses.has('audio') && ephemeralDelta?.section === 'audio' && ephemeralDelta.value !== 0 && (
                    <span className={cn("ml-auto text-[11px] font-bold animate-[scorePop_0.4s_ease-out]", ephemeralDelta.value > 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {ephemeralDelta.value > 0 ? '+' : ''}{ephemeralDelta.value} pts
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <button
                    onClick={() => updateSetting('audioEnhanceEnabled', !settings.audioEnhanceEnabled)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-all flex items-center justify-between',
                      settings.audioEnhanceEnabled
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <div>
                      <span className="text-sm font-semibold text-foreground block">
                        {settings.audioEnhanceEnabled ? 'Enabled' : 'Disabled'}
                        {hasAiAnalyzed && <span className="text-[10px] font-bold text-emerald-400 ml-2">+{getOptionPts(0.03)} pts</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Removes background noise, normalizes volume (EBU R128)
                      </span>
                    </div>
                    <div className={cn(
                      'w-10 h-5 rounded-full relative transition-all',
                      settings.audioEnhanceEnabled ? 'bg-emerald-500' : 'bg-border'
                    )}>
                      <div className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                        settings.audioEnhanceEnabled ? 'left-[22px]' : 'left-0.5'
                      )} />
                    </div>
                  </button>
                  {settings.audioEnhanceEnabled && (
                    <div className="animate-in fade-in slide-in-from-top-1 text-[10px] text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
                      <p className="font-medium text-foreground text-xs">What it does:</p>
                      <p>• High-pass filter (80Hz) — removes rumble & background noise</p>
                      <p>• FFT denoising — cleans up residual noise</p>
                      <p>• Loudness normalization — constant broadcast-style volume</p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ─── Auto-Cut Silences Section ─── */}
            <AccordionItem value="autocut" className={cn("scroll-mt-32 va-panel px-4 overflow-hidden", settings.autoCutEnabled ? 'va-panel-active' : 'va-panel-muted')}>
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Scissors className={cn("h-4 w-4", settings.autoCutEnabled ? 'text-amber-400' : 'text-zinc-500')} />
                  Auto-Cut Silences
                  <span className="text-xs text-zinc-500 font-normal">
                    {settings.autoCutEnabled ? `· On · ${settings.autoCutThreshold.toFixed(1)}s threshold` : '· Off'}
                  </span>
                  {revealedBonuses.has('autoCut') && scoreBreakdown.autoCut > 0 && (
                    <span className="ml-auto text-[11px] font-bold text-emerald-400 animate-[scorePop_0.4s_ease-out]">+{Math.round(scoreBreakdown.autoCut)} pts</span>
                  )}
                  {!revealedBonuses.has('autoCut') && ephemeralDelta?.section === 'autoCut' && ephemeralDelta.value !== 0 && (
                    <span className={cn("ml-auto text-[11px] font-bold animate-[scorePop_0.4s_ease-out]", ephemeralDelta.value > 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {ephemeralDelta.value > 0 ? '+' : ''}{ephemeralDelta.value} pts
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <button
                    onClick={() => updateSetting('autoCutEnabled', !settings.autoCutEnabled)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-all flex items-center justify-between',
                      settings.autoCutEnabled
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <div>
                      <span className="text-sm font-semibold text-foreground block">
                        {settings.autoCutEnabled ? 'Enabled' : 'Disabled'}
                        {hasAiAnalyzed && <span className="text-[10px] font-bold text-emerald-400 ml-2">+{getOptionPts(0.03)} pts</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Automatically removes silences for a punchier clip
                      </span>
                    </div>
                    <div className={cn(
                      'w-10 h-5 rounded-full relative transition-all',
                      settings.autoCutEnabled ? 'bg-emerald-500' : 'bg-border'
                    )}>
                      <div className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                        settings.autoCutEnabled ? 'left-[22px]' : 'left-0.5'
                      )} />
                    </div>
                  </button>
                  {settings.autoCutEnabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                          Silence threshold — {settings.autoCutThreshold.toFixed(1)}s
                        </Label>
                        <Slider
                          value={[settings.autoCutThreshold]}
                          onValueChange={([v]) => updateSetting('autoCutThreshold', v)}
                          min={0.3}
                          max={2}
                          step={0.1}
                          className="mt-2"
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                          <span>Aggressive (0.3s)</span>
                          <span>Gentle (2s)</span>
                        </div>
                        {(selectedMood ?? detectedMood) && (
                          <p className="text-[10px] text-purple-400 mt-1.5">
                            AI suggests {
                              (selectedMood ?? detectedMood) === 'rage' || (selectedMood ?? detectedMood) === 'hype'
                                ? '0.5s'
                                : (selectedMood ?? detectedMood) === 'drama'
                                  ? '0.7s'
                                  : `${settings.autoCutThreshold.toFixed(1)}s`
                            } for {selectedMood ?? detectedMood} clips
                          </p>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
                        <p className="font-medium text-foreground text-xs">What it does:</p>
                        <p>• Detects silences between words (via Whisper timestamps)</p>
                        <p>• Cuts pauses longer than the threshold</p>
                        <p>• Automatically realigns captions</p>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ─── Hook Viral Section ─── */}
            <AccordionItem value="hook" className={cn("scroll-mt-32 va-panel px-4 overflow-hidden", settings.hookEnabled ? 'va-panel-active' : 'va-panel-muted')}>
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Flame className={cn("h-4 w-4", settings.hookEnabled ? 'text-amber-400' : 'text-zinc-500')} />
                  Hook Viral
                  <span className="text-xs text-zinc-500 font-normal">
                    {settings.hookEnabled
                      ? `· ${settings.hookStyle.charAt(0).toUpperCase() + settings.hookStyle.slice(1)}${settings.hookText ? ` · "${settings.hookText.slice(0, 20)}${settings.hookText.length > 20 ? '...' : ''}"` : ''}`
                      : '· Off'}
                  </span>
                  {revealedBonuses.has('hook') && scoreBreakdown.hook > 0 && (
                    <span className="ml-auto text-[11px] font-bold text-emerald-400 animate-[scorePop_0.4s_ease-out]">+{Math.round(scoreBreakdown.hook)} pts</span>
                  )}
                  {!revealedBonuses.has('hook') && ephemeralDelta?.section === 'hook' && ephemeralDelta.value !== 0 && (
                    <span className={cn("ml-auto text-[11px] font-bold animate-[scorePop_0.4s_ease-out]", ephemeralDelta.value > 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {ephemeralDelta.value > 0 ? '+' : ''}{ephemeralDelta.value} pts
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {/* Master toggle */}
                  <button
                    onClick={() => updateSetting('hookEnabled', !settings.hookEnabled)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-all flex items-center justify-between',
                      settings.hookEnabled
                        ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                        : 'border-border hover:border-orange-500/40'
                    )}
                  >
                    <div>
                      <span className="text-sm font-semibold text-foreground block">
                        {settings.hookEnabled ? 'Enabled' : 'Disabled'}
                        {hasAiAnalyzed && <span className="text-[10px] font-bold text-emerald-400 ml-2">+{getOptionPts(0.11)} pts</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Big moment first → context after. Perfect loop for TikTok.
                      </span>
                    </div>
                    <div className={cn(
                      'w-10 h-5 rounded-full relative transition-all',
                      settings.hookEnabled ? 'bg-orange-500' : 'bg-border'
                    )}>
                      <div className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                        settings.hookEnabled ? 'left-[22px]' : 'left-0.5'
                      )} />
                    </div>
                  </button>

                  {/* Hook controls — only shown when enabled */}
                  {settings.hookEnabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-1">

                      {/* Sub-toggles: text overlay + reorder */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateSetting('hookTextEnabled', !settings.hookTextEnabled)}
                          className={cn(
                            'rounded-xl border p-2.5 text-center transition-all',
                            settings.hookTextEnabled
                              ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                              : 'border-border hover:border-orange-500/40'
                          )}
                        >
                          <Type className="h-4 w-4 mx-auto mb-1 text-orange-400" />
                          <span className="text-[10px] font-bold text-foreground block">Hook text</span>
                          <span className="text-[10px] md:text-[8px] text-muted-foreground block">Overlay at start</span>
                        </button>
                        <div
                          className="rounded-xl border border-border p-2.5 text-center opacity-50 cursor-not-allowed"
                        >
                          <Zap className="h-4 w-4 mx-auto mb-1 text-zinc-500" />
                          <span className="text-[10px] font-bold text-foreground block">Peak moment first</span>
                          <span className="text-[10px] md:text-[8px] px-1 py-0.5 rounded bg-zinc-700/60 text-zinc-400 font-bold uppercase tracking-wider">Coming Soon</span>
                        </div>
                      </div>

                      {/* Hook text position slider */}
                      {settings.hookTextEnabled && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Text position</Label>
                            <span className="text-xs font-bold text-orange-400">{settings.hookTextPosition}%</span>
                          </div>
                          <Slider
                            value={[settings.hookTextPosition]}
                            onValueChange={([v]) => updateSetting('hookTextPosition', v)}
                            min={5}
                            max={85}
                            step={1}
                          />
                          <div className="flex justify-between text-[9px] text-muted-foreground">
                            <span>Top</span>
                            <span>Center</span>
                            <span>Bottom</span>
                          </div>
                        </div>
                      )}

                      {/* Hook stays visible for the entire video duration */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Hook text visible for the entire clip</span>
                      </div>

                      {/* Generate button */}
                      <Button
                        onClick={generateHook}
                        disabled={hookGenerating}
                        className="w-full h-10 font-bold text-sm gap-2 rounded-xl text-amber-950"
                        style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)', boxShadow: '0 0 20px rgba(245, 158, 11, 0.18)' }}
                      >
                        {hookGenerating ? (
                          <><WolfLoader variant="spinner" size={16} mode="system" /> Analyzing…</>
                        ) : hookAnalysis ? (
                          <><Wand2 className="h-4 w-4" /> Regenerate hooks</>
                        ) : (
                          <><Wand2 className="h-4 w-4" /> Detect viral moment</>
                        )}
                      </Button>

                      {hookError && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {hookError}
                        </p>
                      )}

                      {/* Hook analysis results */}
                      {hookAnalysis && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                          {/* Peak info */}
                          <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] uppercase tracking-wider text-orange-400 font-bold">Viral moment detected</span>
                              <span className="text-xs font-mono font-bold text-orange-300">
                                {hookAnalysis.peak.peakTime.toFixed(1)}s
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, hookAnalysis.peak.peakScore * 5)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                Score: {hookAnalysis.peak.peakScore}
                              </span>
                            </div>
                            {/* Reorder structure */}
                            <div className="mt-2 flex gap-1">
                              {hookAnalysis.reorder.segments.map((seg, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    'flex-1 rounded px-1.5 py-1 text-center',
                                    seg.label === 'hook' && 'bg-orange-500/20 border border-orange-500/30',
                                    seg.label === 'context' && 'bg-blue-500/10 border border-blue-500/20',
                                    seg.label === 'payoff' && 'bg-emerald-500/10 border border-emerald-500/20',
                                  )}
                                  style={{ flex: seg.duration }}
                                >
                                  <span className={cn(
                                    'text-[9px] font-bold block',
                                    seg.label === 'hook' && 'text-orange-400',
                                    seg.label === 'context' && 'text-blue-400',
                                    seg.label === 'payoff' && 'text-emerald-400',
                                  )}>
                                    {seg.label === 'hook' ? 'HOOK' : seg.label === 'context' ? 'CONTEXT' : 'PAYOFF'}
                                  </span>
                                  <span className="text-[10px] md:text-[8px] text-muted-foreground block">{seg.duration.toFixed(1)}s</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Style selector */}
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Hook style</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { id: 'shock' as const, label: 'Shock', emoji: '💀', desc: 'Max impact' },
                              { id: 'curiosity' as const, label: 'Curiosity', emoji: '👀', desc: 'Tease the next' },
                              { id: 'suspense' as const, label: 'Suspense', emoji: '⏳', desc: 'Wait for it' },
                            ]).map((style) => (
                              <button
                                key={style.id}
                                onClick={() => {
                                  updateSetting('hookStyle', style.id)
                                  const match = hookAnalysis?.hooks.find((h) => h.style === style.id)
                                  if (match) updateSetting('hookText', match.text)
                                }}
                                className={cn(
                                  'rounded-xl border p-2.5 text-center transition-all',
                                  settings.hookStyle === style.id
                                    ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                                    : 'border-border hover:border-orange-500/40'
                                )}
                              >
                                <span className="text-lg block">{style.emoji}</span>
                                <span className="text-[10px] font-bold text-foreground block mt-1">
                                  {style.label}
                                  {analysisComplete && moodAiDetected && (() => {
                                    const activeMood = selectedMood ?? detectedMood
                                    return activeMood && MOOD_PRESETS[activeMood].hookStyle === style.id ? (
                                      <span className="ml-1 text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full border border-emerald-400/20">AI</span>
                                    ) : null
                                  })()}
                                </span>
                                <span className="text-[10px] md:text-[8px] text-muted-foreground block">{style.desc}</span>
                              </button>
                            ))}
                          </div>

                          {/* Hook text variants */}
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Hook text</Label>
                          <div className="space-y-2">
                            {hookAnalysis.hooks.map((hook, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  updateSetting('hookText', hook.text)
                                  updateSetting('hookStyle', hook.style as 'shock' | 'curiosity' | 'suspense')
                                }}
                                className={cn(
                                  'w-full rounded-xl border p-3 text-left transition-all',
                                  settings.hookText === hook.text
                                    ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                                    : 'border-border hover:border-orange-500/40'
                                )}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[9px] font-bold text-orange-400 uppercase">{hook.label}</span>
                                  {settings.hookText === hook.text && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300">
                                      Selected
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-bold text-foreground">{hook.text}</span>
                              </button>
                            ))}
                          </div>

                          {/* Custom hook text input */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground">Or write your own hook:</Label>
                            <input
                              type="text"
                              value={settings.hookText}
                              onChange={(e) => updateSetting('hookText', e.target.value)}
                              placeholder="YOUR CUSTOM HOOK..."
                              className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-xs font-bold text-foreground placeholder:text-muted-foreground/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-all"
                              maxLength={60}
                            />
                            <span className="text-[9px] text-muted-foreground">{settings.hookText.length}/60</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
            {/* ─── Advanced ─── */}
            {/* Granular controls: caption position, words/line, custom words, watermark.
                Kept out of the Captions section so the default view stays lean ("glance and approve"). */}
            <AccordionItem value="advanced" className="scroll-mt-32 va-panel px-4 overflow-hidden va-panel-muted">
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
                  Advanced
                  <span className="text-xs text-zinc-500 font-normal">· Position, words per line, watermark</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-5">

                  {/* Caption vertical position */}
                  {settings.captionsEnabled && settings.captionStyle !== 'none' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Caption Position</Label>
                        <span className="text-xs font-semibold text-foreground">{settings.captionPosition}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Top</span>
                        <Slider
                          value={[settings.captionPosition]}
                          onValueChange={([v]) => updateSetting('captionPosition', v)}
                          min={0}
                          max={100}
                          step={1}
                        />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Bottom</span>
                      </div>
                      <div className="flex justify-center gap-2">
                        {([
                          { label: 'Top', value: 8 },
                          { label: 'Middle', value: 42 },
                          { label: 'Bottom', value: 72 },
                        ]).map((p) => (
                          <button
                            key={p.label}
                            onClick={() => updateSetting('captionPosition', p.value)}
                            className={cn(
                              'rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all',
                              Math.abs(settings.captionPosition - p.value) <= 3
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border hover:border-primary/40 text-muted-foreground'
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Words per line */}
                  {settings.captionsEnabled && settings.captionStyle !== 'none' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Words per Line</Label>
                        <span className="text-xs font-mono text-muted-foreground">{settings.wordsPerLine}</span>
                      </div>
                      <Slider
                        value={[settings.wordsPerLine]}
                        onValueChange={([v]) => updateSetting('wordsPerLine', v)}
                        min={1}
                        max={8}
                        step={1}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground/60">
                        <span>1 (single)</span>
                        <span>8 (compact)</span>
                      </div>
                    </div>
                  )}

                  {/* Custom important words */}
                  {settings.captionsEnabled && settings.captionStyle !== 'none' && (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Custom Important Words</Label>
                      <p className="text-[10px] text-muted-foreground">
                        Words highlighted in <span className="text-red-400 font-bold">red</span> in captions.
                        Auto-detected (CAPS, viral words) + custom.
                      </p>
                      {settings.customImportantWords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
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
                          const input = (e.currentTarget.elements.namedItem('advWord') as HTMLInputElement)
                          const word = input.value.trim()
                          if (word && !settings.customImportantWords.includes(word.toLowerCase())) {
                            updateSetting('customImportantWords', [...settings.customImportantWords, word.toLowerCase()])
                            input.value = ''
                          }
                        }}
                      >
                        <input
                          name="advWord"
                          type="text"
                          placeholder="Add a word..."
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                        <Button type="submit" size="sm" variant="outline" className="h-7 px-2">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  )}

                  {/* Watermark — coming soon */}
                  <div className="flex items-center justify-between opacity-50 cursor-not-allowed select-none">
                    <div>
                      <span className="text-sm font-semibold text-foreground block">Watermark</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">Add your logo or @handle to every clip</span>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-full border border-zinc-700 shrink-0">Coming soon</span>
                  </div>

                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
          </div>
        </div>
      </div>

      {/* Unified multi-platform publish dialog */}
      <UnifiedPublishDialog
        open={showPublishDialog}
        onClose={() => setShowPublishDialog(false)}
        clipId={clipId}
        clipTitle={clip?.title ?? undefined}
        videoPreviewUrl={videoUrl ?? undefined}
        metadata={{
          clip_mood: (selectedMood ?? detectedMood) ?? undefined,
          caption_style: settings.captionStyle,
          hook_style: settings.hookStyle,
          hook_enabled: settings.hookEnabled,
          smart_zoom_mode: settings.smartZoomMode,
          duration_seconds: clip?.duration_seconds ?? undefined,
          blowup_chance_at_render: currentScore,
        }}
      />

      {/* Paywall modal */}
      <PaywallModal
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        showOneTimeSave={!paywallSaveUsed}
        onOneTimeSave={async () => {
          try {
            const res = await fetch('/api/paywall/save', { method: 'POST' })
            const json = await res.json()
            if (json.data?.granted) {
              setPaywallSaveUsed(true)
              setBonusVideos(prev => prev + 1)
              // Update ref immediately so handleRender sees the new bonus count
              paywallRef.current = { ...paywallRef.current, bonusVideos: paywallRef.current.bonusVideos + 1 }
              setShowPaywall(false)
              handleRender()
            }
          } catch { /* silent */ }
        }}
        referralLink={referralLink}
        resetDate={(() => {
          const now = new Date()
          const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        })()}
        userId={userId}
      />

      {/* Mobile fixed bottom CTA — Generate clip always reachable */}
      {!renderDownloadUrl && !makeViralLoading && !analysisSequenceActive && !rendering && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-3 bg-background/95 backdrop-blur border-t border-border lg:hidden">
          <Button
            className="w-full h-12 font-bold text-base gap-2 rounded-xl text-amber-950"
            style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)', boxShadow: '0 0 20px rgba(245, 158, 11, 0.22)' }}
            onClick={handleRender}
          >
            <Zap className="h-5 w-5" /> Generate clip
          </Button>
        </div>
      )}
      {rendering && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-3 bg-background/95 backdrop-blur border-t border-border lg:hidden">
          <div className="flex items-center justify-center gap-2 h-12">
            <WolfLoader variant="spinner" size={16} mode="amber" />
            <span className="text-sm font-medium text-foreground">Rendering...</span>
          </div>
        </div>
      )}
    </div>
  )
}
