'use client'

import { useState } from 'react'
import { Copy, Check, QrCode } from 'lucide-react'

interface CodeCardProps {
  affiliateCode: string | null
}

const APP_URL = 'https://viralanimal.com'

export function CodeCard({ affiliateCode }: CodeCardProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  if (!affiliateCode) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
        <p className="text-sm text-zinc-400">No affiliate code assigned yet. Contact support.</p>
      </div>
    )
  }

  const link = `${APP_URL}/r/${affiliateCode}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}&bgcolor=18181b&color=f59e0b&format=png`

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">Your Affiliate Link</h3>

      <div className="flex gap-6">
        {/* Code + Link */}
        <div className="flex-1 space-y-3">
          {/* Code */}
          <div>
            <label className="text-[10px] uppercase text-zinc-500 font-medium">Code</label>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-lg font-bold text-amber-400">{affiliateCode.toUpperCase()}</span>
              <button
                onClick={() => copyToClipboard(affiliateCode, 'code')}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {copied === 'code' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="text-[10px] uppercase text-zinc-500 font-medium">Link</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs text-zinc-300 bg-zinc-800 px-3 py-1.5 rounded flex-1 truncate">
                {link}
              </code>
              <button
                onClick={() => copyToClipboard(link, 'link')}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
              >
                {copied === 'link' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <p className="text-[10px] text-zinc-600">
            Share this link anywhere — TikTok bio, stream, tweets, etc. Clicks are tracked for 60 days.
          </p>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className="bg-zinc-800 rounded-lg p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR Code" width={120} height={120} className="rounded" />
          </div>
          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
            <QrCode className="h-3 w-3" /> Scan to visit
          </span>
        </div>
      </div>
    </div>
  )
}
