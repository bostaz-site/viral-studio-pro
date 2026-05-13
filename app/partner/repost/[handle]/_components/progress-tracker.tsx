'use client'

import { Check } from 'lucide-react'

interface ProgressTrackerProps {
  downloaded: boolean
  captionCopied: boolean
  submitted: boolean
}

const STEPS = [
  { key: 'downloaded', label: 'Download' },
  { key: 'captionCopied', label: 'Copy Caption' },
  { key: 'submitted', label: 'Submit Post' },
] as const

export function ProgressTracker({ downloaded, captionCopied, submitted }: ProgressTrackerProps) {
  const states = { downloaded, captionCopied, submitted }

  return (
    <div className="flex items-center justify-between gap-2">
      {STEPS.map((step, i) => {
        const done = states[step.key]
        return (
          <div key={step.key} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              done ? 'bg-amber-500 text-amber-950' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
            }`}>
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs ${done ? 'text-amber-400 font-medium' : 'text-zinc-500'}`}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${done ? 'bg-amber-500/50' : 'bg-zinc-800'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
