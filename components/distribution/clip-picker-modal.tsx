'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Film, Layers, Check, Flame } from 'lucide-react'

interface ClipBankItem {
  id: string
  title: string | null
  score: number | null
  thumbnailUrl: string | null
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
  scheduledAt: string | null
  source: 'trending' | 'upload'
}

interface ClipPickerModalProps {
  clipBank: ClipBankItem[]
  selectedClipId: string | null
  brokenThumbs: Set<string>
  removedClipIds?: Set<string>
  onSelectClip: (clipId: string) => void
  onClose: () => void
  onBrokenThumb: (clipId: string) => void
}

export function ClipPickerModal({
  clipBank,
  selectedClipId,
  brokenThumbs,
  removedClipIds,
  onSelectClip,
  onClose,
  onBrokenThumb,
}: ClipPickerModalProps) {
  const router = useRouter()

  // Filter out removed clips so the picker matches the bank rail count exactly
  const visibleClips = removedClipIds
    ? clipBank.filter(c => !removedClipIds.has(c.id))
    : clipBank

  return (
    <div className="dist-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="clip-picker-title">
      <div className="dist-modal-card dist-clip-picker-card" onClick={(e) => e.stopPropagation()}>
        <div className="dist-modal-head">
          <div>
            <h3 className="dist-modal-title" id="clip-picker-title">Pick a clip</h3>
            <p className="dist-modal-sub">
              <Film size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
              {visibleClips.length} clip{visibleClips.length !== 1 ? 's' : ''} in your bank — pick one to publish.
            </p>
          </div>
          <button
            className="dist-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Clip list */}
        <div className="dist-clip-picker-list">
          {visibleClips.length === 0 ? (
            <div className="dist-clip-picker-empty">
              <Film size={26} />
              <p className="empty-title">No clips queued yet</p>
              <p className="empty-sub">Browse trending or upload your own to start filling the queue.</p>
              <button
                className="dist-cyan-btn"
                onClick={() => {
                  onClose()
                  router.push('/dashboard')
                }}
              >
                <Layers size={12} /> Browse
              </button>
            </div>
          ) : (
            visibleClips.map((clip) => (
              <button
                key={clip.id}
                className={`dist-clip-picker-item ${selectedClipId === clip.id ? 'selected' : ''}`}
                onClick={() => {
                  onSelectClip(clip.id)
                  onClose()
                }}
              >
                <div className="dist-clip-picker-thumb">
                  {clip.thumbnailUrl && !brokenThumbs.has(clip.id) ? (
                    <Image
                      src={clip.thumbnailUrl}
                      alt=""
                      width={56}
                      height={76}
                      className="w-full h-full object-cover"
                      onError={() => onBrokenThumb(clip.id)}
                    />
                  ) : (
                    <div className="fill" />
                  )}
                  {(clip.score ?? 0) >= 80 && (
                    <span className="thumb-score-badge">
                      <Flame size={9} /> {clip.score}
                    </span>
                  )}
                </div>
                <div className="dist-clip-picker-info">
                  <div className="title">{clip.title || 'Untitled clip'}</div>
                  <div className="meta">
                    <span>Score{' · '}<strong>{clip.score ?? '—'}</strong></span>
                    {clip.status === 'scheduled' && (
                      <>
                        <span className="dot">·</span>
                        <span className="scheduled-tag">Scheduled</span>
                      </>
                    )}
                  </div>
                </div>
                {selectedClipId === clip.id && (
                  <span className="dist-clip-picker-check">
                    <Check size={12} />
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
