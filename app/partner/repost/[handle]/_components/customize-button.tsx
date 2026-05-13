'use client'

import { useState } from 'react'
import { Sparkles, Check } from 'lucide-react'
import { trackEvent } from '@/lib/partner/repost-kit/tracker'

export function CustomizeButton() {
  const [requested, setRequested] = useState(false)

  const handleRequest = () => {
    trackEvent('customization_requested')
    setRequested(true)
  }

  if (requested) {
    return (
      <div className="text-center py-3 text-xs text-emerald-400 flex items-center justify-center gap-1">
        <Check className="h-3.5 w-3.5" />
        Request received! We'll send you a new kit.
      </div>
    )
  }

  return (
    <button
      onClick={handleRequest}
      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-3 text-sm text-zinc-300 hover:bg-zinc-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
    >
      <Sparkles className="h-4 w-4 text-amber-400" />
      Want a different angle?
    </button>
  )
}
