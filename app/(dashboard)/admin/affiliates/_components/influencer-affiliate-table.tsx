'use client'

import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface InfluencerAffiliate {
  id: string
  email: string
  display_name: string | null
  platform_handle: string | null
  affiliate_code: string | null
  status: string
  total_referrals: number | null
  total_paying_referrals: number | null
  total_commission_earned_cents: number | null
  total_commission_paid_cents: number | null
}

interface Props {
  affiliates: InfluencerAffiliate[]
  onViewDetail: (id: string) => void
}

export function InfluencerAffiliateTable({ affiliates, onViewDetail }: Props) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <h3 className="text-sm font-semibold text-foreground">Influencer Affiliates (CRM)</h3>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Referrals</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Paying</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Earned</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Due</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No influencer affiliates yet
                  </td>
                </tr>
              ) : (
                affiliates.map((a) => {
                  const earned = (a.total_commission_earned_cents ?? 0) / 100
                  const paid = (a.total_commission_paid_cents ?? 0) / 100
                  const due = earned - paid
                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground text-xs">{a.display_name ?? a.email}</p>
                          {a.platform_handle && (
                            <p className="text-[10px] text-muted-foreground">@{a.platform_handle}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {a.affiliate_code ? (
                          <Badge variant="outline" className="text-[10px] font-mono">{a.affiliate_code}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${
                          a.status === 'onboarded' || a.status === 'active' || a.status === 'paying'
                            ? 'text-green-400 border-green-400/40'
                            : 'text-muted-foreground'
                        }`}>
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{a.total_referrals ?? 0}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{a.total_paying_referrals ?? 0}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">${earned.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">${due.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => onViewDetail(a.id)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Detail
                        </Button>
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
