'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  JUSTIFICATIONS,
  COLOR_DISPLAY_NAMES,
  CAPTION_DISPLAY_NAMES,
  EFFECT_DISPLAY_NAMES,
  generateDynamicData,
  getConfidenceLabel,
  type AnalysisDynamicData,
} from '@/lib/enhance/analysis-copy'
import type { ClipMood } from '@/lib/ai/mood-presets'
import { EMPHASIS_COLORS } from '@/lib/enhance/scoring'

// ── Types ──────────────────────────────────────────────────────────────────

interface AnalysisStep {
  label: string
  sub: string
  reveal?: string
  color: string
  duration: number // ms to show before moving to next
  isWow?: boolean
}

interface AIAnalysisSequenceProps {
  clipId: string
  clipDuration: number | null | undefined
  detectedMood: ClipMood | null
  confidence: number
  captionStyle: string
  emphasisEffect: string
  emphasisColor: string
  hookText: string | null
  isActive: boolean
  onComplete: () => void
}

// ── Typing Effect Hook ─────────────────────────────────────────────────────

function useTypingEffect(text: string, active: boolean, speed = 35): string {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!active || !text) {
      setDisplayed('')
      return
    }
    setDisplayed('')
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(interval)
    }, speed)
    return () => clearInterval(interval)
  }, [text, active, speed])

  return displayed
}

// ── Component ──────────────────────────────────────────────────────────────

export function AIAnalysisSequence({
  clipId,
  clipDuration,
  detectedMood,
  confidence,
  captionStyle,
  emphasisEffect,
  emphasisColor,
  hookText,
  isActive,
  onComplete,
}: AIAnalysisSequenceProps) {
  const [currentStep, setCurrentStep] = useState(-1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [showResult, setShowResult] = useState(false)
  const [scoreCount, setScoreCount] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const completedRef = useRef(false)

  // Generate fake but consistent dynamic data
  const dynamicData = useMemo(
    () => generateDynamicData(clipId, clipDuration),
    [clipId, clipDuration]
  )

  // Get justifications for detected mood
  const mood = detectedMood ?? 'hype'
  const justif = JUSTIFICATIONS[mood]

  // Color hex for display
  const colorHex = EMPHASIS_COLORS.find((c) => c.id === emphasisColor)?.hex ?? '#FFFFFF'

  // Build steps dynamically
  const steps: AnalysisStep[] = useMemo(() => [
    {
      label: 'Scanning audio waveform...',
      sub: `${dynamicData.audioDuration}s of audio · ${dynamicData.peaksDetected} volume peaks detected`,
      color: '#3B82F6',
      duration: 500,
    },
    {
      label: 'Detecting emotional peaks...',
      sub: `Key moment identified at ${dynamicData.keyMomentTimestamp}`,
      color: '#8B5CF6',
      duration: 700,
    },
    {
      label: 'Optimizing caption style...',
      sub: `${dynamicData.highEnergySegments} high-energy segments found`,
      reveal: `${CAPTION_DISPLAY_NAMES[captionStyle] ?? captionStyle} — ${justif.captionStyle}`,
      color: '#EC4899',
      duration: 800,
    },
    {
      label: 'Selecting emphasis & color...',
      reveal: `${EFFECT_DISPLAY_NAMES[emphasisEffect] ?? emphasisEffect} · ${COLOR_DISPLAY_NAMES[emphasisColor] ?? emphasisColor} — ${justif.emphasisColor}`,
      sub: justif.emphasisEffect,
      color: '#F97316',
      duration: 700,
    },
    {
      label: 'Crafting viral hook...',
      sub: justif.hook,
      color: '#EAB308',
      duration: 1000,
      isWow: true,
    },
    {
      label: 'Finalizing parameters...',
      sub: `${dynamicData.peaksDetected + dynamicData.highEnergySegments} data points analyzed`,
      color: '#22C55E',
      duration: 500,
    },
  ], [dynamicData, captionStyle, emphasisEffect, emphasisColor, justif])

  // Typing effect for hook text (step 5)
  const isHookStep = currentStep === 4 && !completedSteps.includes(4)
  const typedHook = useTypingEffect(hookText ?? '', isHookStep, 30)

  // Step progression
  useEffect(() => {
    if (!isActive) {
      setCurrentStep(-1)
      setCompletedSteps([])
      setShowResult(false)
      setScoreCount(0)
      completedRef.current = false
      return
    }

    if (currentStep === -1) {
      setCurrentStep(0)
      return
    }

    if (currentStep >= steps.length) {
      if (!completedRef.current) {
        completedRef.current = true
        // Show result card
        setShowResult(true)
        // Count-up animation for score
        const target = confidence > 0 ? confidence : 85
        let count = 0
        const scoreInterval = setInterval(() => {
          count += 3
          if (count >= target) {
            count = target
            clearInterval(scoreInterval)
          }
          setScoreCount(count)
        }, 20)
        // Signal completion after result reveal
        setTimeout(() => {
          onComplete()
        }, 800)
      }
      return
    }

    const step = steps[currentStep]
    timerRef.current = setTimeout(() => {
      setCompletedSteps((prev) => [...prev, currentStep])
      setCurrentStep((prev) => prev + 1)
    }, step.duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isActive, currentStep, steps, confidence, onComplete])

  if (!isActive) return null

  const confidenceLabel = getConfidenceLabel(confidence > 0 ? confidence : 85)

  return (
    <div className="space-y-2">
      <AnimatePresence mode="sync">
        {steps.map((step, i) => {
          if (i > currentStep) return null
          const isCompleted = completedSteps.includes(i)
          const isCurrent = i === currentStep && !isCompleted

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex items-start gap-2.5"
            >
              {/* Step indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300',
                  isCompleted ? 'bg-emerald-500/90' : ''
                )}
                style={!isCompleted ? { background: step.color } : undefined}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                ) : (
                  <span className="text-[9px] font-bold text-white">{i + 1}</span>
                )}
              </div>

              {/* Step content */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span
                  className={cn(
                    'text-[13px] font-medium transition-colors duration-300',
                    isCompleted ? 'text-zinc-500' : 'text-zinc-200'
                  )}
                >
                  {step.label}
                </span>

                {/* Sub text */}
                <span className="text-[10px] text-zinc-600">{step.sub}</span>

                {/* Reveal — parameter chosen */}
                {step.reveal && isCompleted && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-[11px] text-purple-400 font-medium mt-0.5"
                  >
                    {/* Show color dot for emphasis step */}
                    {i === 3 && (
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                        style={{ background: colorHex }}
                      />
                    )}
                    {step.reveal}
                  </motion.span>
                )}

                {/* Wow moment — Viral pattern detected */}
                {step.isWow && isCurrent && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex items-center gap-1 mt-1"
                  >
                    <span className="text-[11px] font-bold text-yellow-400 animate-pulse">
                      <Zap className="h-3 w-3 inline mr-0.5" />
                      Viral pattern detected
                    </span>
                  </motion.div>
                )}

                {/* Wow moment stays after completion too */}
                {step.isWow && isCompleted && (
                  <span className="text-[11px] font-bold text-yellow-400/70 flex items-center gap-0.5 mt-0.5">
                    <Zap className="h-3 w-3" />
                    Viral pattern detected
                  </span>
                )}

                {/* Typing hook text */}
                {step.isWow && (isCurrent || isCompleted) && hookText && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] text-amber-300/80 font-medium italic mt-0.5"
                  >
                    &quot;{isCompleted ? hookText : typedHook}&quot;
                  </motion.span>
                )}

                {/* Loading indicator for current step */}
                {isCurrent && !step.isWow && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: step.duration / 1000, ease: 'linear' }}
                    className="h-[2px] rounded-full mt-1"
                    style={{ background: step.color, opacity: 0.4, maxWidth: 120 }}
                  />
                )}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Result Card */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mt-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span className="text-[13px] font-bold text-emerald-400">AI analysis complete</span>
            </div>
            <p className="text-[11px] text-zinc-400 mb-2">
              Optimized for peak algorithm performance · Confidence: {confidenceLabel}
            </p>
            <div className="flex flex-col gap-1 text-[10px] text-zinc-500">
              <span><span className="text-emerald-500">✔</span> Hook tuned for retention</span>
              <span><span className="text-emerald-500">✔</span> Captions matched to energy</span>
              <span><span className="text-emerald-500">✔</span> Effects aligned with peak moments</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
