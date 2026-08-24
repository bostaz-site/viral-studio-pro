'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  Send,
  Info,
  ExternalLink,
} from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type {
  TikTokCreatorInfo,
  TikTokPrivacyLevel,
  TikTokPublishStatus,
} from '@/types/tiktok'
import { PRIVACY_LEVEL_LABELS } from '@/types/tiktok'

// ── Props ────────────────────────────────────────────────────────────────────

export interface TikTokPublishResult {
  published: boolean
  mode?: 'direct' | 'inbox'
}

interface TikTokPublishDialogProps {
  open: boolean
  onClose: (result?: TikTokPublishResult) => void
  clipId: string
  clipTitle?: string
  clipDurationSeconds?: number
  videoPreviewUrl?: string
  metadata?: Record<string, unknown>
}

// ── Component ────────────────────────────────────────────────────────────────

// ── Sensible defaults (public, interactions ON, no commercial) ───────────────
const TIKTOK_PUBLISH_DEFAULTS = {
  privacy_level: 'PUBLIC_TO_EVERYONE' as TikTokPrivacyLevel,
  allowComment: true,
  allowDuet: true,
  allowStitch: true,
  commercialEnabled: false,
  brandOrganic: false,
  brandContent: false,
}

const LOCALSTORAGE_KEY = 'va:tiktok-publish-prefs'

function loadSavedPrefs(): Partial<typeof TIKTOK_PUBLISH_DEFAULTS> {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<typeof TIKTOK_PUBLISH_DEFAULTS>
  } catch { return {} }
}

function savePrefs(prefs: typeof TIKTOK_PUBLISH_DEFAULTS) {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(prefs))
  } catch { /* quota or SSR — ignore */ }
}

export function TikTokPublishDialog({
  open,
  onClose,
  clipId,
  clipTitle,
  clipDurationSeconds,
  videoPreviewUrl,
  metadata,
}: TikTokPublishDialogProps) {
  // Creator info
  const [creatorInfo, setCreatorInfo] = useState<TikTokCreatorInfo | null>(null)
  const [creatorInfoLoading, setCreatorInfoLoading] = useState(false)
  const [creatorInfoError, setCreatorInfoError] = useState<string | null>(null)

  // Form fields — sensible defaults, overridden by saved user prefs
  const [title, setTitle] = useState('')
  const [privacyLevel, setPrivacyLevel] = useState<TikTokPrivacyLevel>(TIKTOK_PUBLISH_DEFAULTS.privacy_level)
  const [allowComment, setAllowComment] = useState(TIKTOK_PUBLISH_DEFAULTS.allowComment)
  const [allowDuet, setAllowDuet] = useState(TIKTOK_PUBLISH_DEFAULTS.allowDuet)
  const [allowStitch, setAllowStitch] = useState(TIKTOK_PUBLISH_DEFAULTS.allowStitch)

  // Commercial content disclosure
  const [commercialEnabled, setCommercialEnabled] = useState(TIKTOK_PUBLISH_DEFAULTS.commercialEnabled)
  const [brandOrganic, setBrandOrganic] = useState(TIKTOK_PUBLISH_DEFAULTS.brandOrganic)
  const [brandContent, setBrandContent] = useState(TIKTOK_PUBLISH_DEFAULTS.brandContent)

  // Publish state
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishId, setPublishId] = useState<string | null>(null)
  const [publishStatus, setPublishStatus] = useState<TikTokPublishStatus | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishedPostId, setPublishedPostId] = useState<string | null>(null)
  const [publishMode, setPublishMode] = useState<'direct' | 'inbox' | null>(null)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)
  const pollErrorCountRef = useRef(0)
  const [pollTimedOut, setPollTimedOut] = useState(false)

  // ── Fetch creator info on mount ──────────────────────────────────────────

  useEffect(() => {
    if (!open) return

    // Reset state — load saved user preferences (localStorage) or sensible defaults
    const saved = loadSavedPrefs()
    setTitle(clipTitle ?? '')
    setPrivacyLevel(saved.privacy_level ?? TIKTOK_PUBLISH_DEFAULTS.privacy_level)
    setAllowComment(saved.allowComment ?? TIKTOK_PUBLISH_DEFAULTS.allowComment)
    setAllowDuet(saved.allowDuet ?? TIKTOK_PUBLISH_DEFAULTS.allowDuet)
    setAllowStitch(saved.allowStitch ?? TIKTOK_PUBLISH_DEFAULTS.allowStitch)
    setCommercialEnabled(saved.commercialEnabled ?? TIKTOK_PUBLISH_DEFAULTS.commercialEnabled)
    setBrandOrganic(saved.brandOrganic ?? TIKTOK_PUBLISH_DEFAULTS.brandOrganic)
    setBrandContent(saved.brandContent ?? TIKTOK_PUBLISH_DEFAULTS.brandContent)
    setPublishId(null)
    setPublishStatus(null)
    setPublishError(null)
    setPublishedPostId(null)
    setPublishMode(null)
    setIsPublishing(false)
    setPollTimedOut(false)
    pollCountRef.current = 0
    pollErrorCountRef.current = 0
    setCreatorInfoError(null)

    const fetchCreatorInfo = async () => {
      setCreatorInfoLoading(true)
      try {
        const res = await fetch('/api/tiktok/creator-info')
        const json = await res.json() as {
          data?: { creatorInfo: TikTokCreatorInfo }
          error?: string
        }

        if (json.error) {
          setCreatorInfoError(json.error)
          return
        }

        if (json.data?.creatorInfo) {
          setCreatorInfo(json.data.creatorInfo)
        }
      } catch {
        setCreatorInfoError('Failed to load TikTok account info')
      } finally {
        setCreatorInfoLoading(false)
      }
    }

    fetchCreatorInfo()

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [open, clipTitle])

  // ── Validation ───────────────────────────────────────────────────────────

  const durationExceedsMax =
    creatorInfo &&
    clipDurationSeconds != null &&
    clipDurationSeconds > creatorInfo.max_video_post_duration_sec

  const brandedConflict =
    brandContent && privacyLevel === 'SELF_ONLY'

  const commercialMissingSelection =
    commercialEnabled && !brandOrganic && !brandContent

  const canPublish =
    !isPublishing &&
    !publishId &&
    creatorInfo &&
    !!privacyLevel &&
    title.trim().length > 0 &&
    !durationExceedsMax &&
    !brandedConflict &&
    (!commercialEnabled || (brandOrganic || brandContent))

  // ── Publish handler ──────────────────────────────────────────────────────

  const handlePublish = useCallback(async () => {
    if (!canPublish || !creatorInfo) return

    setIsPublishing(true)
    setPublishError(null)

    // Save user preferences for next publish
    savePrefs({
      privacy_level: privacyLevel,
      allowComment,
      allowDuet,
      allowStitch,
      commercialEnabled,
      brandOrganic,
      brandContent,
    })

    try {
      const res = await fetch('/api/publish/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip_id: clipId,
          caption: title,
          tiktok_options: {
            privacy_level: privacyLevel,
            disable_comment: !allowComment,
            disable_duet: !allowDuet,
            disable_stitch: !allowStitch,
            brand_content_toggle: brandContent,
            brand_organic_toggle: brandOrganic,
          },
          metadata: metadata ?? undefined,
        }),
      })

      const json = await res.json() as {
        data?: { postId?: string; publishId?: string; mode?: 'direct' | 'inbox' }
        error?: string
      }

      if (json.error) {
        setPublishError(json.error)
        setIsPublishing(false)
        return
      }

      const mode = json.data?.mode ?? 'direct'
      setPublishMode(mode)
      const pid = json.data?.publishId ?? json.data?.postId ?? null
      setPublishId(pid ?? 'inbox-success')

      // Inbox mode: no polling needed — video is in TikTok drafts
      if (mode === 'inbox') {
        setPublishStatus('PUBLISH_COMPLETE')
        setIsPublishing(false)
        // Auto-propagate success to parent immediately
        onClose({ published: true, mode: 'inbox' })
        return
      }

      // Direct Post mode: poll for status (max 36 polls = ~3 min)
      const MAX_POLLS = 36
      const MAX_CONSECUTIVE_ERRORS = 3
      if (pid) {
        pollCountRef.current = 0
        pollErrorCountRef.current = 0
        pollingRef.current = setInterval(async () => {
          pollCountRef.current++

          // Timeout: stop polling after MAX_POLLS attempts
          if (pollCountRef.current > MAX_POLLS) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
            setPollTimedOut(true)
            setIsPublishing(false)
            return
          }

          try {
            const statusRes = await fetch('/api/tiktok/publish-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publish_id: pid }),
            })
            const statusJson = await statusRes.json() as {
              data?: { status: TikTokPublishStatus; fail_reason?: string; post_id?: string }
              error?: string
            }

            // Reset consecutive error count on successful poll
            pollErrorCountRef.current = 0

            if (statusJson.data?.status) {
              setPublishStatus(statusJson.data.status)

              if (
                statusJson.data.status === 'PUBLISH_COMPLETE' ||
                statusJson.data.status === 'FAILED'
              ) {
                if (pollingRef.current) {
                  clearInterval(pollingRef.current)
                  pollingRef.current = null
                }
                if (statusJson.data.status === 'PUBLISH_COMPLETE') {
                  if (statusJson.data.post_id) setPublishedPostId(statusJson.data.post_id)
                  setIsPublishing(false)
                  // Auto-propagate success to parent immediately
                  onClose({ published: true, mode: publishMode || 'direct' })
                  return
                }
                if (statusJson.data.status === 'FAILED') {
                  setPublishError(statusJson.data.fail_reason ?? 'Publishing failed')
                }
                setIsPublishing(false)
              }
            }
          } catch {
            // Track consecutive network errors — give up after MAX_CONSECUTIVE_ERRORS
            pollErrorCountRef.current++
            if (pollErrorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
              if (pollingRef.current) {
                clearInterval(pollingRef.current)
                pollingRef.current = null
              }
              setPollTimedOut(true)
              setIsPublishing(false)
            }
          }
        }, 5000)
      } else {
        setIsPublishing(false)
      }
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Network error')
      setIsPublishing(false)
    }
  }, [canPublish, creatorInfo, clipId, title, privacyLevel, allowComment, allowDuet, allowStitch, brandContent, brandOrganic])

  // ── Close handler ────────────────────────────────────────────────────────

  const handleClose = () => {
    // Allow close when polling timed out, or when not in the initial publish request.
    // During PROCESSING, closing is safe — the post continues on TikTok's side.
    const isInitialPublishRequest = isPublishing && !publishId
    if (isInitialPublishRequest) return

    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    // If a publishId exists, the API accepted the post — it's published
    // (even if polling hasn't confirmed PUBLISH_COMPLETE yet).
    // TikTok processes it asynchronously; closing during PROCESSING is safe.
    if (publishId && publishMode) {
      onClose({ published: true, mode: publishMode })
    } else {
      onClose()
    }
  }

  // ── Legal text ───────────────────────────────────────────────────────────

  const getLegalText = () => {
    if (commercialEnabled && brandContent) {
      return (
        <p className="text-xs text-muted-foreground">
          By posting, you agree to TikTok&apos;s{' '}
          <a
            href="https://www.tiktok.com/legal/page/global/bc-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Branded Content Policy
          </a>{' '}
          and{' '}
          <a
            href="https://www.tiktok.com/legal/page/global/music-usage-confirmation"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Music Usage Confirmation
          </a>
          .
        </p>
      )
    }

    return (
      <p className="text-xs text-muted-foreground">
        By posting, you agree to TikTok&apos;s{' '}
        <a
          href="https://www.tiktok.com/legal/page/global/music-usage-confirmation"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Music Usage Confirmation
        </a>
        .
      </p>
    )
  }

  // ── Publish status display ───────────────────────────────────────────────

  const getStatusDisplay = () => {
    if (!publishId) return null

    const isInbox = publishId === 'inbox-success'

    const statusLabels: Record<TikTokPublishStatus, string> = {
      PROCESSING_UPLOAD: 'Uploading to TikTok...',
      PROCESSING_DOWNLOAD: 'Processing video...',
      SEND_TO_USER_INBOX: 'Posting to your TikTok profile...',
      PUBLISH_COMPLETE: isInbox
        ? 'Video sent to your TikTok drafts'
        : 'Published on your TikTok profile!',
      FAILED: 'Publishing failed',
    }

    const isComplete = publishStatus === 'PUBLISH_COMPLETE'
    const isFailed = publishStatus === 'FAILED'
    const isProcessing = !isComplete && !isFailed && !pollTimedOut

    const tiktokVideoUrl = publishedPostId && creatorInfo?.creator_username
      ? `https://www.tiktok.com/@${creatorInfo.creator_username}/video/${publishedPostId}`
      : null

    return (
      <div
        className={`rounded-lg border p-4 ${
          isComplete
            ? 'border-green-500/30 bg-green-500/5'
            : isFailed || pollTimedOut
              ? pollTimedOut ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5'
              : 'border-border bg-muted/20'
        }`}
      >
        <div className="flex items-center gap-3">
          {isProcessing && <WolfLoader variant="spinner" size={20} mode="amber" />}
          {isComplete && <CheckCircle2 className="h-5 w-5 text-green-400" />}
          {isFailed && !pollTimedOut && <AlertCircle className="h-5 w-5 text-red-400" />}
          {pollTimedOut && <AlertCircle className="h-5 w-5 text-amber-400" />}

          <div className="flex-1">
            <p className={`text-sm font-medium ${
              pollTimedOut ? 'text-amber-400' : isComplete ? 'text-green-400' : isFailed ? 'text-red-400' : 'text-foreground'
            }`}>
              {pollTimedOut
                ? 'Still processing on TikTok\u2019s side'
                : publishStatus ? statusLabels[publishStatus] : 'Initializing...'}
            </p>
            {pollTimedOut && (
              <p className="text-xs text-muted-foreground mt-1">
                Your post will appear on your TikTok profile when ready. Safe to close.
              </p>
            )}
            {isProcessing && !pollTimedOut && (
              <p className="text-xs text-muted-foreground mt-1">
                It may take a few minutes for content to be visible on your TikTok profile.
              </p>
            )}
            {isComplete && !isInbox && tiktokVideoUrl && (
              <a
                href={tiktokVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1.5"
              >
                View on TikTok
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {isComplete && !isInbox && !tiktokVideoUrl && (
              <p className="text-xs text-muted-foreground mt-1">
                Your video is now live on your TikTok profile.
              </p>
            )}
            {isComplete && isInbox && (
              <p className="text-xs text-muted-foreground mt-1">
                Direct Post unavailable. Open the TikTok app to finalize and share your post.
              </p>
            )}
            {isFailed && publishError && (
              <p className="text-xs text-red-400 mt-1">{publishError}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Post to TikTok"
      description="Publish your clip directly to your TikTok account"
    >
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* Loading skeleton */}
        {creatorInfoLoading && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              </div>
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* Not connected or error → Connect TikTok CTA */}
        {creatorInfoError && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current text-foreground" aria-hidden="true">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.11v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.83a4.84 4.84 0 0 1-1-.14z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Connect TikTok to publish</p>
              <p className="text-sm text-muted-foreground mt-1">
                Authorize Viral Animal to post to your TikTok account
              </p>
            </div>
            <Button
              onClick={() => {
                // Save current page URL so OAuth callback can redirect back with ?publish=1
                const returnUrl = window.location.pathname + window.location.search
                window.location.href = `/api/oauth/tiktok/authorize?redirect=${encodeURIComponent(returnUrl + (returnUrl.includes('?') ? '&' : '?') + 'publish=1')}`
              }}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Connect TikTok
            </Button>
          </div>
        )}

        {/* Main form — only when creator info is loaded */}
        {creatorInfo && !creatorInfoLoading && !publishId && (
          <>
            {/* 1. Creator nickname */}
            <div className="flex items-center gap-3">
              {creatorInfo.creator_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creatorInfo.creator_avatar_url}
                  alt={creatorInfo.creator_nickname}
                  className="h-10 w-10 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                  {creatorInfo.creator_nickname?.charAt(0)?.toUpperCase() ?? 'T'}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {creatorInfo.creator_nickname}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{creatorInfo.creator_username}
                </p>
              </div>
            </div>

            {/* 2. Video preview */}
            {videoPreviewUrl && (
              <div className="rounded-lg overflow-hidden border border-border bg-black aspect-[9/16] max-h-[200px] flex items-center justify-center">
                <video
                  src={videoPreviewUrl}
                  className="max-h-full max-w-full object-contain"
                  muted
                  playsInline
                  controls={false}
                  autoPlay={false}
                  poster=""
                />
              </div>
            )}

            {/* 3. Caption */}
            <div>
              <label htmlFor="tiktok-title" className="text-sm font-medium text-foreground mb-1.5 block">
                Caption
              </label>
              <textarea
                id="tiktok-title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 300))}
                placeholder="Describe your video..."
                rows={3}
                disabled={isPublishing}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10.5px] text-slate-500">
                  Hook court + 3-5 hashtags niche (#streamer #clips) — avoid #fyp
                </p>
                <p className="text-xs text-muted-foreground shrink-0">
                  {title.length} / 300
                </p>
              </div>
            </div>

            {/* 4. Privacy dropdown — defaults to Public */}
            <div>
              <label htmlFor="tiktok-privacy" className="text-sm font-medium text-foreground mb-1.5 block">
                Who can view this video
              </label>
              <Select value={privacyLevel} onValueChange={(val) => setPrivacyLevel(val as TikTokPrivacyLevel)}>
                <SelectTrigger id="tiktok-privacy" disabled={isPublishing} className="h-10">
                  <span className="line-clamp-1">
                    {PRIVACY_LEVEL_LABELS[privacyLevel] ?? privacyLevel}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {creatorInfo.privacy_level_options.map((level) => (
                    <SelectItem key={level} value={level}>
                      {PRIVACY_LEVEL_LABELS[level] ?? level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 5. Interaction toggles — ON by default, greyed if disabled by creator */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground block">
                Allow users to
              </label>

              <ToggleRow
                label="Comment"
                checked={allowComment}
                onChange={setAllowComment}
                disabled={isPublishing || creatorInfo.comment_disabled}
                disabledReason={creatorInfo.comment_disabled ? 'Disabled in your TikTok settings' : undefined}
              />
              <ToggleRow
                label="Duet"
                checked={allowDuet}
                onChange={setAllowDuet}
                disabled={isPublishing || creatorInfo.duet_disabled}
                disabledReason={creatorInfo.duet_disabled ? 'Disabled in your TikTok settings' : undefined}
              />
              <ToggleRow
                label="Stitch"
                checked={allowStitch}
                onChange={setAllowStitch}
                disabled={isPublishing || creatorInfo.stitch_disabled}
                disabledReason={creatorInfo.stitch_disabled ? 'Disabled in your TikTok settings' : undefined}
              />
            </div>

            {/* 6. Commercial Content Disclosure */}
            <div className="space-y-3">
              <ToggleRow
                label="Commercial content"
                checked={commercialEnabled}
                onChange={(val) => {
                  setCommercialEnabled(val)
                  if (!val) {
                    setBrandOrganic(false)
                    setBrandContent(false)
                  }
                }}
                disabled={isPublishing}
                info="Indicate if your content promotes a brand or product"
              />

              {commercialEnabled && (
                <div className="ml-6 space-y-2 border-l-2 border-border pl-4">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={brandOrganic}
                      onChange={(e) => setBrandOrganic(e.target.checked)}
                      disabled={isPublishing}
                      className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary/50"
                    />
                    <div>
                      <span className="text-sm text-foreground group-hover:text-foreground/90">
                        Your brand
                      </span>
                      <p className="text-xs text-muted-foreground">
                        You are promoting yourself or your own business
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={brandContent}
                      onChange={(e) => setBrandContent(e.target.checked)}
                      disabled={isPublishing}
                      className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary/50"
                    />
                    <div>
                      <span className="text-sm text-foreground group-hover:text-foreground/90">
                        Branded content
                      </span>
                      <p className="text-xs text-muted-foreground">
                        You are promoting another brand or a third party (paid partnership)
                      </p>
                    </div>
                  </label>

                  {/* Conflict: Branded Content + SELF_ONLY */}
                  {brandedConflict && (
                    <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-400">
                        Branded content cannot be set to &quot;Only me&quot;. Please change your privacy setting.
                      </p>
                    </div>
                  )}

                  {/* Must select at least one */}
                  {commercialMissingSelection && (
                    <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                      <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-400">
                        You need to indicate if your content promotes yourself, a third party, or both.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Duration warning */}
            {durationExceedsMax && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/5">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">
                  Your video ({Math.round(clipDurationSeconds!)}s) exceeds the maximum allowed
                  duration for your TikTok account ({creatorInfo.max_video_post_duration_sec}s).
                  Please trim your clip before publishing.
                </p>
              </div>
            )}

            {/* 7. Legal declaration — BEFORE publish button */}
            <div className="pt-1">
              {getLegalText()}
            </div>
          </>
        )}

        {/* Publish status polling display */}
        {publishId && getStatusDisplay()}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
          {publishId ? (
            <Button onClick={handleClose} variant="outline" disabled={isPublishing && !publishId}>
              {publishStatus === 'PUBLISH_COMPLETE' ? 'Done'
                : pollTimedOut ? 'Close'
                : isPublishing ? 'Close (post continues on TikTok)'
                : 'Close'}
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={isPublishing}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                disabled={!canPublish}
                className="gap-2"
              >
                {isPublishing ? (
                  <>
                    <WolfLoader variant="spinner" size={16} mode="amber" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Publish to TikTok
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}

// ── Toggle Row Component ─────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
  disabledReason?: string
  info?: string
}

function ToggleRow({ label, checked, onChange, disabled, disabledReason, info }: ToggleRowProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground">{label}</span>
        {info && (
          <span title={info}>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
        {disabledReason && (
          <span className="text-xs text-muted-foreground italic">
            ({disabledReason})
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
          border-2 border-transparent transition-colors duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
          disabled:cursor-not-allowed
          ${checked ? 'bg-primary' : 'bg-muted'}
        `}
      >
        <span
          className={`
            pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0
            transition-transform duration-200
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  )
}
