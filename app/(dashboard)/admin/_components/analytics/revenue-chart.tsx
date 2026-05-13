'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface PlanBreakdown {
  plan: string
  count: number
  mrr: number
}

export function RevenueChart({ data }: { data: PlanBreakdown[] }) {
  const chartData = data.filter(d => d.mrr > 0).map(d => ({
    plan: d.plan.charAt(0).toUpperCase() + d.plan.slice(1),
    mrr: d.mrr / 100,
    count: d.count,
  }))

  if (!chartData.length) return <p className="text-sm text-zinc-500">No revenue data</p>

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="plan" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }}
            formatter={(value) => [`$${Number(value).toFixed(2)}`, 'MRR']}
          />
          <Bar dataKey="mrr" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
