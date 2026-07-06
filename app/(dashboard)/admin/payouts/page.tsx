'use client'

import { useEffect, useState, useCallback } from 'react'
import { DollarSign, Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { PayoutsTable } from './_components/payouts-table'
import { ManualReviewDialog } from './_components/manual-review-dialog'

interface PayoutInfluencer {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  affiliate_code: string | null
  platform_handle: string | null
}

interface Payout {
  id: string
  influencer_id: string
  period_start_at: string
  period_end_at: string
  gross_commission_cents: number
  adjustments_cents: number
  net_payout_cents: number
  referrals_count: number
  status: string
  stripe_transfer_id: string | null
  stripe_transfer_status: string | null
  failure_reason: string | null
  created_at: string
  sent_at: string | null
  influencer: PayoutInfluencer | null
}

interface Summary {
  pending_count: number
  sent_count: number
  on_hold_count: number
  failed_count: number
  total_net_cents: number | null
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending_review', label: 'Needs Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'sending', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'failed', label: 'Failed' },
]

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [reviewPayout, setReviewPayout] = useState<Payout | null>(null)

  const fetchPayouts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter) params.set('status', filter)
      const res = await fetch(`/api/admin/payouts?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) {
        setPayouts(json.data.payouts)
        setSummary(json.data.summary)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    fetchPayouts()
  }, [fetchPayouts])

  const handleReviewAction = async (payoutId: string, influencerId: string, action: 'approve' | 'reject') => {
    const res = await fetch(`/api/admin/affiliates/${influencerId}/payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_id: payoutId, action }),
    })

    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Failed')
    }

    await fetchPayouts()
  }

  const needsReviewCount = payouts.filter(p => p.status === 'pending_review').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <DollarSign className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Payouts</h1>
            <p className="text-xs text-zinc-500">Stripe Connect affiliate payouts</p>
          </div>
        </div>
        {needsReviewCount > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-400 rounded-full text-xs font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            {needsReviewCount} needs review
          </span>
        )}
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-zinc-500">Pending</span>
            </div>
            <p className="text-lg font-semibold text-zinc-200">{summary.pending_count}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs text-zinc-500">Sent</span>
            </div>
            <p className="text-lg font-semibold text-zinc-200">{summary.sent_count}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-xs text-zinc-500">On Hold</span>
            </div>
            <p className="text-lg font-semibold text-zinc-200">{summary.on_hold_count}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs text-zinc-500">Total This Month</span>
            </div>
            <p className="text-lg font-semibold text-zinc-200">
              ${((summary.total_net_cents || 0) / 100).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1.5">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
              filter === f.value
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <WolfLoader variant="spinner" size={24} mode="amber" />
        </div>
      ) : (
        <PayoutsTable payouts={payouts} onReview={setReviewPayout} />
      )}

      {/* Review dialog */}
      {reviewPayout && (
        <ManualReviewDialog
          payout={reviewPayout}
          onClose={() => setReviewPayout(null)}
          onAction={handleReviewAction}
        />
      )}
    </div>
  )
}
