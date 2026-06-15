/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Sparkles, Download, CheckCircle, Check,
  Type, Wand2, Eye, ExternalLink, Play,
  Monitor, Zap, Send,
  Flame, Focus, X, Plus, Volume2, Scissors, RotateCcw, Rocket,
} from 'lucide-react'
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
import { AIAnalysisSequence } from '@/components/enhance/ai-analysis-sequence'
import { TagPanel } from '@/components/enhance/tag-panel'
import { BlowupChanceBar } from '@/components/enhance/blowup-chance-bar'
import { CaptionsSection } from '@/components/enhance/accordion-sections/captions-section'
import { SplitScreenSection } from '@/components/enhance/accordion-sections/split-screen-section'
import { PageHeader } from '@/components/dashboard/page-header'
import { TikTokPublishDialog } from '@/components/distribution/tiktok-publish-dialog'

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
  const [showTikTokDialog, setShowTikTokDialog] = useState(false)
  const [renderMessage, setRenderMessage] = useState<string | null>(null)
  const [renderOriginalUrl, setRenderOriginalUrl] = useState<string | null>(null)
  const [renderDownloadUrl, setRenderDownloadUrl] = useState<string | null>(null)
  const [renderJobId, setRenderJobId] = useState<string | null>(null)
  const [isRenderedVideo, setIsRenderedVideo] = useState(false)
  const [renderedThumbnailUrl, setRenderedThumbnailUrl] = useState<string | null>(null)
  const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const hasUserChangedSettings = useRef(false)
  const [showEnhancements, setShowEnhancements] = useState(false)
  const [hookAnalysis, setHookAnalysis] = useState<HookAnalysis | null>(null)
  const [hookGenerating, setHookGenerating] = useState(false)
  const [hookError, setHookError] = useState<string | null>(null)
  const router = useRouter()
  const sectionRefs = {
    captions: useRef<HTMLDivElement>(null),
    splitscreen: useRef<HTMLDivElement>(null),
    tags: useRef<HTMLDivElement>(null),
  }

  const DEFAULT_SETTINGS: EnhanceSettings = {
    captionsEnabled: false,
    captionStyle: 'none',
    emphasisEffect: 'none',
    emphasisColor: 'red',
    customImportantWords: [],
    captionPosition: 72,
    wordsPerLine: 4,
    splitScreenEnabled: false,
    brollVideo: 'none',
    splitRatio: 60,
    videoZoom: 'contain',
    tagStyle: 'none',
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
    hookReorderEnabled: true,
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

  // Resolve direct MP4 URL for live preview (Twitch only)
  useEffect(() => {
    if (!clip || clip.platform !== 'twitch' || !clip.external_url) return
    // Extract slug from https://clips.twitch.tv/SLUG or https://www.twitch.tv/CHANNEL/clip/SLUG
    const m = clip.external_url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)|\/clip\/([A-Za-z0-9_-]+)/)
    const slug = m ? (m[1] || m[2]) : null
    if (!slug) return
    let cancelled = false
    fetch(`/api/clips/video-url?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (!cancelled && j?.video_url) setVideoUrl(j.video_url) })
      .catch(() => { /* silent — fallback to thumbnail */ })
    return () => { cancelled = true }
  }, [clip])

  const updateSetting = useCallback(<K extends keyof EnhanceSettings>(key: K, value: EnhanceSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }))
    // Auto-switch to Enhanced preview on first change
    if (!hasUserChangedSettings.current) {
      hasUserChangedSettings.current = true
      setShowEnhancements(true)
    }
    // Clear rendered video when user changes settings — avoids confusion
    // between the baked render and the new settings shown in the preview
    if (isRenderedVideo) {
      setIsRenderedVideo(false)
      setRenderDownloadUrl(null)
      setRenderMessage(null)
    }
  }, [isRenderedVideo])

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
            queuePosition?: number | null
          } | null
          message: string
        }

        if (!json.data) return

        if (json.data.status === 'done' && json.data.downloadUrl) {
          if (pollRef.current) clearInterval(pollRef.current)
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
          setRenderMessage('✅ Clip rendered with captions! Check the preview above.')
          setRendering(false)
        } else if (json.data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current)
          try { sessionStorage.removeItem(`render-job:${clipId}`) } catch { /* ignore */ }
          setRenderMessage(`❌ Error: ${json.data.errorMessage || 'Unknown error'}`)
          setRendering(false)
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

  const handleRender = useCallback(async () => {
    if (!clip) return
    setRendering(true)
    setRenderMessage('⏳ Starting render...')
    setRenderDownloadUrl(null)
    setRenderOriginalUrl(null)
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
          videoWidth: 720,
          videoHeight: 1280,
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
          videoWidth: 720,
          videoHeight: 1280,
          splitScreenEnabled: settings.splitScreenEnabled,
          splitRatio: settings.splitRatio,
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
            splitScreen: {
              enabled: settings.splitScreenEnabled,
              brollCategory: settings.brollVideo,
              ratio: settings.splitRatio,
              layout: 'top-bottom',
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
              enabled: settings.smartZoomEnabled,
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
              reorderEnabled: settings.hookReorderEnabled,
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
      splitScreenEnabled: false,
      brollVideo: preset.brollVideo,
      splitRatio: preset.splitRatio,
      videoZoom: preset.videoZoom,
      tagStyle,
      tagSize: preset.tagSize,
      aspectRatio: preset.aspectRatio,
      smartZoomEnabled: preset.smartZoomEnabled,
      smartZoomMode: preset.smartZoomMode,
      audioEnhanceEnabled: preset.audioEnhanceEnabled,
      autoCutEnabled: preset.autoCutEnabled,
      autoCutThreshold: preset.autoCutThreshold,
      hookEnabled: preset.hookEnabled,
      hookTextEnabled: preset.hookTextEnabled,
      hookReorderEnabled: preset.hookReorderEnabled,
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
        case 1: // Next: "Optimizing caption style..." → big captions boost
          return {
            ...s,
            captionsEnabled: true,
            captionStyle: preset.captionStyle,
            captionPosition: preset.captionPosition,
            wordsPerLine: preset.wordsPerLine,
          }
        case 2: // Next: "Selecting emphasis & color..." → emphasis boost
          return {
            ...s,
            emphasisEffect: preset.emphasisEffect,
            emphasisColor: preset.emphasisColor,
          }
        case 3: // Next: "Crafting viral hook..." → hook + smart zoom big boost
          return {
            ...s,
            hookEnabled: preset.hookEnabled,
            hookTextEnabled: preset.hookTextEnabled,
            hookReorderEnabled: preset.hookReorderEnabled,
            hookStyle: preset.hookStyle,
            hookTextPosition: preset.hookTextPosition,
            hookLength: preset.hookLength,
            smartZoomEnabled: preset.smartZoomEnabled,
            smartZoomMode: preset.smartZoomMode,
          }
        case 4: // Next: "Finalizing parameters..." → tag + audio + autocut remaining
          return {
            ...s,
            tagStyle,
            tagSize: preset.tagSize,
            splitScreenEnabled: false,
            brollVideo: preset.brollVideo,
            splitRatio: preset.splitRatio,
            audioEnhanceEnabled: preset.audioEnhanceEnabled,
            autoCutEnabled: preset.autoCutEnabled,
            autoCutThreshold: preset.autoCutThreshold,
          }
        default:
          return s
      }
    })
  }, [clip?.platform])

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
          hookReorder: json.data.reorder,
        }))
      }
    } catch {
      // Silent fail — hook text stays empty but everything else works
    } finally {
      setHookGenerating(false)
    }

    // 4. API calls done, data is ready — NOW start the analysis sequence
    setMakeViralLoading(false)
    setAnalysisSequenceActive(true)

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
    // Hook reorder must be ready if we expect it
    if (settings.hookReorderEnabled && !settings.hookReorder) return
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
      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        {/* Left: Preview only — truly sticky with its own overflow so it
            never clips behind the viewport even when the preview block
            (toggle + 9:16 video + generate button + status) is taller
            than the available space. */}
        <div
          className="lg:sticky lg:top-4 lg:self-start space-y-3 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]"
        >
          {/* ── Preview Toggle ──
              Initial (no settings touched, no render): [Original] only — clean entry state
              After user enables any enhancement: [Original | Enhanced] — CSS preview kicks in
              After render: [Original | Rendered] — Enhanced becomes redundant
              The Enhanced tab is gated by `showEnhancements` which flips true on first user change. */}
          <div className="flex gap-2">
            <Button
              variant={!showEnhancements ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setShowEnhancements(false); setIsRenderedVideo(false) }}
              className="flex-1 text-xs h-8"
            >
              Original
            </Button>
            {showEnhancements && !renderDownloadUrl && (
              <Button
                variant={showEnhancements && !isRenderedVideo ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setShowEnhancements(true); setIsRenderedVideo(false) }}
                className="flex-1 text-xs h-8"
              >
                Enhanced
              </Button>
            )}
            {renderDownloadUrl && (
              <Button
                variant={isRenderedVideo ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setIsRenderedVideo(true); setShowEnhancements(true) }}
                className="flex-1 text-xs h-8"
              >
                Rendered
              </Button>
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

          {/* Generate button — hidden when AI flow active or render done */}
          {!renderDownloadUrl && !makeViralLoading && !analysisSequenceActive && !rendering && (
            <Button
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-base gap-2 shadow-lg shadow-orange-500/25 rounded-xl"
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
                      ? 'You\'ve hit your monthly render limit. Upgrade your plan to continue.'
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
                    ? { label: 'Upgrade plan', href: '/settings' }
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

              {/* Rendering progress indicator — shows after analysis completes */}
              {rendering && !analysisSequenceActive && !renderDownloadUrl && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Rendering your clip...</span>
                </div>
              )}

              {/* Post-render CTAs — Bank is primary (AI orchestration), Publish is escape hatch */}
              {renderDownloadUrl && (
                <div className="flex flex-col gap-2.5" style={{ animation: 'stepFade 0.4s ease-out' }}>
                  {/* PRIMARY: Place in bank — main path that lets AI orchestrate distribution */}
                  {!placedInBank ? (
                    <button
                      onClick={() => {
                        setPlacedInBank(true)
                        setRenderMessage('✓ Clip placed in your bank — Smart Queue will schedule it.')
                      }}
                      className="group inline-flex flex-col items-center justify-center gap-1 w-full h-16 rounded-xl font-bold bg-gradient-to-r from-cyan-500 via-sky-500 to-cyan-500 hover:from-cyan-400 hover:via-sky-400 hover:to-cyan-400 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all hover:scale-[1.01]"
                    >
                      <span className="inline-flex items-center gap-2.5 text-lg">
                        <Plus className="h-5 w-5" />
                        Place in bank
                      </span>
                      <span className="text-[10px] font-medium opacity-90">Smart Queue picks the optimal time + platform</span>
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
                      <span className="text-[10px] font-medium opacity-90">View in Distribution →</span>
                    </button>
                  )}

                  {/* SECONDARY: Publish to TikTok — opens compliant Direct Post dialog */}
                  <button
                    onClick={() => setShowTikTokDialog(true)}
                    className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-lg border border-cyan-500/35 bg-cyan-500/8 text-cyan-300 hover:bg-cyan-500/15 hover:border-cyan-500/55 hover:text-cyan-200 text-sm font-semibold transition-all"
                    title="Publish directly to TikTok"
                  >
                    <Send className="h-4 w-4" />
                    Publish to TikTok
                  </button>

                  {/* Tertiary: Download */}
                  <a
                    href={renderDownloadUrl}
                    download="viral-clip.mp4"
                    className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-sm font-medium transition-all"
                  >
                    <Download className="h-4 w-4" />
                    Download MP4
                  </a>

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

              {/* Pre-render: disabled publish + download placeholders */}
              {!renderDownloadUrl && (
                <>
                  <div className="inline-flex items-center justify-center gap-2 w-full h-14 rounded-xl bg-zinc-800 text-zinc-500 cursor-not-allowed font-bold text-lg">
                    <Rocket className="h-5 w-5" />
                    Distribute Now
                  </div>
                  <div className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-zinc-800 text-zinc-600 text-sm font-medium cursor-not-allowed">
                    <Download className="h-4 w-4" />
                    Download MP4
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions + Settings — scrollable (hidden once render is done) */}
        <div className="space-y-6">
          {/* ── AI Optimize button ── */}
          {(() => {
            const viralBusy = makeViralLoading || analysisSequenceActive || pendingAutoRenderRef.current || rendering
            const isAnalyzing = makeViralLoading || analysisSequenceActive
            const isComplete = analysisComplete && !viralBusy

            return (
              <button
                onClick={applyBestCombo}
                disabled={viralBusy}
                className={cn(
                  'group relative w-full rounded-xl p-[1px] transition-all duration-500 overflow-hidden',
                  isComplete
                    ? 'bg-gradient-to-b from-emerald-400/70 to-emerald-600/70 shadow-md shadow-emerald-500/15'
                    : viralBusy
                      ? 'bg-gradient-to-b from-orange-400/80 to-orange-600/80 shadow-lg shadow-orange-500/20'
                      : 'bg-gradient-to-b from-orange-400 to-orange-600 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.01]'
                )}
              >
                {/* Shimmer effect during loading */}
                {isAnalyzing && (
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                )}
                <div className={cn(
                  'relative flex items-center gap-3 rounded-[11px] px-4 py-3 transition-all duration-500 border-t',
                  isComplete
                    ? 'bg-emerald-950/80 border-emerald-400/20'
                    : 'bg-gradient-to-b from-orange-500/95 to-orange-700/95 border-white/15'
                )}>
                  {isAnalyzing ? (
                    <Loader2 className="h-[18px] w-[18px] text-white animate-spin shrink-0" />
                  ) : isComplete ? (
                    <Check className="h-[18px] w-[18px] text-white shrink-0" />
                  ) : (
                    <Sparkles className="h-[18px] w-[18px] text-white shrink-0 group-hover:rotate-12 transition-transform" />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <span className="text-sm font-bold tracking-tight block leading-tight text-white">
                      {isAnalyzing ? 'Analyzing clip...' : rendering ? 'Rendering...' : isComplete ? 'AI-optimized' : 'AI Optimize'}
                    </span>
                    <span className={cn(
                      'text-[10px] block',
                      isComplete ? 'text-emerald-300/60' : 'text-white/50'
                    )}>
                      {isAnalyzing ? 'Tuning every parameter' : rendering ? 'Applying settings' : isComplete ? 'All settings tuned for this clip' : 'Best settings in one click'}
                    </span>
                  </div>
                </div>
              </button>
            )
          })()}

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
              }}
            />
          )}

          {/* AI optimization badge removed — the button itself now shows the optimized state */}

          {/* Style selector removed — internal mechanic handled by AI Optimize */}

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
          />

            <Accordion multiple defaultValue={[]} className="space-y-3">

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
            />

            {/* ─── Split-Screen Section ─── */}
            <SplitScreenSection
              settings={settings}
              updateSetting={updateSetting}
              scoreBreakdown={scoreBreakdown}
              scores={scores}
              sectionRef={sectionRefs.splitscreen}
            />

            {/* ─── Tags Section ─── */}
            <AccordionItem value="tags" ref={sectionRefs.tags} className="scroll-mt-32 rounded-xl border border-white/10 bg-card/60 px-4 overflow-hidden">
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="text-primary">@</span>
                  Streamer tag
                  <span className="text-xs text-zinc-500 font-normal">
                    {settings.tagStyle !== 'none'
                      ? `· ${TAG_STYLES.find(t => t.id === settings.tagStyle)?.label ?? settings.tagStyle}`
                      : '· Off'}
                  </span>
                  {scoreBreakdown.tag > 0 && (
                    <span className="ml-auto text-[11px] font-bold text-emerald-400">+{scoreBreakdown.tag} pts</span>
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
            <AccordionItem value="smartzoom" className="scroll-mt-32 rounded-xl border border-white/10 bg-card/60 px-4 overflow-hidden">
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Focus className="h-4 w-4 text-primary" />
                  Smart Zoom
                  <span className="text-xs text-zinc-500 font-normal">
                    {settings.smartZoomEnabled
                      ? `· ${settings.smartZoomMode === 'micro' ? 'Micro zoom' : settings.smartZoomMode === 'dynamic' ? 'Dynamic' : 'Follow face'}`
                      : '· Off'}
                  </span>
                  {scoreBreakdown.smartZoom > 0 && (
                    <span className="text-[11px] font-bold text-emerald-400">+{scoreBreakdown.smartZoom} pts</span>
                  )}
                  <span className="ml-auto text-[10px] font-normal text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                    New
                  </span>
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
            <AccordionItem value="audio" className="scroll-mt-32 rounded-xl border border-white/10 bg-card/60 px-4 overflow-hidden">
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Volume2 className="h-4 w-4 text-primary" />
                  Audio Enhancement
                  <span className="text-xs text-zinc-500 font-normal">
                    {settings.audioEnhanceEnabled ? '· On' : '· Off'}
                  </span>
                  {scoreBreakdown.audio > 0 && (
                    <span className="text-[11px] font-bold text-emerald-400">+{scoreBreakdown.audio} pts</span>
                  )}
                  <span className="ml-auto text-[10px] font-normal text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                    New
                  </span>
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
            <AccordionItem value="autocut" className="scroll-mt-32 rounded-xl border border-white/10 bg-card/60 px-4 overflow-hidden">
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Scissors className="h-4 w-4 text-primary" />
                  Auto-Cut Silences
                  <span className="text-xs text-zinc-500 font-normal">
                    {settings.autoCutEnabled ? `· On · ${settings.autoCutThreshold.toFixed(1)}s threshold` : '· Off'}
                  </span>
                  {scoreBreakdown.autoCut > 0 && (
                    <span className="text-[11px] font-bold text-emerald-400">+{scoreBreakdown.autoCut} pts</span>
                  )}
                  <span className="ml-auto text-[10px] font-normal text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                    New
                  </span>
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
            <AccordionItem value="hook" className="scroll-mt-32 rounded-xl border border-white/10 bg-card/60 px-4 overflow-hidden">
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Hook Viral
                  <span className="text-xs text-zinc-500 font-normal">
                    {settings.hookEnabled
                      ? `· ${settings.hookStyle.charAt(0).toUpperCase() + settings.hookStyle.slice(1)}${settings.hookText ? ` · "${settings.hookText.slice(0, 20)}${settings.hookText.length > 20 ? '...' : ''}"` : ''}`
                      : '· Off'}
                  </span>
                  {scoreBreakdown.hook > 0 && (
                    <span className="text-[11px] font-bold text-emerald-400">+{scoreBreakdown.hook} pts</span>
                  )}
                  <span className="ml-auto text-[10px] font-normal text-muted-foreground bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
                    New
                  </span>
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
                          <span className="text-[8px] text-muted-foreground block">Overlay at start</span>
                        </button>
                        <button
                          onClick={() => {
                            const newVal = !settings.hookReorderEnabled
                            updateSetting('hookReorderEnabled', newVal)
                            if (newVal && !settings.hookReorder) {
                              generateHook()
                            }
                          }}
                          className={cn(
                            'rounded-xl border p-2.5 text-center transition-all',
                            settings.hookReorderEnabled
                              ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                              : 'border-border hover:border-orange-500/40'
                          )}
                        >
                          <Zap className="h-4 w-4 mx-auto mb-1 text-orange-400" />
                          <span className="text-[10px] font-bold text-foreground block">Moment fort 1er</span>
                          <span className="text-[8px] text-muted-foreground block">Reorder clip</span>
                          {hasAiAnalyzed && <span className="text-[9px] font-bold text-emerald-400 block mt-0.5">+{getOptionPts(0.05)} pts</span>}
                        </button>
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
                            className="w-full accent-orange-500 [&::-webkit-slider-thumb]:border-orange-500/50 [&::-moz-range-thumb]:border-orange-500/50"
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
                        className="w-full h-10 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm gap-2 rounded-xl"
                      >
                        {hookGenerating ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>
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
                                  <span className="text-[8px] text-muted-foreground block">{seg.duration.toFixed(1)}s</span>
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
                                <span className="text-[8px] text-muted-foreground block">{style.desc}</span>
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
          </Accordion>
          </div>
        </div>
      </div>

      {/* TikTok Direct Post dialog */}
      <TikTokPublishDialog
        open={showTikTokDialog}
        onClose={() => setShowTikTokDialog(false)}
        clipId={clipId}
        clipTitle={clip?.title ?? undefined}
        videoPreviewUrl={videoUrl ?? undefined}
      />
    </div>
  )
}
