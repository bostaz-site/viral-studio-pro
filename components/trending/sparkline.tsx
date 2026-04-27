// TODO: Wire this component into components/trending/trending-card.tsx (velocity sparkline)
'use client'

import { memo } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
}

export const Sparkline = memo(function Sparkline({
  data,
  width = 50,
  height = 16,
  className,
}: SparklineProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((val - min) / range) * (height - 2) - 1
    return `${x},${y}`
  }).join(' ')

  const trending = data[data.length - 1] > data[0]
  const color = trending ? '#22c55e' : '#ef4444'

  const lastX = width
  const lastY = height - ((data[data.length - 1] - min) / range) * (height - 2) - 1

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  )
})
