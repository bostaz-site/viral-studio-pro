'use client'

function getColor(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-amber-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function getBgColor(score: number): string {
  if (score >= 80) return 'bg-green-400/20'
  if (score >= 60) return 'bg-amber-400/20'
  if (score >= 40) return 'bg-orange-400/20'
  return 'bg-red-400/20'
}

export function ReputationGauge({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' }) {
  const s = score ?? 0
  const color = getColor(s)
  const bgColor = getBgColor(s)
  const dims = size === 'sm' ? 'w-8 h-8 text-[10px]' : 'w-10 h-10 text-xs'

  return (
    <div className={`${dims} rounded-full ${bgColor} flex items-center justify-center`}>
      <span className={`font-bold ${color}`}>{s}</span>
    </div>
  )
}
