"use client"

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X, Sparkles, Check, Loader2, Download } from 'lucide-react'

const GUIDE_URL = '/guides/10-hooks-viraux.pdf'

const SESSION_KEY = 'vsp:exit_intent_seen'

/**
 * Shows a modal with an email capture lead magnet when the user's cursor
 * leaves the top edge of the viewport (classic exit-intent signal).
 *
 * Triggers only once per session (sessionStorage) and only after the user
 * has been on the page ≥ 15s so we don't ambush bouncing visitors.
 * Disabled on mobile (no mouseleave signal).
 */
export function ExitIntentPopup() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const armedAtRef = useRef<number | null>(null)

  useEffect(() => {
    // Skip if already seen this session or on touch devices.
    if (typeof window === 'undefined') return
    const isTouch = window.matchMedia('(hover: none)').matches
    if (isTouch) return

    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return
    } catch {
      // sessionStorage can throw in strict privacy modes — treat as no-op.
    }

    // Arm after 15s so we don't trigger on immediate bouncers.
    const armTimer = setTimeout(() => {
      armedAtRef.current = Date.now()
    }, 15_000)

    const handleMouseLeave = (event: MouseEvent) => {
      if (armedAtRef.current === null) return
      // Only trigger when cursor leaves the top edge — side exits are usually
      // tab switches or reaching for a scrollbar, not leaving the page.
      if (event.clientY > 0) return
      setOpen(true)
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        // ignore
      }
      document.removeEventListener('mouseleave', handleMouseLeave)
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      clearTimeout(armTimer)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || trimmed.length < 5) return
    setStatus('submitting')
    setMessage(null)
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'exit_intent_popup' }),
      })
      const data = (await res.json()) as {
        data: { alreadySubscribed?: boolean } | null
        error: string | null
        message?: string
      }
      if (res.ok) {
        setStatus('success')
        setMessage(
          data.data?.alreadySubscribed
            ? 'Tu es déjà dans la liste. Télécharge le guide direct ci-dessous.'
            : 'Merci ! Le guide est prêt à télécharger ci-dessous.',
        )
      } else {
        setStatus('error')
        setMessage(data.message ?? 'Erreur, réessaie dans un instant.')
      }
    } catch {
      setStatus('error')
      setMessage('Erreur réseau. Réessaie.')
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fermer"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {status === 'success' ? (
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">C&apos;est parti !</h2>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
            <a
              href={GUIDE_URL}
              download
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-blue-700 hover:to-indigo-700"
            >
              <Download className="h-4 w-4" />
              Télécharger le guide (PDF)
            </a>
          </div>
        ) : (
          <>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
              <Sparkles className="h-3 w-3" />
              Gratuit
            </div>

            <h2 id="exit-intent-title" className="text-2xl font-black tracking-tight text-foreground">
              Attends — prends ça avant de partir
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Le guide PDF des <strong className="text-foreground">10 hooks viraux</strong> qui
              font x3 sur la rétention TikTok. Utilisé par les plus gros clippeurs Twitch.
              Envoyé direct dans ta boîte.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <input
                type="email"
                required
                autoFocus
                placeholder="ton@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'submitting'}
                className="w-full rounded-lg border border-border bg-background/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  'Envoie-moi le guide'
                )}
              </button>
              {status === 'error' && message && (
                <p className="text-xs text-rose-400" role="alert">
                  {message}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/60 text-center">
                Pas de spam. Désinscription en 1 clic.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
