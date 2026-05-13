'use client'

import { Users } from 'lucide-react'

interface SocialProofProps {
  repostCount: number
  topEarner: number // cents
}

export function SocialProof({ repostCount, topEarner }: SocialProofProps) {
  if (repostCount <= 0) return null

  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 border border-zinc-700 px-3 py-2">
      <Users className="h-4 w-4 text-cyan-400 shrink-0" />
      <p className="text-xs text-zinc-400">
        <span className="text-zinc-200 font-medium">{repostCount} creators</span> posted this video.
        {topEarner > 0 && (
          <> Top earner: <span className="text-amber-400 font-medium">${Math.round(topEarner / 100).toLocaleString()}/mo</span></>
        )}
      </p>
    </div>
  )
}
