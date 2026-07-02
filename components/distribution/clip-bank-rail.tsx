'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Clock, Film, Flame, Loader2, Pause, Play, Plus, Power, Rocket, Sparkles, Upload, X } from 'lucide-react'
import type { QueuePreview } from '@/lib/distribution/smart-queue-engine'
import { isAuditMode } from '@/lib/feature-flags'

interface ClipBankItem {
  id: string
  title: string | null
  score: number | null
  thumbnailUrl: string | null
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
  scheduledAt: string | null
  source: 'trending' | 'upload'
}

interface ClipBankRailProps {
  clipBank: ClipBankItem[]
  removedClipIds: Set<string>
  selectedClipId: string | null
  brokenThumbs: Set<string>
  bankLoading: boolean
  queue: QueuePreview | null
  hasAnyProgress: boolean
  publishProgress: Record<string, { status: string }>
  isOn: boolean
  highlightClipId?: string | null
  onSelect: (clipId: string) => void
  onRemove: (clipId: string) => void
  onThumbError: (clipId: string) => void
  onBrowse: () => void
  onUpload: () => void
  onScrollToToggle?: () => void
  onQuickPublish?: (clipId: string) => void
}

export function ClipBankRail({
  clipBank, removedClipIds, selectedClipId, brokenThumbs, bankLoading, queue,
  hasAnyProgress, publishProgress, isOn, highlightClipId, onSelect, onRemove, onThumbError, onBrowse, onUpload, onScrollToToggle, onQuickPublish,
}: ClipBankRailProps) {
  const visibleClips = clipBank.filter(c => !removedClipIds.has(c.id))
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const videoCache = useRef<Map<string, string>>(new Map())
  const [playingClipId, setPlayingClipId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const sectionRef = useRef<HTMLDivElement>(null)

  // Handle highlight from URL param — only run ONCE when highlightClipId changes
  // (NOT when visibleClips array reference changes, which would re-trigger scroll on every remove)
  const lastHighlightRef = useRef<string | null>(null)
  useEffect(() => {
    if (!highlightClipId) return
    if (lastHighlightRef.current === highlightClipId) return // already handled this highlight
    if (!visibleClips.some(c => c.id === highlightClipId)) return // clip not yet in bank
    lastHighlightRef.current = highlightClipId
    setHighlightedId(highlightClipId)
    setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
    const t = setTimeout(() => setHighlightedId(null), 2500)
    return () => clearTimeout(t)
  }, [highlightClipId, visibleClips])

  // Click-to-play: toggle video playback on card/play button click
  const handlePlayClick = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // If already playing this clip → stop
    if (playingClipId === clipId) {
      setPlayingClipId(null)
      setVideoUrl(null)
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0 }
      return
    }
    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setPlayingClipId(clipId)
    // Check cache
    if (videoCache.current.has(clipId)) {
      setVideoUrl(videoCache.current.get(clipId)!)
      return
    }
    // Fetch video URL
    setVideoLoading(true)
    setVideoUrl(null)
    fetch(`/api/clips/video-url?clipId=${encodeURIComponent(clipId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.video_url) {
          videoCache.current.set(clipId, data.video_url)
          setVideoUrl(data.video_url)
        }
      })
      .catch(() => {})
      .finally(() => setVideoLoading(false))
  }

  return (
    <div ref={sectionRef} id="clip-bank-section" className="dist-glass dist-clip-bank">
      <div className="dist-clip-bank-head">
        <div>
          <h3>
            <span className="dist-clip-bank-dot" />
            Clip Bank
            {isOn ? (
              <span className="dist-smart-pill">Synced</span>
            ) : (
              <span className="dist-smart-pill" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.25)' }}>
                <Pause size={9} style={{ marginRight: 3 }} /> Paused
              </span>
            )}
          </h3>
          <div className="meta">
            <strong>{visibleClips.length} clip{visibleClips.length !== 1 ? 's' : ''}</strong> queued
            <span className="meta-sep">&middot;</span>
            <span className={isOn ? 'scheduled' : ''} style={!isOn ? { color: '#71717A' } : undefined}>
              {queue ? queue.posts.filter(p => !removedClipIds.has(p.clip.id)).length : 0} scheduled
            </span>
            <span className="meta-sep">&middot;</span>
            <span className="priority">{visibleClips.filter(c => (c.score ?? 0) >= 80).length} priority</span>
          </div>
          {!isOn && onScrollToToggle && (
            <button
              onClick={onScrollToToggle}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                padding: '6px 12px', borderRadius: 8,
                background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)',
                color: '#FDE68A', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.15)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.10)' }}
            >
              <Power size={13} />
              Auto-distribute is paused. Resume to start posting these clips.
            </button>
          )}
        </div>
        <div className="dist-clip-bank-actions">
          <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', fontStyle: 'italic' }}>Ordered by AI</span>
          <button className="dist-ghost-btn" onClick={onUpload}>
            <Plus size={12} /> Add clips
          </button>
          <button className="dist-ghost-btn" onClick={onBrowse}>Manage bank</button>
        </div>
      </div>

      {bankLoading ? (
        <div style={{ display: 'flex', gap: 12, padding: '0 20px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ flexShrink: 0, width: 140, height: 240, borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(42,42,62,.5)', animation: 'dist-blink 2s ease-in-out infinite' }} />
          ))}
        </div>
      ) : clipBank.length === 0 ? (
        <div className="dist-clip-bank-empty">
          <div className="empty-icon">
            <Film size={28} />
          </div>
          <div className="empty-copy">
            <p className="empty-title">No clips ready yet</p>
            <p className="empty-sub">Enhance a trending clip or upload your own, then it will appear here.</p>
          </div>
          <div className="empty-actions">
            {isAuditMode ? (
              <button className="dist-cyan-btn" onClick={onUpload}>
                <Upload size={12} /> Upload your clip
              </button>
            ) : (
              <>
                <button className="dist-cyan-btn" onClick={onBrowse}>
                  <Sparkles size={12} /> Browse trending
                </button>
                <button className="dist-ghost-btn" onClick={onUpload}>
                  <Plus size={12} /> Upload
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="dist-clip-rail-wrap" style={!isOn ? { opacity: 0.7 } : undefined}>
          <div className="dist-clip-rail">
            {visibleClips.map((clip, idx) => {
              // Tier classification matches Browse rank tiers (lib/scoring/clip-scorer.ts):
              // ≥80 legendary (gold), ≥65 epic (cyan), ≥45 super_rare, ≥25 rare, <25 common
              const score = clip.score ?? 0
              const scoreClass =
                score >= 80 ? 'legendary' :
                score >= 65 ? 'epic' :
                score >= 45 ? 'super-rare' :
                score >= 25 ? 'rare' : 'common'
              const clipPublished = hasAnyProgress && Object.values(publishProgress).every(p => p.status === 'published')
              const isBest = idx === 0
              const isScheduled = clip.status === 'scheduled' && !!clip.scheduledAt
              const isPriority = !isBest && !isScheduled && (clip.score ?? 0) >= 80
              const hasThumb = !!clip.thumbnailUrl && !brokenThumbs.has(clip.id)
              const isMissingVideo = !clip.thumbnailUrl
              const isBrokenPreview = !!clip.thumbnailUrl && brokenThumbs.has(clip.id)
              const isPlaceholder = !hasThumb
              const isDraftWithThumb = clip.status === 'draft' && hasThumb && !isBest && !isPriority && !isScheduled
              const isReady = !isBest && !isPriority && !isScheduled && !isDraftWithThumb && hasThumb
              const scheduledTime = isScheduled && clip.scheduledAt
                ? new Date(clip.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                : null
              return (
                <div
                  key={clip.id}
                  className={[
                    'dist-clip',
                    selectedClipId === clip.id ? 'selected' : '',
                    isBest ? 'best-next' : '',
                    isPriority ? 'priority-clip' : '',
                    isPlaceholder ? 'placeholder-clip' : '',
                    isDraftWithThumb ? 'draft-with-thumb' : '',
                    highlightedId === clip.id ? 'dist-clip-highlight' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onSelect(clip.id)}
                  title={clip.title || 'Untitled clip'}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                >
                  <button
                    type="button"
                    className="dist-clip-remove"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(clip.id)
                    }}
                    title="Remove from bank"
                    aria-label="Remove clip"
                  >
                    <X size={12} />
                  </button>
                  <div className="dist-clip-thumb">
                    {hasThumb ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={clip.thumbnailUrl!}
                          alt=""
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          onError={() => onThumbError(clip.id)}
                        />
                        {isDraftWithThumb && <div className="dist-clip-thumb-overlay" />}
                        {/* Video preview (click-to-play) */}
                        {playingClipId === clip.id && videoUrl && (
                          <video
                            ref={videoRef}
                            key={videoUrl}
                            src={videoUrl}
                            autoPlay muted loop playsInline
                            className="dist-clip-video-preview"
                            onClick={(e) => handlePlayClick(clip.id, e)}
                          />
                        )}
                        {playingClipId === clip.id && videoLoading && (
                          <div className="dist-clip-video-loading">
                            <Loader2 size={16} className="animate-spin" />
                          </div>
                        )}
                        {playingClipId !== clip.id && (
                          <div className="play-glyph" onClick={(e) => handlePlayClick(clip.id, e)} style={{ cursor: 'pointer' }}>
                            <Play size={28} />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="dist-clip-thumb-placeholder">
                        <Film size={14} />
                        <span>{isMissingVideo ? 'Needs video' : 'Preview unavailable'}</span>
                      </div>
                    )}
                  </div>
                  <div className="dist-clip-status">
                    {isScheduled && (
                      <span className="dist-status-pill scheduled">
                        <Clock size={9} /> Scheduled {scheduledTime}
                      </span>
                    )}
                    {isBest && !isScheduled && (
                      <span
                        className="dist-status-pill best"
                        style={!isOn ? { background: 'rgba(245,158,11,0.15)', color: '#FBBF24', borderColor: 'rgba(245,158,11,0.3)', boxShadow: 'none' } : undefined}
                        title={!isOn ? 'Will post when auto-distribute is ON' : undefined}
                      >
                        {'\u2605'} Best next
                      </span>
                    )}
                    {isPriority && (
                      <span className="dist-status-pill priority">
                        <Flame size={9} /> Priority
                      </span>
                    )}
                    {isReady && (
                      <span className="dist-status-pill ready">Ready</span>
                    )}
                    {isDraftWithThumb && (
                      <span className="dist-status-pill draft">Draft</span>
                    )}
                    {isMissingVideo && !isBest && !isScheduled && (
                      <span className="dist-status-pill missing">Needs video</span>
                    )}
                    {isBrokenPreview && !isBest && !isScheduled && (
                      <span className="dist-status-pill missing">Preview unavailable</span>
                    )}
                  </div>
                  {/* Score pill — bottom-right CORNER of the video thumbnail (overlay) */}
                  {clip.score != null && (
                    <span className={`dist-score-pill dist-score-corner ${scoreClass}`}>{clip.score}</span>
                  )}
                  <div className="dist-clip-foot">
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
                      <div className="order">#{idx + 1}</div>
                      <div className="title-line">{clip.title || 'Untitled clip'}</div>
                    </div>
                    {/* Quick publish button — bottom-right of the foot, primary cyan action */}
                    {onQuickPublish && hasThumb && !clipPublished && (
                      <button
                        type="button"
                        className="dist-clip-quick-publish"
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickPublish(clip.id)
                        }}
                        title="Publish this clip now"
                        aria-label="Publish this clip now"
                      >
                        <Rocket size={13} />
                      </button>
                    )}
                  </div>
                  {clipPublished && selectedClipId === clip.id && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(56,189,248,.2)', display: 'grid', placeItems: 'center', borderRadius: 14 }}>
                      <Check size={24} style={{ color: '#38BDF8' }} />
                    </div>
                  )}
                </div>
              )
            })}
            {/* Add clips card */}
            <div className="dist-clip empty" onClick={onBrowse}>
              <div className="ec">
                <span className="plus">+</span>
                <span>Add clips</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
