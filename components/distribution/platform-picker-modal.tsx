'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Check, Send } from 'lucide-react'
import type { PublishTarget } from '@/stores/distribution-store'
import { usePlatformAccess } from '@/lib/hooks/use-platform-access'
import { formatPlatformList } from '@/lib/distribution/format-platforms'
import type { Platform } from '@/lib/distribution/launch-platforms'

interface PlatformConfig {
  id: string
  label: string
  icon: string
  gradient: string
}

interface SelectedClip {
  id: string
  title: string | null
  score: number | null
  thumbnailUrl: string | null
}

interface PlatformPickerModalProps {
  platforms: PlatformConfig[]
  connectedPlatforms: string[]
  publishTargets: PublishTarget[]
  togglePublishTarget: (platform: string) => void
  selectedClip: SelectedClip | null
  activePlatformCount: number
  publishSequenceActive: boolean
  onClose: () => void
  onPublish: () => Promise<void>
}

export function PlatformPickerModal({
  platforms,
  connectedPlatforms,
  publishTargets,
  togglePublishTarget,
  selectedClip,
  activePlatformCount,
  publishSequenceActive,
  onClose,
  onPublish,
}: PlatformPickerModalProps) {
  const router = useRouter()
  const { isComingSoon } = usePlatformAccess()

  // Build display list of selected platform names for the button
  const selectedNames = publishTargets
    .filter(t => t.enabled && connectedPlatforms.includes(t.platform))
    .map(t => t.platform)

  return (
    <div className="dist-modal-overlay" onClick={() => !publishSequenceActive && onClose()} role="dialog" aria-modal="true" aria-labelledby="platform-picker-title">
      <div className="dist-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="dist-modal-head">
          <div>
            <h3 className="dist-modal-title" id="platform-picker-title">Where to post?</h3>
            <p className="dist-modal-sub">Pick the platforms for this clip.</p>
          </div>
          <button
            className="dist-modal-close"
            onClick={onClose}
            disabled={publishSequenceActive}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Clip preview at top */}
        {selectedClip && (
          <div className="dist-modal-clip">
            <div className="dist-modal-thumb">
              {selectedClip.thumbnailUrl ? (
                <Image src={selectedClip.thumbnailUrl} alt="" width={44} height={60} className="w-full h-full object-cover" />
              ) : (
                <div className="fill" />
              )}
            </div>
            <div className="dist-modal-clip-info">
              <div className="title">{selectedClip.title || 'Untitled clip'}</div>
              <div className="meta">Score{' · '}<strong>{selectedClip.score ?? '—'}</strong></div>
            </div>
          </div>
        )}

        {/* Platform list */}
        <div className="dist-modal-platforms">
          {platforms.filter(p => ['tiktok', 'youtube', 'instagram', 'facebook'].includes(p.id)).map((p) => {
            const isConn = connectedPlatforms.includes(p.id)
            const isSoon = isComingSoon(p.id as Platform)
            const isEnabled = publishTargets.find(t => t.platform === p.id)?.enabled ?? false

            if (isSoon) {
              return (
                <div key={p.id} className="dist-modal-platform soon">
                  <div className="plat-icon">{p.icon}</div>
                  <div className="plat-info">
                    <div className="plat-name">{p.label}</div>
                    <div className="plat-status">Coming soon</div>
                  </div>
                </div>
              )
            }
            if (!isConn) {
              return (
                <div key={p.id} className="dist-modal-platform disconnected">
                  <div className="plat-icon">{p.icon}</div>
                  <div className="plat-info">
                    <div className="plat-name">{p.label}</div>
                    <div className="plat-status">Not connected</div>
                  </div>
                  <button
                    className="dist-ghost-btn"
                    onClick={() => router.push('/settings')}
                  >
                    Connect
                  </button>
                </div>
              )
            }
            return (
              <button
                key={p.id}
                className={`dist-modal-platform ${isEnabled ? 'enabled' : ''}`}
                onClick={() => togglePublishTarget(p.id)}
                disabled={publishSequenceActive}
              >
                <div className="plat-icon">{p.icon}</div>
                <div className="plat-info">
                  <div className="plat-name">{p.label}</div>
                  <div className="plat-status">
                    {isEnabled ? 'Selected' : 'Tap to select'}
                  </div>
                </div>
                <span className={`plat-checkbox ${isEnabled ? 'checked' : ''}`}>
                  {isEnabled && <Check size={12} />}
                </span>
              </button>
            )
          })}
        </div>

        {/* Modal actions */}
        <div className="dist-modal-actions">
          <button
            className="dist-ghost-btn"
            onClick={onClose}
            disabled={publishSequenceActive}
          >
            Cancel
          </button>
          <button
            className="dist-cyan-btn primary"
            onClick={async () => {
              onClose()
              await onPublish()
            }}
            disabled={activePlatformCount === 0 || publishSequenceActive}
          >
            <Send size={13} />
            {activePlatformCount === 0
              ? 'Pick at least one platform'
              : `Post to ${formatPlatformList(selectedNames)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
