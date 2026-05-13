'use client'

import { Send, Reply, UserPlus, CreditCard, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  emailsSent: number
  replies: number
  signups: number
  payingUsers: number
  newAlerts: number
  period: string
}

export function WhileYouSlept({ emailsSent, replies, signups, payingUsers, newAlerts, period }: Props) {
  const items = [
    { label: 'Emails sent', value: emailsSent, icon: Send, color: 'text-cyan-400' },
    { label: 'Replies', value: replies, icon: Reply, color: 'text-green-400' },
    { label: 'Signups', value: signups, icon: UserPlus, color: 'text-amber-400' },
    { label: 'Paying', value: payingUsers, icon: CreditCard, color: 'text-emerald-400' },
    { label: 'Alerts', value: newAlerts, icon: AlertTriangle, color: newAlerts > 0 ? 'text-red-400' : 'text-zinc-500' },
  ]

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">Pendant que tu dormais ({period})</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {items.map(item => (
          <Card key={item.label} className="border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <item.icon className={`h-4 w-4 ${item.color} flex-shrink-0`} />
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{item.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
