"use client"

import { useState, useCallback } from 'react'
import { X, Zap, Users, Gift, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

interface PaywallModalProps {
  open: boolean
  onClose: () => void
  /** If true, shows the one-time save option (first wall only, paywall_save_used=false) */
  showOneTimeSave: boolean
  /** Called when user clicks the one-time save */
  onOneTimeSave: () => void
  /** Referral link for the invite option */
  referralLink: string | null
  /** Monthly reset date string (1st of next month) */
  resetDate: string
  /** Current user ID for Stripe checkout */
  userId: string
}

export function PaywallModal({
  open,
  onClose,
  showOneTimeSave,
  onOneTimeSave,
  referralLink,
  resetDate,
  userId,
}: PaywallModalProps) {
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleUpgrade = useCallback(async () => {
    track('paywall_upgrade_clicked', { userId })
    setLoadingCheckout('pro')
    setCheckoutError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      })
      const json = await res.json()
      if (json.data?.url) {
        window.location.href = json.data.url
        return
      }
      setCheckoutError("Couldn't open checkout — try again")
      setLoadingCheckout(null)
    } catch {
      setCheckoutError("Couldn't open checkout — try again")
      setLoadingCheckout(null)
    }
  }, [userId])

  const handleTopUp = useCallback(async (pack: 'pack5' | 'pack10') => {
    track('paywall_topup_clicked', { pack, userId })
    setLoadingCheckout(pack)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/stripe/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      })
      const json = await res.json()
      if (json.data?.url) {
        window.location.href = json.data.url
        return
      }
      setCheckoutError("Couldn't open checkout — try again")
      setLoadingCheckout(null)
    } catch {
      setCheckoutError("Couldn't open checkout — try again")
      setLoadingCheckout(null)
    }
  }, [userId])

  const handleReferral = useCallback(() => {
    track('paywall_referral_clicked', { userId })
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [referralLink, userId])

  const handleSave = useCallback(() => {
    track('paywall_save_used', { userId })
    onOneTimeSave()
  }, [onOneTimeSave, userId])

  const handleDismiss = useCallback(() => {
    track('paywall_dismissed', { userId })
    onClose()
  }, [onClose, userId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — lets the clip behind show through */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleDismiss} />

      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Close */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-zinc-100">You used your 3 free clips</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Your next clip is ready to render. Choose how you want to unlock it.
            </p>
          </div>

          {/* One-time save (first wall only) */}
          {showOneTimeSave && (
            <button
              onClick={handleSave}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"
            >
              <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                <Gift className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-400">Finish this one free</p>
                <p className="text-xs text-zinc-400">We&apos;ll cover this one so you can finish your clip.</p>
              </div>
            </button>
          )}

          {/* Primary: Upgrade */}
          <div>
            <Button
              onClick={handleUpgrade}
              disabled={loadingCheckout !== null}
              className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold text-base gap-2 rounded-xl"
            >
              <Zap className="h-5 w-5" />
              {loadingCheckout === 'pro' ? 'Redirecting...' : 'Upgrade & render this clip'}
            </Button>
            <p className="text-xs text-zinc-500 text-center mt-1.5">
              30 clips/month · no watermark · faster renders
            </p>
            {checkoutError && (
              <p className="text-xs text-red-400 text-center mt-1">{checkoutError}</p>
            )}
          </div>

          {/* Secondary: Invite */}
          {referralLink && (
            <div>
              <Button
                variant="outline"
                onClick={handleReferral}
                className="w-full h-10 gap-2 border-zinc-700 hover:border-zinc-600 text-zinc-300"
              >
                <Users className="h-4 w-4" />
                {copied ? 'Link copied!' : 'Invite for +5 clips'}
              </Button>
              <p className="text-xs text-zinc-500 text-center mt-1">
                +5 bonus clips for you, +2 for them — credited at signup
              </p>
            </div>
          )}

          {/* Top-up packs */}
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-500 font-medium">Not ready for Pro?</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleTopUp('pack5')}
                disabled={loadingCheckout !== null}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
              >
                <Package className="h-3 w-3" />
                {loadingCheckout === 'pack5' ? '...' : '5 clips — $5'}
              </button>
              <button
                onClick={() => handleTopUp('pack10')}
                disabled={loadingCheckout !== null}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
              >
                <Package className="h-3 w-3" />
                {loadingCheckout === 'pack10' ? '...' : '10 clips — $9'}
              </button>
            </div>
          </div>

          {/* Wait text link */}
          <p className="text-center">
            <button onClick={handleDismiss} className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors">
              I&apos;ll wait — free clips reset on {resetDate}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
