'use client'

import { Clock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface StuckLead {
  id: string
  email: string
  display_name: string | null
  status: string
  status_changed_at: string | null
  last_active_at: string | null
}

export function StuckFollowups({ leads }: { leads: StuckLead[] }) {
  if (leads.length === 0) return null

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">Follow-up Needed</h3>
          <Badge variant="outline" className="text-[10px] ml-auto text-amber-400 border-amber-400/40">{leads.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {leads.map(lead => (
            <div key={lead.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{lead.display_name ?? lead.email}</p>
                <p className="text-[10px] text-muted-foreground">
                  {lead.status} · Last active {lead.last_active_at ? daysAgo(lead.last_active_at) : 'unknown'}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/40">{lead.status}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function daysAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}
