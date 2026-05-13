'use client'

interface FunnelStage {
  stage: string
  count: number
  pct: number
}

const STAGE_LABELS: Record<string, string> = {
  cold: 'Cold', queued: 'Queued', contacted: 'Contacted', opened: 'Opened',
  replied: 'Replied', interested: 'Interested', demo_sent: 'Demo Sent',
  evaluating: 'Evaluating', onboarded: 'Onboarded', active: 'Active', paying: 'Paying',
}

const STAGE_COLORS: Record<string, string> = {
  cold: 'bg-blue-500', queued: 'bg-sky-500', contacted: 'bg-cyan-500', opened: 'bg-teal-500',
  replied: 'bg-green-500', interested: 'bg-emerald-500', demo_sent: 'bg-purple-500',
  evaluating: 'bg-violet-500', onboarded: 'bg-amber-500', active: 'bg-orange-500', paying: 'bg-yellow-400',
}

export function FunnelChart({ data }: { data: FunnelStage[] }) {
  if (!data.length) return <p className="text-sm text-zinc-500">No data</p>

  const maxCount = data[0]?.count || 1

  return (
    <div className="space-y-2">
      {data.map((stage) => (
        <div key={stage.stage} className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 w-20 text-right truncate">
            {STAGE_LABELS[stage.stage] || stage.stage}
          </span>
          <div className="flex-1 h-7 bg-zinc-800/50 rounded-md overflow-hidden relative">
            <div
              className={`h-full ${STAGE_COLORS[stage.stage] || 'bg-zinc-600'} rounded-md transition-all`}
              style={{ width: `${Math.max(2, (stage.count / maxCount) * 100)}%` }}
            />
            <span className="absolute inset-y-0 right-2 flex items-center text-[10px] text-zinc-300 font-mono">
              {stage.count.toLocaleString()} ({stage.pct}%)
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
