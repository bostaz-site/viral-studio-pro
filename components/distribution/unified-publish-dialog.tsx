'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  ChevronRight,
  Send,
  Download,
  Archive,
} from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TikTokPublishDialog } from './tiktok-publish-dialog'
import { useTrendingStore } from '@/stores/trending-store'

// ── Types ────────────────────────────────────────────────────────────────────

type Platform = 'tiktok' | 'instagram' | 'youtube' | 'facebook'

interface ConnectedAccount {
  platform: string
  username: string | null
  disconnected_at?: string | null
}

type PublishStatus = 'idle' | 'publishing' | 'success' | 'error' | 'inbox'

interface PlatformState {
  connected: boolean
  username: string | null
  selected: boolean
  status: PublishStatus
  error: string | null
  tiktokConfigured: boolean
}

export interface PublishMetadata {
  clip_mood?: string
  caption_style?: string
  caption_tone?: string
  hook_style?: string
  hook_enabled?: boolean
  smart_zoom_mode?: string
  duration_seconds?: number
  blowup_chance_at_render?: number
  [key: string]: unknown
}

interface UnifiedPublishDialogProps {
  open: boolean
  onClose: () => void
  clipId: string
  clipTitle?: string
  videoPreviewUrl?: string
  metadata?: PublishMetadata
  contentRisk?: string | null
}

// ── Platform config ──────────────────────────────────────────────────────────

import { usePlatformAccess } from '@/lib/hooks/use-platform-access'
import { formatPlatformList } from '@/lib/distribution/format-platforms'

const PLATFORMS: { id: Platform; name: string; icon: React.ReactNode; colors: string }[] = [
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.11v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.83a4.84 4.84 0 0 1-1-.14z" />
      </svg>
    ),
    colors: 'border-cyan-500/35 bg-cyan-500/8',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-pink-400" aria-hidden="true">
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.72 3.72 0 0 1-.9 1.38c-.42.42-.82.68-1.38.9-.42.17-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.17-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.17 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.78.3-1.44.71-2.1 1.37A5.87 5.87 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.78.71 1.44 1.37 2.1a5.87 5.87 0 0 0 2.14 1.37c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.87 5.87 0 0 0 2.14-1.37 5.87 5.87 0 0 0 1.37-2.1c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.87 5.87 0 0 0-1.37-2.14A5.87 5.87 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.85-10.4a1.44 1.44 0 1 0-2.88 0 1.44 1.44 0 0 0 2.88 0z" />
      </svg>
    ),
    colors: 'border-pink-500/35 bg-pink-500/8',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-red-500" aria-hidden="true">
        <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.67 31.67 0 0 0 0 12a31.67 31.67 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.84.55 9.38.55 9.38.55s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.67 31.67 0 0 0 24 12a31.67 31.67 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
      </svg>
    ),
    colors: 'border-red-500/35 bg-red-500/8',
  },
  {
    id: 'facebook',
    name: 'Facebook Reels',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-blue-500" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    colors: 'border-blue-500/35 bg-blue-500/8',
  },
]

// ── Component ────────────────────────────────────────────────────────────────

export function UnifiedPublishDialog({
  open,
  onClose,
  clipId,
  clipTitle,
  videoPreviewUrl,
  metadata,
  contentRisk,
}: UnifiedPublishDialogProps) {
  const router = useRouter()
  const { isComingSoon: isComingSoonPlatform } = usePlatformAccess()
  const [loading, setLoading] = useState(true)
  const [platforms, setPlatforms] = useState<Record<Platform, PlatformState>>({
    tiktok: { connected: false, username: null, selected: false, status: 'idle', error: null, tiktokConfigured: false },
    instagram: { connected: false, username: null, selected: false, status: 'idle', error: null, tiktokConfigured: false },
    youtube: { connected: false, username: null, selected: false, status: 'idle', error: null, tiktokConfigured: false },
    facebook: { connected: false, username: null, selected: false, status: 'idle', error: null, tiktokConfigured: false },
  })
  const [showTikTokConfig, setShowTikTokConfig] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [bankedInDialog, setBankedInDialog] = useState(false)
  const [bankingInProgress, setBankingInProgress] = useState(false)
  const [hasDownloaded, setHasDownloaded] = useState(false)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [youtubePrivacy, setYoutubePrivacy] = useState<'public' | 'unlisted' | 'private'>('public')

  // Read persisted clip status from trending store + localStorage
  const bankedClipIds = useTrendingStore(s => s.bankedClipIds)
  const publishedClipIds = useTrendingStore(s => s.publishedClipIds)
  const markClipPublished = useTrendingStore(s => s.markClipPublished)

  // Resolve download URL from localStorage kill switch or API
  useEffect(() => {
    if (!open || !clipId) return
    try {
      const stored = localStorage.getItem(`render-done:${clipId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.url) { setDownloadUrl(parsed.url); return }
      }
    } catch { /* ignore */ }
    // Fallback: fetch from API
    fetch(`/api/render/status?clip_id=${clipId}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data?.clip_url) setDownloadUrl(json.data.clip_url)
      })
      .catch(() => {})
  }, [open, clipId])

  // Fetch connected accounts + restore persisted clip state on open
  useEffect(() => {
    if (!open) return
    setIsPublishing(false)
    setBankingInProgress(false)

    // Restore persisted state from store + localStorage
    const wasBanked = bankedClipIds.has(clipId)
    const wasPublished = publishedClipIds.has(clipId)
    setBankedInDialog(wasBanked)
    setAllDone(wasPublished)
    if (wasPublished) {
      // Restore published timestamp from localStorage if available
      try {
        const ts = localStorage.getItem(`published-at:${clipId}`)
        setPublishedAt(ts)
      } catch { setPublishedAt(null) }
    } else {
      setPublishedAt(null)
    }
    try {
      setHasDownloaded(localStorage.getItem(`downloaded:${clipId}`) === '1')
    } catch { setHasDownloaded(false) }

    const fetchAccounts = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/social-accounts')
        const json = await res.json() as { data?: ConnectedAccount[] }
        const accounts = (json.data ?? []).filter(a => !a.disconnected_at)

        const wasPublished = publishedClipIds.has(clipId)
        setPlatforms(prev => {
          const next = { ...prev }
          for (const p of ['tiktok', 'instagram', 'youtube', 'facebook'] as Platform[]) {
            const acct = accounts.find(a => a.platform === p)
            next[p] = {
              connected: !!acct,
              username: acct?.username ?? null,
              // Never auto-select coming-soon platforms
              selected: !!acct && !isComingSoonPlatform(p),
              // Restore published status on re-open so TikTok row shows "Published!"
              status: wasPublished && !!acct && !isComingSoonPlatform(p) ? 'success' : 'idle',
              error: null,
              tiktokConfigured: wasPublished,
            }
          }
          return next
        })
      } catch {
        // Silent — platforms stay disconnected
      } finally {
        setLoading(false)
      }
    }

    fetchAccounts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clipId])

  const togglePlatform = (p: Platform) => {
    if (isComingSoonPlatform(p) || !platforms[p].connected || isPublishing || allDone) return
    setPlatforms(prev => ({
      ...prev,
      [p]: { ...prev[p], selected: !prev[p].selected },
    }))
  }

  const selectedPlatformIds = (Object.entries(platforms) as [Platform, PlatformState][])
    .filter(([id, s]) => s.selected && s.connected && !isComingSoonPlatform(id))
    .map(([id]) => id)
  const selectedCount = selectedPlatformIds.length

  const handleConnect = (platform: Platform) => {
    const returnUrl = window.location.pathname + window.location.search
    const separator = returnUrl.includes('?') ? '&' : '?'
    window.location.href = `/api/oauth/${platform}/authorize?redirect=${encodeURIComponent(returnUrl + separator + 'publish=1')}`
  }

  // TikTok publish result callback — TikTokPublishDialog handles its own publish
  const handleTikTokConfigured = (result?: { published: boolean; mode?: 'direct' | 'inbox' }) => {
    setShowTikTokConfig(false)
    if (result?.published) {
      const mode = result.mode ?? 'direct'
      setPlatforms(prev => ({
        ...prev,
        tiktok: {
          ...prev.tiktok,
          tiktokConfigured: true,
          selected: true,
          status: mode === 'inbox' ? 'inbox' as PublishStatus : 'success',
          error: null,
        },
      }))
      setIsPublishing(false)
      setAllDone(true)
      // Persist published state
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setPublishedAt(now)
      markClipPublished(clipId)
      try { localStorage.setItem(`published-at:${clipId}`, now) } catch {}
      // Direct mode: remove clip from bank + cancel autofarm schedule (no double post)
      if (mode === 'direct') {
        fetch(`/api/distribution/bank/${clipId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'remove' }),
        }).catch(() => {})
      }
      // Inbox mode: clip stays in bank, schedule stays — nothing published yet
    } else {
      // User cancelled — reset TikTok back to idle
      setPlatforms(prev => ({
        ...prev,
        tiktok: { ...prev.tiktok, status: 'idle', error: null },
      }))
      setIsPublishing(false)
    }
  }

  // Publish to all selected platforms (only launch-active ones)
  const handlePublish = useCallback(async () => {
    setIsPublishing(true)
    const selected = (Object.entries(platforms) as [Platform, PlatformState][])
      .filter(([id, s]) => s.selected && s.connected && !isComingSoonPlatform(id))

    // TikTok requires its dedicated dialog (Content Sharing compliance:
    // user must choose privacy/interactions before each publish)
    const tiktokSelected = selected.some(([p]) => p === 'tiktok')
    const tiktokAlreadyPublished = platforms.tiktok.tiktokConfigured
    if (tiktokSelected && !tiktokAlreadyPublished) {
      setPlatforms(prev => ({
        ...prev,
        tiktok: { ...prev.tiktok, status: 'publishing', error: null },
      }))
      setShowTikTokConfig(true)
      // TikTokPublishDialog handles publishing — callback updates state via handleTikTokConfigured
    }

    // Publish non-TikTok platforms in parallel
    const nonTiktok = selected.filter(([p]) => p !== 'tiktok')

    if (nonTiktok.length > 0) {
      setPlatforms(prev => {
        const next = { ...prev }
        for (const [p] of nonTiktok) {
          next[p] = { ...next[p], status: 'publishing', error: null }
        }
        return next
      })

      const results = await Promise.allSettled(
        nonTiktok.map(async ([platform]) => {
          const body: Record<string, unknown> = {
            clip_id: clipId,
            caption: clipTitle || 'Viral clip',
            metadata: metadata ?? undefined,
            ...(platform === 'youtube' && { youtube_privacy: youtubePrivacy }),
          }
          const res = await fetch(`/api/publish/${platform}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const json = await res.json() as { data?: { postId?: string }; error?: string }
          if (json.error) throw new Error(json.error)
          return { platform, postId: json.data?.postId }
        })
      )

      const anyNonTiktokSuccess = results.some(r => r.status === 'fulfilled')

      setPlatforms(prev => {
        const next = { ...prev }
        results.forEach((result, i) => {
          const platform = nonTiktok[i][0]
          if (result.status === 'fulfilled') {
            next[platform] = { ...next[platform], status: 'success', error: null }
          } else {
            next[platform] = { ...next[platform], status: 'error', error: result.reason?.message ?? 'Failed' }
          }
        })
        return next
      })

      // Published = consumed: remove from bank + cancel pending schedule + persist state
      if (anyNonTiktokSuccess) {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        setPublishedAt(now)
        markClipPublished(clipId)
        try { localStorage.setItem(`published-at:${clipId}`, now) } catch {}
        fetch(`/api/distribution/bank/${clipId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'remove' }),
        }).catch(() => {})
      }
    }

    // If TikTok wasn't selected or was already published, we're done now.
    // If TikTok dialog is open, handleTikTokConfigured will finalize.
    if (!tiktokSelected || tiktokAlreadyPublished) {
      setIsPublishing(false)
      setAllDone(true)
    }
  }, [platforms, clipId, clipTitle, youtubePrivacy])

  const handleClose = () => {
    if (isPublishing) return
    onClose()
  }

  return (
    <>
      <Dialog open={open && !showTikTokConfig} onClose={handleClose} title="Publish your clip">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Choose where to share your video
              </p>

              {/* Status banner — reflects what has already happened */}
              {(() => {
                const publishedPlatformIds = (Object.entries(platforms) as [Platform, PlatformState][])
                  .filter(([, s]) => s.status === 'success' || s.status === 'inbox')
                  .map(([id]) => id)
                const publishedLabel = formatPlatformList(publishedPlatformIds, '')
                return (
                  <p className={`flex items-center gap-1.5 text-xs ${publishedAt ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${publishedAt ? 'text-emerald-400' : 'text-emerald-400/80'}`} />
                    {publishedAt && publishedLabel
                      ? `Published to ${publishedLabel} — ${publishedAt}`
                      : 'Render saved — publish, bank it, or come back anytime'
                    }
                  </p>
                )
              })()}

              {/* Platform rows */}
              <div className="space-y-2.5">
                {PLATFORMS.map(({ id, name, icon, colors }) => {
                  const isComingSoon = isComingSoonPlatform(id)
                  const state = platforms[id]
                  const isSelected = !isComingSoon && state.connected && state.selected
                  const statusIcon = state.status === 'publishing'
                    ? <WolfLoader variant="spinner" size={16} mode="amber" />
                    : state.status === 'success'
                      ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                      : state.status === 'inbox'
                        ? <AlertCircle className="h-4 w-4 text-amber-400" />
                        : state.status === 'error'
                          ? <AlertCircle className="h-4 w-4 text-red-400" />
                          : null

                  return (
                    <div
                      key={id}
                      className={`rounded-lg border p-3.5 transition-all ${
                        isSelected
                          ? colors
                          : 'border-border bg-muted/20'
                      } ${state.connected && !isPublishing && !allDone ? 'cursor-pointer' : ''}`}
                      onClick={() => !isComingSoon && state.connected && togglePlatform(id)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox / status */}
                        <div className="shrink-0">
                          {statusIcon ?? (
                            state.connected ? (
                              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                              }`}>
                                {isSelected && (
                                  <svg viewBox="0 0 12 12" className="h-3 w-3 fill-white">
                                    <path d="M10.28 2.28L4.5 8.06 1.72 5.28a.75.75 0 00-1.06 1.06l3.5 3.5a.75.75 0 001.06 0l6.5-6.5a.75.75 0 00-1.06-1.06z" />
                                  </svg>
                                )}
                              </div>
                            ) : (
                              <div className="h-5 w-5" />
                            )
                          )}
                        </div>

                        {/* Icon + info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {icon}
                            <span className="text-sm font-semibold text-foreground">{name}</span>
                          </div>
                          {isComingSoon ? (
                            <p className="text-xs text-amber-400/70 mt-0.5">Coming soon</p>
                          ) : state.connected ? (
                            <p className={`text-xs mt-0.5 truncate ${
                              state.status === 'inbox' ? 'text-amber-400' : 'text-muted-foreground'
                            }`}>
                              {state.status === 'success'
                                ? 'Published!'
                                : state.status === 'inbox'
                                  ? 'Sent to TikTok drafts \u2014 open the app to finalize'
                                  : state.status === 'error'
                                    ? state.error
                                    : state.status === 'publishing'
                                      ? 'Publishing...'
                                      : `@${state.username ?? 'connected'}`
                              }
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-0.5">Not connected</p>
                          )}
                        </div>

                        {/* Action button */}
                        <div className="shrink-0" onClick={e => e.stopPropagation()}>
                          {isComingSoon ? (
                            <span className="text-[10px] font-semibold text-amber-400/60 uppercase tracking-wider">Soon</span>
                          ) : !state.connected ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5"
                              onClick={() => handleConnect(id)}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Connect
                            </Button>
                          ) : id === 'tiktok' && !allDone ? (
                            <button
                              onClick={() => setShowTikTokConfig(true)}
                              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                              {state.tiktokConfigured ? 'Configured' : 'Configure'}
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* YouTube visibility selector */}
                      {id === 'youtube' && isSelected && !allDone && (
                        <div className="mt-2.5 ml-8 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <span className="text-[11px] text-muted-foreground mr-1">Visibility</span>
                          {(['public', 'unlisted', 'private'] as const).map(v => (
                            <button
                              key={v}
                              onClick={() => setYoutubePrivacy(v)}
                              className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                                youtubePrivacy === v
                                  ? 'border-red-500/50 bg-red-500/15 text-red-400'
                                  : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                              }`}
                            >
                              {v === 'public' ? 'Public' : v === 'unlisted' ? 'Unlisted' : 'Private'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Content risk warning */}
          {contentRisk && !allDone && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <span className="text-amber-400 shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="text-xs font-medium text-amber-400">TikTok restreint souvent ce type de contenu</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {contentRisk === 'gambling'
                    ? 'Regulated Goods — jeux d\'argent. La vidéo risque d\'être exclue du For You feed et d\'affecter la réputation du compte.'
                    : contentRisk === 'violence'
                      ? 'Contenu violent. La vidéo risque d\'être restreinte ou supprimée par TikTok.'
                      : 'Contenu mature. La vidéo risque d\'être restreinte par TikTok.'}
                </p>
              </div>
            </div>
          )}

          {/* Actions footer */}
          <div className="pt-3 border-t border-border/50 space-y-3">
            {/* ── Primary decisions: Bank + Publish side-by-side ── */}
            <div className="flex flex-col sm:flex-row-reverse gap-2">
              {/* Publish button — greyed out after successful publish */}
              <Button
                onClick={handlePublish}
                disabled={allDone || selectedCount === 0 || isPublishing || loading}
                className={`flex-1 gap-2 border-0 ${
                  allDone
                    ? 'bg-emerald-600/40 text-emerald-300/70 cursor-not-allowed'
                    : 'text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400'
                }`}
              >
                {isPublishing ? (
                  <>
                    <WolfLoader variant="spinner" size={16} mode="amber" />
                    Publishing...
                  </>
                ) : allDone ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Published
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {selectedCount === 0
                      ? 'Select platforms'
                      : `Publish to ${formatPlatformList(selectedPlatformIds)}`
                    }
                  </>
                )}
              </Button>

              {/* Bank button — reflects banked state */}
              {!bankedInDialog ? (
                <button
                  onClick={async () => {
                    setBankingInProgress(true)
                    try {
                      const res = await fetch('/api/distribution/bank', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clipId }),
                      })
                      if (res.ok) {
                        setBankedInDialog(true)
                        useTrendingStore.getState().bankedClipIds.add(clipId)
                      }
                    } catch { /* silent */ }
                    finally { setBankingInProgress(false) }
                  }}
                  disabled={bankingInProgress || isPublishing}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium rounded-md border border-amber-500/30 bg-amber-500/8 text-amber-300 hover:bg-amber-500/15 transition-colors disabled:opacity-50"
                >
                  {bankingInProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                  Place in bank
                </button>
              ) : (
                <button
                  onClick={() => {
                    onClose()
                    router.push(`/dashboard/distribution?scrollTo=bank&highlight=${clipId}`)
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium rounded-md border border-emerald-500/30 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  In bank — View
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Banked confirmation badge */}
            {bankedInDialog && !allDone && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Placed in bank — autofarm will schedule it
              </p>
            )}

            {/* ── Secondary: Done + Download ── */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleClose} disabled={isPublishing}>
                Done
              </Button>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download
                  onClick={() => {
                    setHasDownloaded(true)
                    try { localStorage.setItem(`downloaded:${clipId}`, '1') } catch {}
                  }}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-md border transition-colors ${
                    hasDownloaded
                      ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {hasDownloaded
                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : <Download className="h-3.5 w-3.5" />
                  }
                  {hasDownloaded ? 'Downloaded — Download again' : 'Download MP4'}
                </a>
              )}
            </div>
            <p className="text-[10px] text-zinc-600 leading-snug max-w-xs">
              Raw reposts get removed — always publish enhanced versions with captions and creator credit.
            </p>
          </div>
        </div>
      </Dialog>

      {/* TikTok sub-dialog for compliance configuration */}
      <TikTokPublishDialog
        open={showTikTokConfig}
        onClose={handleTikTokConfigured}
        clipId={clipId}
        clipTitle={clipTitle}
        videoPreviewUrl={videoPreviewUrl}
        metadata={metadata}
      />
    </>
  )
}
