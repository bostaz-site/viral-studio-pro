'use client'

import { useState } from 'react'
import { Search, ArrowRight, Shield } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'

interface MatchEntry { id: string; promo_video_id: string; match_score: number; match_breakdown: Record<string, number>; is_primary: boolean; is_admin_override: boolean }

export function MatchExplorer() {
  const [influencerId, setInfluencerId] = useState('')
  const [matches, setMatches] = useState<MatchEntry[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!influencerId.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/match-engine/compute?influencerId=${influencerId.trim()}`)
      const json = await res.json()
      setMatches(json.data ?? [])
    } catch { setMatches([]) }
    finally { setLoading(false) }
  }

  const handleOverride = async (videoId: string) => {
    await fetch('/api/admin/match-engine/override', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ influencerId: influencerId.trim(), promoVideoId: videoId }),
    })
    handleSearch()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={influencerId} onChange={e => setInfluencerId(e.target.value)} placeholder="Influencer UUID..."
          className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500" />
        <button onClick={handleSearch} disabled={loading}
          className="rounded-lg bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1.5">
          {loading ? <WolfLoader variant="spinner" size={16} mode="amber" /> : <Search className="h-4 w-4" />} Search
        </button>
      </div>

      {matches.length > 0 && (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-zinc-800/50 border-b border-zinc-800 text-zinc-500 text-xs">
              <th className="text-left px-3 py-2">Video</th>
              <th className="text-right px-3 py-2">Score</th>
              <th className="text-right px-3 py-2">Niche</th>
              <th className="text-right px-3 py-2">Aud</th>
              <th className="text-right px-3 py-2">Lang</th>
              <th className="text-right px-3 py-2">Hook</th>
              <th className="text-center px-3 py-2">Status</th>
              <th className="text-center px-3 py-2">Action</th>
            </tr></thead>
            <tbody>
              {matches.map(m => {
                const bd = m.match_breakdown ?? {}
                return (
                  <tr key={m.id} className={`border-b border-zinc-800/50 ${m.is_primary ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">{m.promo_video_id.slice(0, 8)}...</td>
                    <td className={`px-3 py-2 text-right font-bold ${m.match_score >= 70 ? 'text-emerald-400' : m.match_score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{m.match_score}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{bd.niche ?? '-'}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{bd.audience ?? '-'}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{bd.language ?? '-'}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{bd.hook_fit ?? '-'}</td>
                    <td className="px-3 py-2 text-center">
                      {m.is_primary && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">PRIMARY</span>}
                      {m.is_admin_override && <Shield className="h-3.5 w-3.5 text-cyan-400 inline ml-1" />}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {!m.is_primary && (
                        <button onClick={() => handleOverride(m.promo_video_id)} className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 mx-auto">
                          Set Primary <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!matches.length && influencerId && !loading && <p className="text-sm text-zinc-500 text-center py-4">No matches. Run compute first.</p>}
    </div>
  )
}
