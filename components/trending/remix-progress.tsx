"use client"

import { useEffect, useState } from 'react'
import { Download, FileAudio, Brain, Scissors, CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type RemixStep = 'download' | 'transcribe' | 'analyze' | 'clips' | 'done' | 'error'

interface RemixProgressProps {
  active: boolean
  clipTitle: string
  onClose: () => void
  error?: string | null
}

const STEPS: { id: RemixStep; label: string; icon: typeof Download }[] = [
  { id: 'download',   label: 'Downloading video',       icon: Download },
  { id: 'transcribe', label: 'Transcribing audio',      icon: FileAudio },
  { id: 'analyze',    label: 'AI analysis (4 skills)',  icon: Brain },
  { id: 'clips',      label: 'Generating clips',        icon: Scissors },
  { id: 'done',       label: 'Ready!',                  icon: CheckCircle2 },
]

// Simulated progress — in production this would poll the video status
const STEP_DURATIONS = [3000, 5000, 8000, 4000]

export function RemixProgress({ active, clipTitle, onClose, error }: RemixProgressProps) {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (!active || error) return

    let stepIndex = 0
    let currentTimeout: ReturnType<typeof setTimeout> | null = null
    setCurrentStep(0)

    function advance() {
      if (stepIndex < STEP_DURATIONS.length) {
        currentTimeout = setTimeout(() => {
          stepIndex++
          setCurrentStep(stepIndex)
          advance()
        }, STEP_DURATIONS[stepIndex])
      }
    }

    advance()

    return () => {
      if (currentTimeout) clearTimeout(currentTimeout)
    }
  }, [active, error])

  if (!active) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <Card className="bg-card border-border shadow-2xl">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-sm font-semibold text-foreground truncate">
                Creating remix
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {clipTitle}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {error ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {STEPS.map((step, index) => {
                const isActive = index === currentStep
                const isDone = index < currentStep
                const isPending = index > currentStep
                const StepIcon = step.icon

                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300',
                      isActive && 'bg-primary/10 border border-primary/20',
                      isDone && 'opacity-60',
                      isPending && 'opacity-30'
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                    ) : (
                      <StepIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={cn(
                      'text-xs font-medium',
                      isActive && 'text-foreground',
                      isDone && 'text-muted-foreground line-through',
                      isPending && 'text-muted-foreground'
                    )}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Progress bar */}
          {!error && (
            <div className="mt-3 h-1 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(100, (currentStep / (STEPS.length - 1)) * 100)}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
