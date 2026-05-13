'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface DailyStat {
  stat_date: string
  emails_sent: number | null
  emails_bounced: number | null
  emails_replied: number | null
  reputation_score: number | null
}

interface HealthChartProps {
  data: DailyStat[]
  metric: 'reputation' | 'bounce' | 'volume'
}

export function HealthChart({ data, metric }: HealthChartProps) {
  const sorted = [...data].sort((a, b) => a.stat_date.localeCompare(b.stat_date))

  const chartData = sorted.map(d => ({
    date: new Date(d.stat_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    reputation: d.reputation_score ?? 0,
    bounce: d.emails_sent && d.emails_sent > 0
      ? Number(((d.emails_bounced ?? 0) / d.emails_sent * 100).toFixed(1))
      : 0,
    sent: d.emails_sent ?? 0,
    replied: d.emails_replied ?? 0,
  }))

  const configs: Record<string, { dataKey: string; stroke: string; label: string; domain?: [number, number] }> = {
    reputation: { dataKey: 'reputation', stroke: '#4ade80', label: 'Reputation Score', domain: [0, 100] },
    bounce: { dataKey: 'bounce', stroke: '#f87171', label: 'Bounce Rate %' },
    volume: { dataKey: 'sent', stroke: '#60a5fa', label: 'Emails Sent' },
  }

  const config = configs[metric]

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: '#71717a' }}
            axisLine={false}
            tickLine={false}
            domain={config.domain}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Line
            type="monotone"
            dataKey={config.dataKey}
            stroke={config.stroke}
            strokeWidth={2}
            dot={false}
            name={config.label}
          />
          {metric === 'volume' && (
            <Line
              type="monotone"
              dataKey="replied"
              stroke="#4ade80"
              strokeWidth={1.5}
              dot={false}
              name="Replies"
              strokeDasharray="4 4"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
