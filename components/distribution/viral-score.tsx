'use client'

import { Card, CardContent } from '@/components/ui/card'

interface ViralScoreProps {
  score: number
}

export function ViralScore({ score }: ViralScoreProps) {
  const getColor = () => {
    if (score >= 80) return { ring: 'stroke-green-500', text: 'text-green-400', label: 'Excellent' }
    if (score >= 60) return { ring: 'stroke-blue-500', text: 'text-blue-400', label: 'Good' }
    if (score >= 40) return { ring: 'stroke-amber-500', text: 'text-amber-400', label: 'Growing' }
    return { ring: 'stroke-red-500', text: 'text-red-400', label: 'Getting Started' }
  }

  const { ring, text, label } = getColor()
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (score / 100) * circumference

  return (
    <Card className="border-border">
      <CardContent className="p-6 flex flex-col items-center">
        <p className="text-sm font-semibold text-foreground mb-4">Account Viral Score</p>

        <div className="relative w-28 h-28">
          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-muted/30"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={`${ring} transition-all duration-1000 ease-out`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-black ${text}`}>{score}</span>
            <span className="text-[10px] text-muted-foreground">/100</span>
          </div>
        </div>

        <p className={`text-sm font-medium mt-3 ${text}`}>{label}</p>
        <p className="text-[10px] text-muted-foreground mt-1 text-center max-w-[180px]">
          Based on posting frequency, platform diversity, and total publications
        </p>
      </CardContent>
    </Card>
  )
}
