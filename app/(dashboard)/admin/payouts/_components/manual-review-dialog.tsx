'use client'

import { useState } from 'react'
import { X, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react'

interface Payout {
  id: string
  influencer_id: string
  net_payout_cents: number
  referrals_count: number
  status: string
  influencer: {
    email: string
    first_name: string | null
    display_name: string | null
    affiliate_code: string | null
  } | null
}

interface ManualReviewDialogProps {
  payout: Payout
  onClose: () => void
  onAction: (payoutId: string, influencerId: string, action: 'approve' | 'reject') => Promise<void>
}

export function ManualReviewDialog({ payout, onClose, onAction }: ManualReviewDialogProps) {
  const [loading, setLoading] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)

  const name = payout.influencer?.display_name || payout.influencer?.first_name || payout.influencer?.email || 'Unknown'
  const amount = (payout.net_payout_cents / 100).toFixed(2)

  const handleAction = async (action: 'approve' | 'reject') => {
    setLoading(true)
    setActionType(action)
    try {
      await onAction(payout.id, payout.influencer_id, action)
      onClose()
    } catch {
      setLoading(false)
      setActionType(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-medium text-zinc-200">Manual Review Required</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-xs text-zinc-500">Affiliate</span>
              <span className="text-sm text-zinc-200">{name}</span>
            </div>
            {payout.influencer?.affiliate_code && (
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">Code</span>
                <span className="text-sm text-zinc-400 font-mono">{payout.influencer.affiliate_code}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-xs text-zinc-500">Payout Amount</span>
              <span className="text-sm font-bold text-amber-400">${amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-zinc-500">Referrals</span>
              <span className="text-sm text-zinc-400">{payout.referrals_count}</span>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-xs text-amber-300">
              This payout requires manual review. Verify the affiliate's referrals and commission history before approving.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-zinc-800">
          <button
            onClick={() => handleAction('reject')}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {loading && actionType === 'reject' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            Hold
          </button>
          <button
            onClick={() => handleAction('approve')}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-500 transition-colors disabled:opacity-50"
          >
            {loading && actionType === 'approve' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Approve & Send
          </button>
        </div>
      </div>
    </div>
  )
}
