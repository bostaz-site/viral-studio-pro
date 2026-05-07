'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface InsightBarData {
  label: string
  multiplier: number
  postCount: number
  platform: string
}

interface InsightBarChartProps {
  data: InsightBarData[]
  title?: string
}

function getBarColor(multiplier: number): string {
  if (multiplier >= 2) return '#F97316'
  if (multiplier >= 1.3) return '#38BDF8'
  if (multiplier >= 1.0) return 'rgba(56,189,248,0.5)'
  return '#71717A'
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: InsightBarData }> }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: 'rgba(15,15,25,0.95)',
      border: '1px solid rgba(56,189,248,0.3)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <span style={{ color: '#E2E8F0' }}>
        {d.platform} {d.label}: <strong style={{ color: '#38BDF8' }}>{d.multiplier}x</strong> ({d.postCount} posts)
      </span>
    </div>
  )
}

export function InsightBarChart({ data, title }: InsightBarChartProps) {
  const height = data.length * 40 + 60

  return (
    <div style={{ width: '100%', height }}>
      {title && (
        <p style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginBottom: 8 }}>
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={data.length * 40 + 10}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          barCategoryGap="20%"
        >
          <XAxis
            type="number"
            domain={[0, Math.max(3, ...data.map(d => d.multiplier + 0.3))]}
            tick={{ fontSize: 10, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(56,189,248,0.05)' }} />
          <Bar dataKey="multiplier" radius={[0, 4, 4, 0]} animationDuration={800}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={getBarColor(entry.multiplier)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
