'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  Hash,
  X,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { useDistributionStore } from '@/stores/distribution-store'

interface PublishDialogProps {
  open: boolean
  onClose: () => void
  clipId: string
  clipTitle?: string
}

const PLATFORM_LABELS: Record<string, { name: string; icon: React.ReactNode }> = {
  tiktok: {
    name: 'TikTok',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.11v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.83a4.84 4.84 0 0 1-1-.14z" />
      </svg>
    ),
  },
  youtube: {
    name: 'YouTube',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-red-500" aria-hidden="true">
        <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.67 31.67 0 0 0 0 12a31.67 31.67 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.84.55 9.38.55 9.38.55s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.67 31.67 0 0 0 24 12a31.67 31.67 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
      </svg>
    ),
  },
  instagram: {
    name: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-pink-500" aria-hidden="true">
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.72 3.72 0 0 1-.9 1.38c-.42.42-.82.68-1.38.9-.42.17-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.17-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.17 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.78.3-1.44.71-2.1 1.37A5.87 5.87 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.78.71 1.44 1.37 2.1a5.87 5.87 0 0 0 2.14 1.37c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.87 5.87 0 0 0 2.14-1.37 5.87 5.87 0 0 0 1.37-2.1c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.87 5.87 0 0 0-1.37-2.14A5.87 5.87 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.85-10.4a1.44 1.44 0 1 0-2.88 0 1.44 1.44 0 0 0 2.88 0z" />
      </svg>
    ),
  },
}

export function PublishDialog({ open, onClose, clipId, clipTitle }: PublishDialogProps) {
  const {
    accounts,
    publishTargets,
    publishProgress,
    isPublishing,
    fetchAccounts,
    togglePublishTarget,
    publishClip,
    resetPublishProgress,
  } = useDistributionStore()

  const [caption, setCaption] = useState('')
  const [hashtagInput, setHashtagInput] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const hasResults = Object.keys(publishProgress).length > 0

  useEffect(() => {
    if (open) {
      fetchAccounts()
      setCaption(clipTitle ?? '')
      setHashtags([])
      setHashtagInput('')
      resetPublishProgress()
    }
  }, [open, clipTitle, fetchAccounts, resetPublishProgress])

  const addHashtag = useCallback(() => {
    const tag = hashtagInput.trim().replace(/^#/, '')
    if (tag && !hashtags.includes(tag) && hashtags.length < 30) {
      setHashtags((prev) => [...prev, tag])
      setHashtagInput('')
    }
  }, [hashtagInput, hashtags])

  const removeHashtag = (tag: string) => {
    setHashtags((prev) => prev.filter((h) => h !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addHashtag()
    }
  }

  const enabledTargets = publishTargets.filter((t) => t.enabled)
  const connectedPlatforms = accounts.map((a) => a.platform)
  const canPublish =
    !isPublishing &&
    caption.trim().length > 0 &&
    enabledTargets.length > 0 &&
    !hasResults

  const handlePublish = async () => {
    await publishClip(clipId, caption, hashtags)
  }

  const handleClose = () => {
    if (!isPublishing) {
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Publish Clip"
      description="Share your clip to connected social media platforms"
    >
      <div className="space-y-5">
        {/* Platform selection */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Publish to
          </label>
          {connectedPlatforms.length === 0 ? (
            <Card className="border-dashed border-border">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No accounts connected.{' '}
                  <a href="/settings" className="text-primary hover:underline">
                    Connect accounts in Settings
                  </a>
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-wrap gap-2">
              {publishTargets.map((target) => {
                const isConnected = connectedPlatforms.includes(target.platform)
                const label = PLATFORM_LABELS[target.platform]
                const isInstagram = target.platform === 'instagram'

                if (!isConnected) return null

                return (
                  <button
                    key={target.platform}
                    type="button"
                    onClick={() => {
                      if (!isPublishing && !hasResults && !isInstagram) {
                        togglePublishTarget(target.platform)
                      }
                    }}
                    disabled={isPublishing || hasResults || isInstagram}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium
                      transition-all cursor-pointer
                      ${
                        target.enabled && !isInstagram
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-border/80'
                      }
                      ${isInstagram ? 'opacity-50 cursor-not-allowed' : ''}
                      disabled:cursor-not-allowed
                    `}
                  >
                    {label?.icon}
                    <span>{label?.name}</span>
                    {isInstagram && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 text-amber-400 border-amber-400/40"
                      >
                        Soon
                      </Badge>
                    )}
                    {target.enabled && !isInstagram && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Caption */}
        <div>
          <label htmlFor="publish-caption" className="text-sm font-medium text-foreground mb-2 block">
            Caption
          </label>
          <textarea
            id="publish-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption for your clip..."
            maxLength={2200}
            disabled={isPublishing || hasResults}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {caption.length} / 2200
          </p>
        </div>

        {/* Hashtags */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Hashtags
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add hashtag..."
                disabled={isPublishing || hasResults || hashtags.length >= 30}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addHashtag}
              disabled={isPublishing || hasResults || !hashtagInput.trim() || hashtags.length >= 30}
              className="h-10"
            >
              Add
            </Button>
          </div>
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {hashtags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs px-2 py-0.5 gap-1 text-foreground"
                >
                  #{tag}
                  {!isPublishing && !hasResults && (
                    <button
                      onClick={() => removeHashtag(tag)}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Publish progress / results */}
        {hasResults && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              Results
            </label>
            {Object.values(publishProgress).map((progress) => {
              const label = PLATFORM_LABELS[progress.platform]
              return (
                <Card
                  key={progress.platform}
                  className={`border ${
                    progress.status === 'published'
                      ? 'border-green-500/30 bg-green-500/5'
                      : progress.status === 'error'
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-border'
                  }`}
                >
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {label?.icon}
                      <span className="text-sm font-medium text-foreground">
                        {label?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {progress.status === 'publishing' && (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Publishing...</span>
                        </>
                      )}
                      {progress.status === 'published' && (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                          <span className="text-xs text-green-400 font-medium">Published</span>
                          {progress.trackingUrl && (
                            <a
                              href={progress.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1 text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </>
                      )}
                      {progress.status === 'error' && (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-400" />
                          <span className="text-xs text-red-400 font-medium truncate max-w-[200px]">
                            {progress.error ?? 'Failed'}
                          </span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          {hasResults ? (
            <Button onClick={handleClose} variant="outline">
              Close
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
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Publish to {enabledTargets.length} platform
                    {enabledTargets.length !== 1 ? 's' : ''}
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
