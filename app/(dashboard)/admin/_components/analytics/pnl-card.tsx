'use client'

interface PnLView {
  revenue_cents: number
  stripe_fees: number
  commissions: number
  infra: number
  tools: number
  other: number
  net_profit: number
}

function fmt(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  return `${negative ? '-' : ''}$${(abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

export function PnLCard({ data }: { data: PnLView }) {
  const rows = [
    { label: 'Revenue', value: data.revenue_cents, color: 'text-green-400', bold: true },
    { label: 'Stripe Fees', value: -data.stripe_fees, color: 'text-red-400', bold: false },
    { label: 'Affiliate Commissions', value: -data.commissions, color: 'text-red-400', bold: false },
    { label: 'Infrastructure + AI', value: -data.infra, color: 'text-red-400', bold: false },
    { label: 'Tools & SaaS', value: -data.tools, color: 'text-red-400', bold: false },
    { label: 'Other', value: -data.other, color: 'text-red-400', bold: false },
  ]

  return (
    <div className="space-y-1">
      {rows.map(row => (
        <div key={row.label} className={`flex items-center justify-between py-1.5 px-2 rounded ${row.bold ? '' : ''}`}>
          <span className={`text-sm ${row.bold ? 'font-medium text-zinc-200' : 'text-zinc-400'}`}>
            {row.label}
          </span>
          <span className={`text-sm font-mono ${row.color}`}>
            {fmt(row.value)}
          </span>
        </div>
      ))}
      <div className="border-t border-zinc-700 pt-2 mt-2 flex items-center justify-between px-2">
        <span className="text-sm font-semibold text-zinc-100">Net Profit</span>
        <span className={`text-base font-bold font-mono ${data.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {fmt(data.net_profit)}
        </span>
      </div>
    </div>
  )
}
