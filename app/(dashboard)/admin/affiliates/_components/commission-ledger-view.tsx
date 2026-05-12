'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface LedgerEntry {
  id: string
  event_type: string
  amount_cents: number
  currency: string
  stripe_invoice_id: string | null
  stripe_charge_id: string | null
  notes: string | null
  created_at: string
}

const EVENT_CONFIG: Record<string, { label: string; color: string }> = {
  payment_earned: { label: 'Earned', color: 'text-green-400 border-green-400/40' },
  refund_clawback: { label: 'Refund', color: 'text-red-400 border-red-400/40' },
  chargeback_clawback: { label: 'Chargeback', color: 'text-rose-400 border-rose-400/40' },
  manual_adjustment: { label: 'Adjustment', color: 'text-amber-400 border-amber-400/40' },
  payout_deduction: { label: 'Payout', color: 'text-blue-400 border-blue-400/40' },
  expiration_writeoff: { label: 'Expired', color: 'text-zinc-400 border-zinc-400/40' },
}

function formatCents(cents: number): string {
  const sign = cents >= 0 ? '+' : ''
  return `${sign}$${(cents / 100).toFixed(2)}`
}

interface CommissionLedgerViewProps {
  entries: LedgerEntry[]
  balance: { earned_cents: number; clawback_cents: number; available_cents: number }
}

export function CommissionLedgerView({ entries, balance }: CommissionLedgerViewProps) {
  return (
    <div className="space-y-4">
      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Earned</p>
            <p className="text-lg font-bold text-green-400">${(balance.earned_cents / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Clawbacks</p>
            <p className="text-lg font-bold text-red-400">${(Math.abs(balance.clawback_cents) / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-lg font-bold text-foreground">${(balance.available_cents / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger entries */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold text-foreground">Commission Ledger (Immutable)</h3>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Amount</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Stripe Ref</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No ledger entries yet
                    </td>
                  </tr>
                ) : (
                  entries.map((e) => {
                    const config = EVENT_CONFIG[e.event_type] ?? { label: e.event_type, color: 'text-muted-foreground' }
                    return (
                      <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(e.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                            {config.label}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-xs font-medium ${e.amount_cents >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCents(e.amount_cents)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                          {e.stripe_invoice_id?.slice(0, 12) ?? e.stripe_charge_id?.slice(0, 12) ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[200px]">
                          {e.notes ?? '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
