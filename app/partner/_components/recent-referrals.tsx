'use client'

interface Referral {
  label: string
  status: string
  signedUpAt: string
  firstPaidAt: string | null
  revenueCents: number
  commissionCents: number
}

interface RecentReferralsProps {
  referrals: Referral[]
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  signed_up: 'bg-cyan-500/15 text-cyan-400',
  trial: 'bg-amber-500/15 text-amber-400',
  paying: 'bg-green-500/15 text-green-400',
  churned: 'bg-red-500/15 text-red-400',
}

export function RecentReferrals({ referrals }: RecentReferralsProps) {
  if (referrals.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Recent Referrals</h3>
        <p className="text-sm text-zinc-500 text-center py-4">No referrals yet. Share your link to get started!</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">Recent Referrals</h3>
      <div className="space-y-2">
        {referrals.map((r, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-zinc-400">{r.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[r.status] || 'bg-zinc-700 text-zinc-400'}`}>
                {r.status}
              </span>
            </div>
            <div className="text-right">
              {r.commissionCents > 0 && (
                <span className="text-xs text-green-400 font-medium">${(r.commissionCents / 100).toFixed(2)}</span>
              )}
              <p className="text-[10px] text-zinc-500">
                {r.firstPaidAt ? `Paying since ${formatDate(r.firstPaidAt)}` : `Signed up ${formatDate(r.signedUpAt)}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
