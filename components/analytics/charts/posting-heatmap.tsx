'use client'

import { useState } from 'react'

interface HeatmapCell {
  hour: number    // 0-23
  weekday: number // 0=Mon, 6=Sun
  multiplier: number
  postCount: number
}

interface PostingHeatmapProps {
  data: HeatmapCell[]
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOUR_BUCKETS = ['0-3', '3-6', '6-9', '9-12', '12-15', '15-18', '18-21', '21-24']

function getCellColor(multiplier: number | null): string {
  if (multiplier === null) return 'rgba(24,24,35,0.3)'
  if (multiplier >= 2) return '#F97316'
  if (multiplier >= 1.3) return '#38BDF8'
  if (multiplier >= 1.0) return 'rgba(56,189,248,0.4)'
  return 'rgba(239,68,68,0.35)'
}

function getCellGlow(multiplier: number | null): string {
  if (multiplier === null) return 'none'
  if (multiplier >= 2) return '0 0 8px rgba(249,115,22,0.5)'
  if (multiplier >= 1.3) return '0 0 6px rgba(56,189,248,0.3)'
  return 'none'
}

function getHourBucket(hour: number): number {
  return Math.floor(hour / 3)
}

export function PostingHeatmap({ data }: PostingHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ day: number; bucket: number } | null>(null)

  // Build grid: [bucket][weekday] → { multiplier, postCount } | null
  const grid: Array<Array<{ multiplier: number; postCount: number } | null>> = Array.from(
    { length: 8 },
    () => Array.from({ length: 7 }, () => null)
  )

  for (const cell of data) {
    const bucket = getHourBucket(cell.hour)
    const day = cell.weekday
    if (bucket >= 0 && bucket < 8 && day >= 0 && day < 7) {
      const existing = grid[bucket][day]
      if (!existing || cell.postCount > existing.postCount) {
        grid[bucket][day] = { multiplier: cell.multiplier, postCount: cell.postCount }
      }
    }
  }

  const tooltip = hoveredCell
    ? grid[hoveredCell.bucket]?.[hoveredCell.day]
    : null

  return (
    <div style={{ position: 'relative' }}>
      {/* Header row — day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
        <div />
        {DAYS.map(d => (
          <div key={d} style={{ fontSize: 9, color: '#64748B', textAlign: 'center', fontWeight: 500 }}>{d}</div>
        ))}
      </div>

      {/* Grid rows */}
      {HOUR_BUCKETS.map((bucketLabel, bucketIdx) => (
        <div key={bucketIdx} style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
          <div style={{ fontSize: 9, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
            {bucketLabel}
          </div>
          {Array.from({ length: 7 }).map((_, dayIdx) => {
            const cell = grid[bucketIdx][dayIdx]
            const isHovered = hoveredCell?.bucket === bucketIdx && hoveredCell?.day === dayIdx
            return (
              <div
                key={dayIdx}
                onMouseEnter={() => setHoveredCell({ bucket: bucketIdx, day: dayIdx })}
                onMouseLeave={() => setHoveredCell(null)}
                style={{
                  height: 24,
                  borderRadius: 4,
                  background: getCellColor(cell?.multiplier ?? null),
                  boxShadow: getCellGlow(cell?.multiplier ?? null),
                  border: isHovered ? '1px solid rgba(56,189,248,0.6)' : '1px solid transparent',
                  transition: 'border 0.15s, transform 0.15s',
                  transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                  cursor: cell ? 'default' : 'default',
                }}
              />
            )
          })}
        </div>
      ))}

      {/* Tooltip */}
      {hoveredCell && tooltip && (
        <div style={{
          position: 'absolute',
          top: -36,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15,15,25,0.95)',
          border: '1px solid rgba(56,189,248,0.3)',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 11,
          color: '#E2E8F0',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          {DAYS[hoveredCell.day]} {HOUR_BUCKETS[hoveredCell.bucket]}h:{' '}
          <strong style={{ color: '#38BDF8' }}>{tooltip.multiplier}x</strong> ({tooltip.postCount} posts)
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center', justifyContent: 'center' }}>
        {[
          { color: 'rgba(24,24,35,0.3)', label: 'No data' },
          { color: 'rgba(239,68,68,0.35)', label: '<1x' },
          { color: 'rgba(56,189,248,0.4)', label: '1-1.3x' },
          { color: '#38BDF8', label: '1.3-2x' },
          { color: '#F97316', label: '2x+' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
            <span style={{ fontSize: 9, color: '#64748B' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
