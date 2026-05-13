'use client'

import { Clock, CheckCircle2, AlertCircle, XCircle, Send, DollarSign } from 'lucide-react'

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

interface PayoutsTableProps {
  payouts: Payout[]
  onReview: (payout: Payout) => void
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  pending_review: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Needs Review' },
  approved: { icon: CheckCircle2, color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'Approved' },
  pending: { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-400/10', label: 'Pending' },
  on_hold: { icon: XCircle, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'On Hold' },
  sending: { icon: Send, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Sending' },
  sent: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Sent' },
  failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Failed' },
  reversed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Reversed' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start)
  return s.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function PayoutsTable({ payouts, onReview }: PayoutsTableProps) {
  if (payouts.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
        <DollarSign className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">No payouts yet. Payouts are processed on the 1st of each month.</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Affiliate</th>
            <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Period</th>
            <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Amount</th>
            <th className="text-center px-4 py-3 text-xs text-zinc-500 font-medium">Referrals</th>
            <th className="text-center px-4 py-3 text-xs text-zinc-500 font-medium">Status</th>
            <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Date</th>
            <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map(p => {
            const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending
            const Icon = cfg.icon
            const name = p.influencer?.display_name || p.influencer?.first_name || p.influencer?.email || 'Unknown'

            return (
              <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-zinc-200 text-sm">{name}</p>
                    {p.influencer?.affiliate_code && (
                      <p className="text-[10px] text-zinc-500 font-mono">{p.influencer.affiliate_code}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {formatPeriod(p.period_start_at, p.period_end_at)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-200 font-mono">
                  ${(p.net_payout_cents / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center text-zinc-400">
                  {p.referrals_count}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${cfg.bg} ${cfg.color}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-zinc-500 text-xs">
                  {formatDate(p.sent_at || p.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  {p.status === 'pending_review' && (
                    <button
                      onClick={() => onReview(p)}
                      className="text-xs px-2.5 py-1 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors"
                    >
                      Review
                    </button>
                  )}
                  {p.status === 'failed' && p.failure_reason && (
                    <span className="text-[10px] text-red-400" title={p.failure_reason}>
                      {p.failure_reason.slice(0, 30)}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
