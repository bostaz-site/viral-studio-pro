/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Sparkles, Download, CheckCircle, Check,
  Type, Wand2, Eye, ExternalLink, Play,
  Monitor, Zap, Send,
  Flame, Focus, X, Plus, Volume2, Scissors, RotateCcw,
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
  CAPTION_STYLES, EMPHASIS_EFFECTS, EMPHASIS_COLORS, BROLL_OPTIONS, TAG_STYLES,
  formatCount, computeScores, computeCurrentScore, computeBaselineScore, getScoreLabel,
  type TrendingClipData, type EnhanceSettings, type ScoredOption,
} from '@/lib/enhance/scoring'
import { LivePreview, ScoreBadge } from '@/components/enhance/live-preview'
import { AIAnalysisSequence } from '@/components/enhance/ai-analysis-sequence'
import { TagPanel } from '@/components/enhance/tag-panel'
import { PublishDialog } from '@/components/distribution/publish-dialog'

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
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
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
          // Save rendered video URL for the "Rendered" tab — but keep Enhanced preview active
          if (json.data.publicUrl) {
            setOriginalVideoUrl(videoUrl)
            // Store rendered URL but DON'T switch preview — user stays on Enhanced view
            setVideoUrl(json.data.publicUrl)
            if (json.data.thumbnailUrl) {
              setRenderedThumbnailUrl(json.data.thumbnailUrl)
            }
          }
          // Keep isRenderedVideo false — user can click "Rendered" tab to see baked video
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
        console.log('[handleRender] Hook capture:', hookOverlayData ? `OK ${hookOverlayData.capsuleW}x${hookOverlayData.capsuleH}` : 'FAILED')
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
        console.log('[handleRender] Tag capture:', tagOverlayData ? `OK ${tagOverlayData.w}x${tagOverlayData.h}` : 'FAILED/skipped')
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
            },
            hook: (() => {
              console.log('[handleRender] Hook settings:', {
                enabled: settings.hookEnabled,
                textEnabled: settings.hookTextEnabled,
                reorderEnabled: settings.hookReorderEnabled,
                hasReorder: !!settings.hookReorder,
                segments: settings.hookReorder?.segments?.length || 0,
                segmentDetails: settings.hookReorder?.segments?.map(s => `${s.label}(${s.start}-${s.end}s)`) || [],
                totalDuration: settings.hookReorder?.totalDuration || 0,
                hookText: settings.hookText?.substring(0, 30) || '(empty)',
                hookLength: settings.hookLength,
              })
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

  // Mood detection state
  const [detectedMood, setDetectedMood] = useState<ClipMood | null>(null)
  const [moodConfidence, setMoodConfidence] = useState<number>(0)
  const [moodExplanation, setMoodExplanation] = useState<string | null>(null)
  const [secondaryMood, setSecondaryMood] = useState<ClipMood | null>(null)
  const [selectedMood, setSelectedMood] = useState<ClipMood | null>(null)
  const [moodAiDetected, setMoodAiDetected] = useState(false)

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

  // Helper: compute real impact on "Blowup Chance" for each option
  // Helper: compute real impact on "Blowup Chance" using diminishing returns
  // Only show score badges AFTER the user has clicked "Make it viral" or manually selected a mood.
  // Before that, no points are attributed to any option.
  const hasAiAnalyzed = !!(selectedMood || detectedMood)

  const getRealImpact = useCallback((
    category: 'caption' | 'emphasis' | 'broll' | 'tag',
    optionId: string,
    bestId: string
  ): { impact: number; isMoodPick: boolean } => {
    // No scores until AI has analyzed
    if (!selectedMood && !detectedMood) return { impact: 0, isMoodPick: false }

    const headroom = Math.max(0, 99 - baselineScore)
    const BASE_W: Record<string, number> = { caption: 0.14, emphasis: 0.08, broll: 0.12, tag: 0.08 }
    const MOOD_W: Record<string, number> = { caption: 0.06, emphasis: 0.04, broll: 0, tag: 0 }

    if (optionId === 'none') {
      if (selectedMood) {
        const preset = MOOD_PRESETS[selectedMood]
        const moodVal = category === 'caption' ? preset.captionStyle
          : category === 'emphasis' ? preset.emphasisEffect
          : category === 'broll' ? preset.brollVideo
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
        : category === 'broll' ? preset.brollVideo
        : preset.tagStyle
      if (optionId === moodVal) {
        weight += MOOD_W[category]
        isMoodPick = true
      }
    }

    const impact = Math.round(headroom * weight * 10) / 10
    return { impact, isMoodPick }
  }, [selectedMood, detectedMood, baselineScore])

  const applyMoodPreset = useCallback((preset: MoodPreset) => {
    appliedCaptionStyleRef.current = preset.captionStyle
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
      tagStyle: preset.tagStyle,
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
  }, [])

  const handleMoodSelect = useCallback((mood: ClipMood) => {
    setSelectedMood(mood)
    setMoodAiDetected(false) // user override
    applyMoodPreset(getMoodPresetForClip(mood, clip?.platform ?? 'twitch'))
  }, [applyMoodPreset, clip])

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

    // 2. Apply the mood preset (settings now have correct values)
    applyMoodPreset(preset)

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

  // Auto-trigger render once applyBestCombo has propagated the new settings.
  // We wait until settings.captionStyle matches the applied preset AND
  // (if reorder enabled) the reorder data has been populated.
  useEffect(() => {
    if (!pendingAutoRenderRef.current) return
    if (rendering) return
    // Check the caption style matches what we applied
    const expected = appliedCaptionStyleRef.current
    if (expected && settings.captionStyle !== expected) return
    // Hook reorder must be ready if we expect it
    if (settings.hookReorderEnabled && !settings.hookReorder) return
    pendingAutoRenderRef.current = false
    appliedCaptionStyleRef.current = null
    handleRender()
  }, [settings, rendering, handleRender])

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
      {/* Back button + clip info header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="mt-0.5">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Wand2 className="h-6 w-6 text-primary" />
              Enhance Clip
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {clip.title ?? 'Clip de stream'} &mdash; {clip.author_handle ? `@${clip.author_handle}` : clip.author_name}
            </p>
          </div>
        </div>
      </div>

      {/* Two-column layout: Sticky Preview | Scrollable Settings */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        {/* Left: Preview only — truly sticky with its own overflow so it
            never clips behind the viewport even when the preview block
            (toggle + 9:16 video + generate button + status) is taller
            than the available space. */}
        <div
          className="lg:sticky lg:top-4 lg:self-start space-y-3 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]"
        >
          {/* ── Preview Toggle ── */}
          <div className="flex gap-2">
            <Button
              variant={!showEnhancements ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setShowEnhancements(false); setIsRenderedVideo(false) }}
              className="flex-1 text-xs h-8"
            >
              Original
            </Button>
            <Button
              variant={showEnhancements && !isRenderedVideo ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setShowEnhancements(true); setIsRenderedVideo(false) }}
              className="flex-1 text-xs h-8"
            >
              Enhanced
            </Button>
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

              {/* Publish button — primary CTA */}
              <button
                onClick={() => setPublishDialogOpen(true)}
                disabled={!renderDownloadUrl}
                className={cn(
                  "inline-flex items-center justify-center gap-2 w-full rounded-xl font-bold text-lg transition-all",
                  renderDownloadUrl
                    ? "h-14 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25"
                    : "h-14 bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
              >
                <Send className="h-5 w-5" />
                Publish to socials
              </button>

              {/* Download button — secondary */}
              {renderDownloadUrl ? (
                <a
                  href={renderDownloadUrl}
                  download="viral-clip.mp4"
                  className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-sm font-medium transition-all"
                >
                  <Download className="h-4 w-4" />
                  Download clip (with captions)
                </a>
              ) : (
                <div className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-zinc-800 text-zinc-600 text-sm font-medium cursor-not-allowed">
                  <Download className="h-4 w-4" />
                  Download clip (with captions)
                </div>
              )}

              {/* Reset button */}
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
                  hasUserChangedSettings.current = false
                  if (originalVideoUrl) setVideoUrl(originalVideoUrl)
                }}
                className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium text-zinc-400 hover:text-white transition-all"
              >
                <RotateCcw className="h-4 w-4" />
                Reset &amp; start over
              </button>
            </div>
          )}
        </div>

        {/* Right: Actions + Settings — scrollable (hidden once render is done) */}
        <div className="space-y-6">
          {/* ── Make it viral button ── */}
          {(() => {
            const viralBusy = makeViralLoading || analysisSequenceActive || pendingAutoRenderRef.current || rendering
            const viralLabel = makeViralLoading || analysisSequenceActive
              ? 'AI is analyzing your clip...'
              : rendering
                ? 'Rendering...'
                : 'Make it viral'
            const viralSubLabel = makeViralLoading || analysisSequenceActive
              ? 'Optimizing every parameter for this clip'
              : rendering
                ? 'Applying AI-optimized settings'
                : '1 click = AI-optimized viral clip'
            return (
              <button
                onClick={applyBestCombo}
                disabled={viralBusy}
                className="group relative w-full rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-[1px] shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 animate-[glow_3s_ease-in-out_infinite] disabled:opacity-80"
              >
                <div className="relative flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-4 py-3.5">
                  {viralBusy ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Zap className="h-5 w-5 text-white drop-shadow-lg" />
                  )}
                  <div className="text-left">
                    <span className="text-base font-black text-white tracking-tight block leading-tight">
                      {viralLabel}
                    </span>
                    <span className="text-[10px] font-medium text-white/70 block">
                      {viralSubLabel}
                    </span>
                  </div>
                  <Sparkles className={cn('h-4 w-4 text-white/80 ml-auto', viralBusy ? 'animate-spin' : 'group-hover:animate-spin')} />
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
              isActive={analysisSequenceActive}
              onComplete={() => {
                setAnalysisComplete(true)
                setAnalysisSequenceActive(false)
              }}
            />
          )}

          {/* ── AI optimization badge (shows AFTER sequence completes) ── */}
          {analysisComplete && detectedMood && moodAiDetected && !analysisSequenceActive && (
            <div className="px-3 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-foreground">
                <span className="font-bold text-emerald-400">AI-optimized</span>
                <span className="text-muted-foreground"> — 6 parameters tuned for this clip</span>
              </p>
            </div>
          )}

          {/* ── Style selector (hidden — internal mechanic, not user-facing) ── */}
          {false && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Style</span>
              {selectedMood && (
                <span className="text-[10px] text-muted-foreground">{MOOD_PRESETS[selectedMood].description}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ALL_MOODS.map((mood) => {
                const preset = MOOD_PRESETS[mood]
                const isSelected = selectedMood === mood
                const isDetected = detectedMood === mood && moodAiDetected
                return (
                  <button
                    key={mood}
                    onClick={() => handleMoodSelect(mood)}
                    className={cn(
                      'relative flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl border text-xs font-medium transition-all duration-200',
                      isSelected
                        ? `${MOOD_COLORS[mood]} bg-white/5 shadow-lg text-white border-2`
                        : 'border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground hover:border-white/20'
                    )}
                  >
                    <span className="text-base">{preset.emoji}</span>
                    <span className="text-[11px]">{preset.label}</span>
                    {isDetected && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
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
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-white/5 -mx-1 px-1 pb-3 pt-1 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-400" />
                <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Blowup Chance</span>
              </div>
              <span className={cn(
                'text-xs font-bold uppercase tracking-wide transition-colors duration-300',
                getScoreLabel(currentScore).color
              )}>
                {getScoreLabel(currentScore).text}
              </span>
            </div>
            {/* Progress bar */}
            <div className="relative w-full h-8 rounded-full bg-card/60 border border-white/10 overflow-hidden">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out',
                  currentScore >= 75 ? 'bg-gradient-to-r from-orange-500 to-amber-400' :
                  currentScore >= 50 ? 'bg-gradient-to-r from-blue-500 to-cyan-400' :
                  currentScore >= 30 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
                  'bg-gradient-to-r from-slate-500 to-slate-400'
                )}
                style={{ width: `${currentScore}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-black text-white drop-shadow-md">{displayScore} / 100</span>
              </div>
            </div>
          </div>

            <Accordion multiple defaultValue={[]} className="space-y-3">

            {/* ─── Captions Section ─── */}
            <AccordionItem value="captions" ref={sectionRefs.captions} className="scroll-mt-32 rounded-xl border border-white/10 bg-card/60 px-4 overflow-hidden">
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Type className="h-4 w-4 text-primary" />
                  Karaoke captions
                  <span className="text-xs text-zinc-500 font-normal">
                    {settings.captionStyle !== 'none'
                      ? `· ${CAPTION_STYLES.find(s => s.id === settings.captionStyle)?.label ?? settings.captionStyle}`
                      : '· Off'}
                    {settings.emphasisEffect !== 'none' && ` · ${EMPHASIS_EFFECTS.find(e => e.id === settings.emphasisEffect)?.label ?? ''}`}
                    {settings.emphasisEffect !== 'none' && settings.emphasisColor && ` · ${EMPHASIS_COLORS.find(c => c.id === settings.emphasisColor)?.label ?? ''}`}
                  </span>
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
                    {/* Animation is part of the style — display info only */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                      <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Animation:</span>
                      <span className="text-xs font-semibold text-foreground">{CAPTION_STYLES.find(s => s.id === settings.captionStyle)?.animLabel || 'Highlight'}</span>
                    </div>

                    {/* Emphasize key words */}
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

                    {/* Emphasis color — always visible, disabled if no effect */}
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

                    {/* Important words — auto-detected + custom */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Important words</Label>
                      <p className="text-[10px] text-muted-foreground">
                        Words in <span className="text-red-400 font-bold">red</span> in the captions. Auto-detected (CAPS, viral words) + your own words.
                      </p>

                      {/* Auto-detected words preview */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mr-1 self-center">Auto</span>
                        {['CAPS', 'OMG', 'CRAZY', 'INSANE', 'WTF'].map((w) => (
                          <span key={w} className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400">
                            {w}
                          </span>
                        ))}
                        <span className="text-[9px] text-muted-foreground/40 self-center">+ mots viraux</span>
                      </div>

                      {/* Custom words */}
                      {settings.customImportantWords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mr-1 self-center">Custom</span>
                          {settings.customImportantWords.map((w) => (
                            <span key={w} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-[10px] font-bold text-red-400">
                              {w}
                              <button
                                onClick={() => setSettings((s) => ({
                                  ...s,
                                  customImportantWords: s.customImportantWords.filter((cw) => cw !== w),
                                }))}
                                className="hover:text-red-300 transition-colors"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add custom word input */}
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          const input = (e.currentTarget.elements.namedItem('newWord') as HTMLInputElement)
                          const word = input.value.trim()
                          if (word && !settings.customImportantWords.includes(word.toLowerCase())) {
                            setSettings((s) => ({
                              ...s,
                              customImportantWords: [...s.customImportantWords, word.toLowerCase()],
                            }))
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

                    {/* Words per line slider */}
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
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* ─── Split-Screen Section ─── */}
            <AccordionItem value="splitscreen" ref={sectionRefs.splitscreen} className="scroll-mt-32 rounded-xl border border-white/10 bg-card/60 px-4 overflow-hidden">
              <AccordionTrigger className="text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Monitor className="h-4 w-4 text-primary" />
                  Split-Screen
                  <span className="text-xs text-zinc-500 font-normal">
                    {settings.brollVideo !== 'none'
                      ? `· ${BROLL_OPTIONS.find(b => b.id === settings.brollVideo)?.label ?? settings.brollVideo} · ${settings.splitRatio}/${100 - settings.splitRatio}`
                      : '· Off'}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {scores && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">B-roll video</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {BROLL_OPTIONS.map((broll) => {
                          const { impact, isMoodPick } = getRealImpact('broll', broll.id, scores.best.brollVideo)
                          const isHighlight = isMoodPick || (!selectedMood && broll.id === scores.best.brollVideo)
                          return (
                            <button
                              key={broll.id}
                              onClick={() => {
                                updateSetting('brollVideo', broll.id)
                                updateSetting('splitScreenEnabled', broll.id !== 'none')
                              }}
                              className={cn(
                                'relative rounded-xl border p-3 transition-all',
                                settings.brollVideo === broll.id
                                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                  : isMoodPick
                                  ? 'border-green-500/40 bg-green-500/5 hover:bg-green-500/10'
                                  : isHighlight
                                  ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                                  : 'border-border hover:border-primary/40'
                              )}
                            >
                              <div className={`w-full h-8 rounded-lg bg-gradient-to-r ${broll.color} mb-1.5`} />
                              <div className="flex items-center justify-between">
                                <span className={cn('text-[10px]', isMoodPick ? 'text-green-400 font-bold' : isHighlight ? 'text-orange-400 font-bold' : 'text-muted-foreground')}>
                                  {broll.label}
                                  {analysisComplete && moodAiDetected && settings.brollVideo === broll.id && broll.id !== 'none' && (
                                    <span className="ml-1 text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full border border-emerald-400/20">AI</span>
                                  )}
                                </span>
                                {hasAiAnalyzed && <ScoreBadge score={impact} isBest={isHighlight} isMoodPick={isMoodPick} />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {settings.brollVideo !== 'none' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ratio stream / B-roll</Label>
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
                    )}

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
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

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
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <TagPanel
                  settings={settings}
                  updateSetting={updateSetting}
                  scores={scores}
                  selectedMood={selectedMood}
                  baselineScore={baselineScore}
                  analysisComplete={analysisComplete}
                  moodAiDetected={moodAiDetected}
                  noCard
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
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Dynamic zoom for more movement & retention
                      </span>
                    </div>
                    <div className={cn(
                      'w-10 h-5 rounded-full relative transition-all',
                      settings.smartZoomEnabled ? 'bg-primary' : 'bg-border'
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
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Removes background noise, normalizes volume (EBU R128)
                      </span>
                    </div>
                    <div className={cn(
                      'w-10 h-5 rounded-full relative transition-all',
                      settings.audioEnhanceEnabled ? 'bg-primary' : 'bg-border'
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
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Automatically removes silences for a punchier clip
                      </span>
                    </div>
                    <div className={cn(
                      'w-10 h-5 rounded-full relative transition-all',
                      settings.autoCutEnabled ? 'bg-primary' : 'bg-border'
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
                            // Auto-generate hook analysis if toggling ON with no reorder data
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
                                    {seg.label === 'hook' ? 'HOOK' : seg.label === 'context' ? 'CONTEXTE' : 'PAYOFF'}
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
                                  // Auto-select matching hook text
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
                                <span className="text-[10px] font-bold text-foreground block mt-1">{style.label}</span>
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
                              placeholder="VOTRE HOOK PERSONNALISÉ..."
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

      <PublishDialog
        open={publishDialogOpen}
        onClose={() => setPublishDialogOpen(false)}
        clipId={clipId}
        clipTitle={clip?.title ?? undefined}
      />
    </div>
  )
}
