'use client'

interface CampaignPerf {
  id: string
  name: string
  status: string
  total_sent: number
  total_opened: number
  total_replied: number
  total_bounced: number
  total_converted: number
  open_rate: number
  reply_rate: number
  bounce_rate: number
  conversion_rate: number
}

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500/15 text-green-400',
  completed: 'bg-blue-500/15 text-blue-400',
  paused: 'bg-amber-500/15 text-amber-400',
  draft: 'bg-zinc-500/15 text-zinc-400',
}

export function CampaignTable({ data }: { data: CampaignPerf[] }) {
  if (!data.length) return <p className="text-sm text-zinc-500">No campaigns yet</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
            <th className="text-left px-3 py-2">Campaign</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-right px-3 py-2">Sent</th>
            <th className="text-right px-3 py-2">Open %</th>
            <th className="text-right px-3 py-2">Reply %</th>
            <th className="text-right px-3 py-2">Bounce %</th>
            <th className="text-right px-3 py-2">Conv %</th>
          </tr>
        </thead>
        <tbody>
          {data.map(c => (
            <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-zinc-200 font-medium truncate max-w-[200px]">{c.name}</td>
              <td className="px-3 py-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[c.status] || 'bg-zinc-700 text-zinc-400'}`}>
                  {c.status}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-zinc-300">{c.total_sent.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-mono text-zinc-300">{c.open_rate}%</td>
              <td className="px-3 py-2 text-right font-mono text-green-400">{c.reply_rate}%</td>
              <td className="px-3 py-2 text-right font-mono text-red-400">{c.bounce_rate}%</td>
              <td className="px-3 py-2 text-right font-mono text-amber-400">{c.conversion_rate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
