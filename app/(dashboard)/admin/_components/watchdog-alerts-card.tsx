'use client'

import { ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface Alert {
  id: string
  severity: string
  title: string
  description: string | null
  detected_at: string
}

export function WatchdogAlertsCard({ alerts }: { alerts: Alert[] }) {
  const critical = alerts.filter(a => a.severity === 'critical')
  const important = alerts.filter(a => a.severity === 'important')

  return (
    <Card className="border-border h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`h-4 w-4 ${critical.length > 0 ? 'text-red-400' : 'text-green-400'}`} />
          <h3 className="text-sm font-semibold text-foreground">Watchdog</h3>
          {critical.length > 0 && (
            <Badge variant="outline" className="text-[10px] text-red-400 border-red-400/40 ml-auto">{critical.length} critical</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-green-400">All systems healthy</p>
        ) : (
          <>
            {alerts.slice(0, 5).map(a => (
              <div key={a.id} className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                a.severity === 'critical'
                  ? 'bg-red-500/5 border-red-500/20 text-red-400'
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
              }`}>
                {a.title}
              </div>
            ))}
            {alerts.length > 5 && (
              <Link href="/admin/watchdog" className="text-[10px] text-primary hover:underline">
                +{alerts.length - 5} more
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
