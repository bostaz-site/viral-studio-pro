'use client'

import { useEffect, useState, useRef } from 'react'
import { CheckCircle, Loader2, X, Bell, BellOff } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Stage definitions ───────────────────────────────────────────────────────

const STAGES = [
  { id: 'download',  label: 'Downloading',       desc: 'Fetching source clip from CDN' },
  { id: 'captions',  label: 'Applying captions',  desc: 'Karaoke subtitles + emphasis effects' },
  { id: 'composite', label: 'Compositing',         desc: 'Zoom, split-screen & colour grade' },
  { id: 'upload',    label: 'Uploading',           desc: 'Saving to your library' },
] as const

// Approximate elapsed-seconds threshold at which each stage becomes active.
// These are intentionally generous so the simulation stays credible for
// both short clips (20-30s render) and long ones (2-3 min render).
const STAGE_THRESHOLDS = [0, 8, 28, 55]

// ─── Component ───────────────────────────────────────────────────────────────

interface RenderProgressModalProps {
  open: boolean
  queuePosition: number | null
  isDone: boolean
  isError: boolean
  errorMessage?: string | null
  onClose: () => void
}

export function RenderProgressModal({
  open,
  queuePosition,
  isDone,
  isError,
  errorMessage,
  onClose,
}: RenderProgressModalProps) {

  // ── Notification API ────────────────────────────────────────────────────
  const [notifState, setNotifState] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle')
  const [notifSupported, setNotifSupported] = useState(false)
  const notifiedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    setNotifSupported(true)
    if (Notification.permission === 'granted') setNotifState('granted')
    else if (Notification.permission === 'denied') setNotifState('denied')
  }, [])

  const handleNotifRequest = async () => {
    if (notifState !== 'idle') return
    setNotifState('asking')
    try {
      const result = await Notification.requestPermission()
      setNotifState(result === 'granted' ? 'granted' : 'denied')
    } catch {
      setNotifState('denied')
    }
  }

  // Fire notification when render completes (only if tab is hidden)
  useEffect(() => {
    if (!isDone || notifState !== 'granted' || notifiedRef.current) return
    notifiedRef.current = true
    try {
      new Notification('Your clip is ready! 🎬', {
        body: 'Your viral clip has been rendered. Open the page to view it.',
        icon: '/favicon.ico',
      })
    } catch { /* ignore — some browsers block even with permission */ }
  }, [isDone, notifState])

  // Reset notifiedRef when a new render starts
  useEffect(() => {
    if (open && !isDone) notifiedRef.current = false
  }, [open, isDone])

  // ── Stage simulation (time-based) ───────────────────────────────────────
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    if (!open || isDone || isError) return

    // Don't advance stages while in queue
    if (typeof queuePosition === 'number' && queuePosition > 0) return

    elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current) }
  }, [open, isDone, isError, queuePosition])

  // Reset on each new render
  useEffect(() => {
    if (open && !isDone) setElapsed(0)
  }, [open, isDone])

  // Derived active stage index
  const currentStageIdx = isDone
    ? STAGES.length // mark all complete
    : STAGE_THRESHOLDS.reduce<number>((acc, threshold, i) => (elapsed >= threshold ? i : acc), 0)

  const inQueue = typeof queuePosition === 'number' && queuePosition > 0

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className={cn(
            'mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
            isDone    ? 'bg-emerald-500/20' :
            isError   ? 'bg-red-500/20' :
                        'bg-cyan-500/10'
          )}>
            {isDone  ? <CheckCircle className="h-4 w-4 text-emerald-400" /> :
             isError ? <X className="h-4 w-4 text-red-400" /> :
                       <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white leading-tight">
              {isDone   ? 'Clip ready!'
               : isError ? 'Render failed'
               : inQueue  ? `In queue — position ${queuePosition}`
               :            'Rendering your clip'}
            </h2>
            {!isDone && !isError && (
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {inQueue
                  ? "You're next — won't be long"
                  : 'Usually 30–90 seconds — safe to background this tab'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            title="Close — rendering continues in background"
            className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stage pipeline */}
        {!isError && (
          <div className="px-5 pb-4 space-y-1.5">
            {STAGES.map((stage, i) => {
              const isActive   = !isDone && !inQueue && currentStageIdx === i
              const isComplete = isDone || currentStageIdx > i
              const isPending  = !isComplete && !isActive

              return (
                <div
                  key={stage.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500',
                    isActive   ? 'bg-cyan-500/10 border border-cyan-500/25' :
                    isComplete ? 'bg-emerald-500/5 border border-emerald-500/15' :
                                 'bg-white/[0.025] border border-white/[0.05]'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500',
                    isComplete ? 'bg-emerald-500' :
                    isActive   ? 'bg-cyan-500' :
                                 'bg-white/[0.08]'
                  )}>
                    {isComplete ? (
                      <CheckCircle className="h-3 w-3 text-white" style={{ strokeWidth: 2.5 }} />
                    ) : isActive ? (
                      <Loader2 className="h-3 w-3 text-white animate-spin" />
                    ) : (
                      <span className="text-[8px] font-bold text-zinc-600">{i + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      'text-xs font-semibold block leading-tight',
                      isComplete ? 'text-emerald-400' :
                      isActive   ? 'text-white' :
                                   'text-zinc-600'
                    )}>
                      {stage.label}
                    </span>
                    <span className={cn(
                      'text-[10px] block mt-0.5',
                      isPending ? 'text-zinc-700' : 'text-zinc-500'
                    )}>
                      {stage.desc}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="px-5 pb-4">
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400">
              {errorMessage || 'Something went wrong — please close and try again.'}
            </div>
          </div>
        )}

        {/* Notification opt-in (shown while rendering, not in error state) */}
        {!isDone && !isError && notifSupported && (
          <div className="px-5 pb-5 pt-1 border-t border-white/[0.05]">
            {notifState === 'idle' && (
              <button
                onClick={handleNotifRequest}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <Bell className="h-3.5 w-3.5 text-zinc-500" />
                Notify me when done →
              </button>
            )}
            {notifState === 'asking' && (
              <span className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for permission…
              </span>
            )}
            {notifState === 'granted' && (
              <span className="flex items-center gap-2 text-xs text-emerald-400">
                <Bell className="h-3.5 w-3.5" />
                You&apos;ll be notified — safe to switch tabs
              </span>
            )}
            {notifState === 'denied' && (
              <span className="flex items-center gap-2 text-xs text-zinc-600">
                <BellOff className="h-3.5 w-3.5" />
                Notifications blocked — enable them in browser settings
              </span>
            )}
          </div>
        )}

        {/* Done CTA */}
        {isDone && (
          <div className="px-5 pb-5 pt-1 border-t border-white/[0.05]">
            <button
              onClick={onClose}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-sm font-bold transition-all hover:scale-[1.01]"
            >
              View rendered clip →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
