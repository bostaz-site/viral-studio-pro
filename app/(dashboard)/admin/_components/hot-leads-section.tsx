'use client'

import { Flame } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface HotLead {
  id: string
  email: string
  display_name: string | null
  platform_handle: string | null
  status: string
  lead_score: number
  last_reply_at: string | null
  tags: string[]
}

export function HotLeadsSection({ leads }: { leads: HotLead[] }) {
  if (leads.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          No hot leads right now. Keep sending!
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-foreground">Hot Leads</h3>
          <Badge variant="outline" className="text-[10px] ml-auto">{leads.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {leads.map(lead => (
            <Link key={lead.id} href={`/admin/inbox`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                lead.lead_score >= 80 ? 'bg-green-500/20 text-green-400' :
                lead.lead_score >= 60 ? 'bg-amber-500/20 text-amber-400' :
                'bg-zinc-500/20 text-zinc-400'
              }`}>
                {lead.lead_score}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {lead.display_name ?? lead.email}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {lead.platform_handle ? `@${lead.platform_handle}` : lead.email}
                  {lead.last_reply_at && ` · replied ${timeAgo(lead.last_reply_at)}`}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] flex-shrink-0">{lead.status}</Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
