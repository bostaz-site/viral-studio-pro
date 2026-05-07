'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, CartesianGrid } from 'recharts'

interface ProgressionData {
  date: string
  score: number
  followers?: number
}

interface ProgressionLineChartProps {
  data: ProgressionData[]
  metric: 'score' | 'followers'
}

function formatDate(date: string): string {
  const d = new Date(date)
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.[0]) return null
  return (
    <div style={{
      background: 'rgba(15,15,25,0.95)',
      border: '1px solid rgba(56,189,248,0.3)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <span style={{ color: '#94A3B8' }}>{label}: </span>
      <strong style={{ color: '#38BDF8' }}>{payload[0].value}</strong>
    </div>
  )
}

export function ProgressionLineChart({ data, metric }: ProgressionLineChartProps) {
  const dataKey = metric === 'score' ? 'score' : 'followers'
  const domain: [number, number] = metric === 'score' ? [0, 100] : [0, Math.max(...data.map(d => d[dataKey] ?? 0)) * 1.1]
  const formatted = data.map(d => ({ ...d, dateLabel: formatDate(d.date) }))

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(63,63,70,0.3)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 10, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="#38BDF8"
            strokeWidth={2}
            fill={`url(#gradient-${metric})`}
            animationDuration={1000}
            dot={false}
            activeDot={{
              r: 5,
              fill: '#F97316',
              stroke: '#F97316',
              strokeWidth: 2,
              style: { filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.6))' },
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
