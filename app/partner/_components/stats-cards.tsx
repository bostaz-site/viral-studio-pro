'use client'

import { Link2, UserPlus, CreditCard, DollarSign } from 'lucide-react'

interface StatsCardsProps {
  clicks: { total: number; thisMonth: number }
  signups: number
  paying: number
  earnings: { totalCents: number; thisMonthCents: number }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function StatsCards({ clicks, signups, paying, earnings }: StatsCardsProps) {
  const cards = [
    {
      label: 'Total Clicks',
      value: clicks.total.toLocaleString(),
      sub: `${clicks.thisMonth} this month`,
      icon: Link2,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
    {
      label: 'Signups',
      value: signups.toLocaleString(),
      sub: `${paying > 0 ? ((paying / Math.max(signups, 1)) * 100).toFixed(0) : 0}% conversion`,
      icon: UserPlus,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Paying Customers',
      value: paying.toLocaleString(),
      sub: 'Active subscriptions',
      icon: CreditCard,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Total Earned',
      value: formatCents(earnings.totalCents),
      sub: `${formatCents(earnings.thisMonthCents)} this month`,
      icon: DollarSign,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-100">{card.value}</p>
          <p className="text-xs text-zinc-500 mt-1">{card.label}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}
