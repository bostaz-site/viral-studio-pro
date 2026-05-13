'use client'

import { DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface Props {
  totalCents: number
  affiliateCount: number
  top: Array<{ display_name: string | null; email: string; due_cents: number }>
}

export function PayoutsDueCard({ totalCents, affiliateCount, top }: Props) {
  return (
    <Card className="border-border h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-green-400" />
          <h3 className="text-sm font-semibold text-foreground">Payouts Due</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-2xl font-bold text-foreground">${(totalCents / 100).toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">{affiliateCount} affiliate{affiliateCount !== 1 ? 's' : ''}</p>
        </div>
        {top.length > 0 && (
          <div className="space-y-1.5">
            {top.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate mr-2">{a.display_name ?? a.email}</span>
                <span className="text-foreground font-medium flex-shrink-0">${(a.due_cents / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
