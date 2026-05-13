'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, DollarSign, CheckCircle2, Clock, AlertCircle, ExternalLink } from 'lucide-react'

interface Payout {
  id: string
  net_payout_cents: number
  status: string
  period_start_at: string
  period_end_at: string
  sent_at: string | null
  created_at: string
}

interface PayoutData {
  payouts: Payout[]
  totalPaidCents: number
  availableBalanceCents: number
  nextPayoutDate: string
}

const STATUS_BADGES: Record<string, { color: string; label: string }> = {
  pending_review: { color: 'bg-amber-400/10 text-amber-400', label: 'Under Review' },
  approved: { color: 'bg-cyan-400/10 text-cyan-400', label: 'Approved' },
  pending: { color: 'bg-zinc-400/10 text-zinc-400', label: 'Pending' },
  on_hold: { color: 'bg-orange-400/10 text-orange-400', label: 'On Hold' },
  sending: { color: 'bg-amber-400/10 text-amber-400', label: 'Processing' },
  sent: { color: 'bg-green-400/10 text-green-400', label: 'Sent' },
  failed: { color: 'bg-red-400/10 text-red-400', label: 'Failed' },
  reversed: { color: 'bg-red-400/10 text-red-400', label: 'Reversed' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PartnerPayoutsPage() {
  const router = useRouter()
  const [data, setData] = useState<PayoutData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/partner/ledger', { cache: 'no-store' })
        if (res.status === 401) {
          router.push('/partner/login')
          return
        }
        const json = await res.json()
        if (json.data) {
          setData({
            payouts: json.data.payouts || [],
            totalPaidCents: json.data.totalPaidCents || 0,
            availableBalanceCents: json.data.availableBalanceCents || 0,
            nextPayoutDate: json.data.nextPayoutDate || '',
          })
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-100">Payout History</h1>
        <a
          href="/partner"
          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Dashboard
        </a>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs text-zinc-500">Total Paid</span>
          </div>
          <p className="text-lg font-semibold text-zinc-200">
            ${((data?.totalPaidCents || 0) / 100).toFixed(2)}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-zinc-500">Available Balance</span>
          </div>
          <p className="text-lg font-semibold text-zinc-200">
            ${((data?.availableBalanceCents || 0) / 100).toFixed(2)}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs text-zinc-500">Next Payout</span>
          </div>
          <p className="text-sm font-medium text-zinc-300">
            {data?.nextPayoutDate ? formatDate(data.nextPayoutDate) : '1st of next month'}
          </p>
        </div>
      </div>

      {/* Payout list */}
      {(!data?.payouts || data.payouts.length === 0) ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <DollarSign className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No payouts yet. Payouts are processed on the 1st of each month when your balance exceeds $50.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Period</th>
                <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Amount</th>
                <th className="text-center px-4 py-3 text-xs text-zinc-500 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.payouts.map(p => {
                const badge = STATUS_BADGES[p.status] || STATUS_BADGES.pending
                const period = new Date(p.period_start_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

                return (
                  <tr key={p.id} className="border-b border-zinc-800/50">
                    <td className="px-4 py-3 text-zinc-300">{period}</td>
                    <td className="px-4 py-3 text-right text-zinc-200 font-mono">
                      ${(p.net_payout_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 text-xs">
                      {formatDate(p.sent_at || p.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-center">
        <p className="text-xs text-zinc-500">
          Payouts are processed on the 1st of each month via Stripe. Minimum payout: <span className="text-amber-400">$50</span>.
          First payouts require manual review. Funds typically arrive in 2-3 business days.
        </p>
      </div>
    </div>
  )
}
