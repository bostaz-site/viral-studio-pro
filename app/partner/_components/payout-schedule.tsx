'use client'

import { Clock, CheckCircle2, AlertCircle, DollarSign } from 'lucide-react'

interface Payout {
  id: string
  net_payout_cents: number
  status: string
  period_start_at: string
  period_end_at: string
  sent_at: string | null
  created_at: string
}

interface NextPayout {
  amountCents: number
  status: string
  periodEnd: string
}

interface PayoutScheduleProps {
  nextPayout: NextPayout | null
  pastPayouts: Payout[]
  totalEarnedCents: number
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending_review: { icon: Clock, color: 'text-amber-400', label: 'Pending Review' },
  approved: { icon: CheckCircle2, color: 'text-cyan-400', label: 'Approved' },
  processing: { icon: Clock, color: 'text-amber-400', label: 'Processing' },
  sent: { icon: CheckCircle2, color: 'text-green-400', label: 'Sent' },
  failed: { icon: AlertCircle, color: 'text-red-400', label: 'Failed' },
}

export function PayoutSchedule({ nextPayout, pastPayouts, totalEarnedCents }: PayoutScheduleProps) {
  const minPayout = 5000 // $50 in cents
  const meetsThreshold = totalEarnedCents >= minPayout

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">Payouts</h3>

      {/* Next payout */}
      <div className="border border-zinc-700 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">Next Payout</span>
          {meetsThreshold ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">
              $50 minimum met
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
              ${((minPayout - totalEarnedCents) / 100).toFixed(2)} until $50 min
            </span>
          )}
        </div>

        {nextPayout ? (
          <div>
            <p className="text-xl font-bold text-zinc-100">${(nextPayout.amountCents / 100).toFixed(2)}</p>
            <div className="flex items-center gap-2 mt-1">
              {(() => {
                const info = STATUS_ICONS[nextPayout.status] || STATUS_ICONS.pending_review
                const Icon = info.icon
                return (
                  <>
                    <Icon className={`h-3.5 w-3.5 ${info.color}`} />
                    <span className={`text-xs ${info.color}`}>{info.label}</span>
                  </>
                )
              })()}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No pending payout. Payouts are processed on the 1st of each month.</p>
        )}
      </div>

      {/* Past payouts */}
      {pastPayouts.length > 0 && (
        <div>
          <span className="text-xs text-zinc-500">History</span>
          <div className="mt-2 space-y-1">
            {pastPayouts.map(p => {
              const info = STATUS_ICONS[p.status] || STATUS_ICONS.pending_review
              return (
                <div key={p.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3 w-3 text-zinc-500" />
                    <span className="text-xs text-zinc-300">${(p.net_payout_cents / 100).toFixed(2)}</span>
                    <span className={`text-[10px] ${info.color}`}>{info.label}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">{formatDate(p.sent_at || p.created_at)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
