'use client'

import { Eye, Pause, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAffiliateStore, type Affiliate } from '@/stores/affiliate-store'

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 border-green-400/40',
  paused: 'text-amber-400 border-amber-400/40',
  inactive: 'text-red-400 border-red-400/40',
}

interface AffiliateTableProps {
  affiliates: Affiliate[]
  onViewDetail: (id: string) => void
}

export function AffiliateTable({ affiliates, onViewDetail }: AffiliateTableProps) {
  const { updateAffiliate, deleteAffiliate } = useAffiliateStore()

  const toggleStatus = (a: Affiliate) => {
    const newStatus = a.status === 'active' ? 'paused' : 'active'
    updateAffiliate(a.id, { status: newStatus })
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <h3 className="text-sm font-semibold text-foreground">All Affiliates</h3>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Handle</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Platform</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Clicks</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Signups</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Conv.</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Revenue</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Due</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                    No affiliates yet
                  </td>
                </tr>
              ) : (
                affiliates.map(a => {
                  const due = (a.total_commission_earned ?? 0) - (a.total_commission_paid ?? 0)
                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{a.name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{a.handle}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{a.platform ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] font-mono">{a.promo_code}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{a.total_clicks ?? 0}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{a.total_signups ?? 0}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{a.total_conversions ?? 0}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">${(a.total_revenue ?? 0).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">${due.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[a.status ?? 'active']}`}>
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewDetail(a.id)} title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(a)} title={a.status === 'active' ? 'Pause' : 'Activate'}>
                            {a.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400" onClick={() => deleteAffiliate(a.id)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
  )
}
