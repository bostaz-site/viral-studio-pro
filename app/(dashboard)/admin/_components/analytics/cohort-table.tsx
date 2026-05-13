'use client'

interface CohortRow {
  cohort: string
  total: number
  active_m1: number
  active_m2: number
  active_m3: number
  active_m6: number
}

function retentionPct(active: number, total: number): string {
  if (!total) return '-'
  return `${Math.round((active / total) * 100)}%`
}

function retentionColor(active: number, total: number): string {
  if (!total) return 'text-zinc-600'
  const pct = (active / total) * 100
  if (pct >= 60) return 'text-green-400 bg-green-500/10'
  if (pct >= 30) return 'text-amber-400 bg-amber-500/10'
  if (pct > 0) return 'text-red-400 bg-red-500/10'
  return 'text-zinc-600'
}

export function CohortTable({ data }: { data: CohortRow[] }) {
  if (!data.length) return <p className="text-sm text-zinc-500">No cohort data</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
            <th className="text-left px-3 py-2">Cohort</th>
            <th className="text-right px-3 py-2">Total</th>
            <th className="text-right px-3 py-2">M+1</th>
            <th className="text-right px-3 py-2">M+2</th>
            <th className="text-right px-3 py-2">M+3</th>
            <th className="text-right px-3 py-2">M+6</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.cohort} className="border-b border-zinc-800/50">
              <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{row.cohort}</td>
              <td className="px-3 py-2 text-right font-mono text-zinc-300">{row.total}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs rounded ${retentionColor(row.active_m1, row.total)}`}>
                {retentionPct(row.active_m1, row.total)}
              </td>
              <td className={`px-3 py-2 text-right font-mono text-xs rounded ${retentionColor(row.active_m2, row.total)}`}>
                {retentionPct(row.active_m2, row.total)}
              </td>
              <td className={`px-3 py-2 text-right font-mono text-xs rounded ${retentionColor(row.active_m3, row.total)}`}>
                {retentionPct(row.active_m3, row.total)}
              </td>
              <td className={`px-3 py-2 text-right font-mono text-xs rounded ${retentionColor(row.active_m6, row.total)}`}>
                {retentionPct(row.active_m6, row.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
