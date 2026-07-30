'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  ChevronRight,
  Send,
} from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TikTokPublishDialog } from './tiktok-publish-dialog'

// ── Types ────────────────────────────────────────────────────────────────────

type Platform = 'tiktok' | 'instagram' | 'youtube'

interface ConnectedAccount {
  platform: string
  username: string | null
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

interface UnifiedPublishDialogProps {
  open: boolean
  onClose: () => void
  clipId: string
  clipTitle?: string
  videoPreviewUrl?: string
}

// ── Platform config ──────────────────────────────────────────────────────────

// Only TikTok is approved for publish at launch. YouTube/Instagram are "coming soon".
const LAUNCH_ACTIVE_PLATFORMS: Platform[] = ['tiktok']
const isComingSoonPlatform = (p: Platform) => !LAUNCH_ACTIVE_PLATFORMS.includes(p)

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
]

// ── Component ────────────────────────────────────────────────────────────────

export function UnifiedPublishDialog({
  open,
  onClose,
  clipId,
  clipTitle,
  videoPreviewUrl,
}: UnifiedPublishDialogProps) {
  const [loading, setLoading] = useState(true)
  const [platforms, setPlatforms] = useState<Record<Platform, PlatformState>>({
    tiktok: { connected: false, username: null, selected: false, status: 'idle', error: null, tiktokConfigured: false },
    instagram: { connected: false, username: null, selected: false, status: 'idle', error: null, tiktokConfigured: false },
    youtube: { connected: false, username: null, selected: false, status: 'idle', error: null, tiktokConfigured: false },
  })
  const [showTikTokConfig, setShowTikTokConfig] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [allDone, setAllDone] = useState(false)

  // Fetch connected accounts on mount
  useEffect(() => {
    if (!open) return
    setAllDone(false)
    setIsPublishing(false)

    const fetchAccounts = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/social-accounts')
        const json = await res.json() as { data?: ConnectedAccount[] }
        const accounts = json.data ?? []

        setPlatforms(prev => {
          const next = { ...prev }
          for (const p of ['tiktok', 'instagram', 'youtube'] as Platform[]) {
            const acct = accounts.find(a => a.platform === p)
            next[p] = {
              connected: !!acct,
              username: acct?.username ?? null,
              // Never auto-select coming-soon platforms
              selected: !!acct && !isComingSoonPlatform(p),
              status: 'idle',
              error: null,
              tiktokConfigured: false,
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
  }, [open])

  const togglePlatform = (p: Platform) => {
    if (isComingSoonPlatform(p) || !platforms[p].connected || isPublishing) return
    setPlatforms(prev => ({
      ...prev,
      [p]: { ...prev[p], selected: !prev[p].selected },
    }))
  }

  const selectedCount = (Object.entries(platforms) as [Platform, PlatformState][])
    .filter(([id, s]) => s.selected && s.connected && !isComingSoonPlatform(id)).length

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
    }

    // If TikTok wasn't selected or was already published, we're done now.
    // If TikTok dialog is open, handleTikTokConfigured will finalize.
    if (!tiktokSelected || tiktokAlreadyPublished) {
      setIsPublishing(false)
      setAllDone(true)
    }
  }, [platforms, clipId, clipTitle])

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
                      } ${state.connected && !isPublishing ? 'cursor-pointer' : ''}`}
                      onClick={() => !isComingSoon && state.connected && !allDone && togglePlatform(id)}
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
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-border/50">
            <Button variant="ghost" onClick={handleClose} disabled={isPublishing}>
              {allDone ? 'Done' : 'Cancel'}
            </Button>
            {!allDone && (
              <Button
                onClick={handlePublish}
                disabled={selectedCount === 0 || isPublishing || loading}
                className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white border-0"
              >
                {isPublishing ? (
                  <>
                    <WolfLoader variant="spinner" size={16} mode="amber" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {selectedCount === 0
                      ? 'Select platforms'
                      : `Publish to ${selectedCount} platform${selectedCount > 1 ? 's' : ''}`
                    }
                  </>
                )}
              </Button>
            )}
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
      />
    </>
  )
}
