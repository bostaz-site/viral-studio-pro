'use client'

import { useState } from 'react'
import { Copy, Check, Shield } from 'lucide-react'
import { trackEvent } from '@/lib/partner/repost-kit/tracker'

interface CaptionCardProps {
  caption: string
  hashtags: string
  handle: string
  onCaptionCopied: () => void
}

export function CaptionCard({ caption, hashtags, handle, onCaptionCopied }: CaptionCardProps) {
  const [captionCopied, setCaptionCopied] = useState(false)
  const [hashtagsCopied, setHashtagsCopied] = useState(false)

  const fullCaption = `${caption}\n\nUse code VIRAL-${handle.toUpperCase()} for a free trial!\n#ad #sponsored`

  const handleCopyCaption = async () => {
    await navigator.clipboard.writeText(fullCaption)
    setCaptionCopied(true)
    trackEvent('caption_copied')
    onCaptionCopied()
    setTimeout(() => setCaptionCopied(false), 2000)
  }

  const handleCopyHashtags = async () => {
    await navigator.clipboard.writeText(hashtags)
    setHashtagsCopied(true)
    trackEvent('hashtags_copied')
    setTimeout(() => setHashtagsCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Caption */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-200">Caption</span>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400">
            <Shield className="h-3 w-3" />
            FTC compliant
          </div>
        </div>

        <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
          {fullCaption}
        </p>

        <button
          onClick={handleCopyCaption}
          className="w-full rounded-lg bg-zinc-700 text-zinc-200 py-2.5 text-sm font-medium hover:bg-zinc-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {captionCopied ? <><Check className="h-4 w-4 text-emerald-400" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Caption</>}
        </button>
      </div>

      {/* Hashtags */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
        <span className="text-sm font-semibold text-zinc-200">Hashtags</span>
        <p className="text-sm text-cyan-400 bg-zinc-900/50 rounded-lg p-3 border border-zinc-800 break-all">
          {hashtags}
        </p>
        <button
          onClick={handleCopyHashtags}
          className="w-full rounded-lg bg-zinc-700 text-zinc-200 py-2.5 text-sm font-medium hover:bg-zinc-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {hashtagsCopied ? <><Check className="h-4 w-4 text-emerald-400" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Hashtags</>}
        </button>
      </div>
    </div>
  )
}
