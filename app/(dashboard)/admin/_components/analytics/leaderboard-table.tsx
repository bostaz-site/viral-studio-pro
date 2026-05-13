'use client'

interface AffiliateRanking {
  id: string
  name: string
  handle: string
  platform: string | null
  total_conversions: number
  total_revenue_cents: number
  commission_earned_cents: number
  conversion_rate: number
  tier: 'bronze' | 'silver' | 'gold'
}

const TIER_BADGE: Record<string, { emoji: string; className: string }> = {
  gold: { emoji: '🥇', className: 'bg-yellow-500/15 text-yellow-400' },
  silver: { emoji: '🥈', className: 'bg-zinc-400/15 text-zinc-300' },
  bronze: { emoji: '🥉', className: 'bg-amber-700/15 text-amber-500' },
}

function centsToUsd(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

export function LeaderboardTable({ data }: { data: AffiliateRanking[] }) {
  if (!data.length) return <p className="text-sm text-zinc-500">No affiliates yet</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
            <th className="text-left px-3 py-2">#</th>
            <th className="text-left px-3 py-2">Affiliate</th>
            <th className="text-left px-3 py-2">Tier</th>
            <th className="text-right px-3 py-2">Conversions</th>
            <th className="text-right px-3 py-2">Revenue</th>
            <th className="text-right px-3 py-2">Commission</th>
            <th className="text-right px-3 py-2">Conv. Rate</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a, i) => {
            const tier = TIER_BADGE[a.tier]
            return (
              <tr key={a.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-3 py-2 text-zinc-500">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className="text-zinc-200 font-medium">{a.name}</span>
                  <span className="text-zinc-500 ml-1.5 text-xs">@{a.handle}</span>
                  {a.platform && <span className="text-zinc-600 ml-1 text-[10px]">({a.platform})</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${tier.className}`}>
                    {tier.emoji} {a.tier}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-zinc-300">{a.total_conversions}</td>
                <td className="px-3 py-2 text-right font-mono text-zinc-300">{centsToUsd(a.total_revenue_cents)}</td>
                <td className="px-3 py-2 text-right font-mono text-emerald-400">{centsToUsd(a.commission_earned_cents)}</td>
                <td className="px-3 py-2 text-right font-mono text-zinc-400">{a.conversion_rate}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
