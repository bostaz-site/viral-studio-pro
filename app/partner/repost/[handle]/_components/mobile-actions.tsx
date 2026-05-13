'use client'

import { trackEvent } from '@/lib/partner/repost-kit/tracker'

const PLATFORMS = [
  { name: 'TikTok', url: 'https://www.tiktok.com/upload', color: 'bg-zinc-800 border-zinc-700 text-zinc-200' },
  { name: 'Instagram', url: 'https://www.instagram.com/', color: 'bg-zinc-800 border-zinc-700 text-zinc-200' },
  { name: 'YouTube', url: 'https://studio.youtube.com/channel/UC/videos/upload', color: 'bg-zinc-800 border-zinc-700 text-zinc-200' },
]

export function MobileActions() {
  const handleOpen = (platform: string, url: string) => {
    trackEvent('platform_opened', { platform })
    window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-zinc-200">Post It</span>
      <div className="grid grid-cols-3 gap-2">
        {PLATFORMS.map(p => (
          <button
            key={p.name}
            onClick={() => handleOpen(p.name, p.url)}
            className={`rounded-lg border py-3 text-sm font-medium hover:bg-zinc-700 active:scale-95 transition-all ${p.color}`}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  )
}
