'use client'

import { useState } from 'react'
import { Copy, Check, DollarSign } from 'lucide-react'
import { trackEvent } from '@/lib/partner/repost-kit/tracker'

interface CodeCopyCardProps {
  code: string
  onCopied: () => void
}

export function CodeCopyCard({ code, onCopied }: CodeCopyCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    trackEvent('code_copied', { code })
    onCopied()
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold text-zinc-200">Your Promo Code</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-3 font-mono text-lg text-amber-400 font-bold text-center tracking-wider">
          {code}
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg bg-amber-500 text-amber-950 px-4 py-3 font-medium text-sm hover:bg-amber-400 active:scale-95 transition-all"
        >
          {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
        </button>
      </div>

      <p className="text-xs text-amber-400/70 text-center">
        30% recurring commission on every signup
      </p>
    </div>
  )
}
