'use client'

import { useEffect, useState } from 'react'
import { Loader2, DollarSign, Copy, CheckCircle2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAffiliateStore } from '@/stores/affiliate-store'
import { PayoutDialog } from './payout-dialog'

interface AffiliateDetailProps {
  affiliateId: string
  open: boolean
  onClose: () => void
}

export function AffiliateDetail({ affiliateId, open, onClose }: AffiliateDetailProps) {
  const { selectedDetail, detailLoading, fetchDetail } = useAffiliateStore()
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open && affiliateId) {
      fetchDetail(affiliateId)
    }
  }, [open, affiliateId, fetchDetail])

  const aff = selectedDetail?.affiliate
  const refLink = aff ? `https://viralanimal.com/ref/${aff.handle}` : ''
  const due = aff ? (aff.total_commission_earned ?? 0) - (aff.total_commission_paid ?? 0) : 0

  const copyLink = () => {
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} title={aff?.name ?? 'Affiliate Detail'} className="max-w-2xl">
        {detailLoading || !aff ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MiniStat label="Clicks" value={aff.total_clicks ?? 0} />
              <MiniStat label="Signups" value={aff.total_signups ?? 0} />
              <MiniStat label="Conversions" value={aff.total_conversions ?? 0} />
              <MiniStat label="Commission Due" value={`$${due.toFixed(2)}`} />
            </div>

            {/* Links */}
            <Card className="border-border">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Referral Link</p>
                    <p className="text-sm font-mono text-foreground">{refLink}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyLink}>
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Promo Code</p>
                  <Badge variant="outline" className="font-mono mt-0.5">{aff.promo_code}</Badge>
                  <span className="text-xs text-muted-foreground ml-2">({aff.promo_discount_percent}% off)</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Commission Rate</p>
                  <p className="text-sm text-foreground">{((aff.commission_rate ?? 0.2) * 100).toFixed(0)}%</p>
                </div>
              </CardContent>
            </Card>

            {/* Pay button */}
            {due > 0 && (
              <Button className="w-full gap-1.5" onClick={() => setPayoutOpen(true)}>
                <DollarSign className="h-4 w-4" />
                Pay ${due.toFixed(2)} Now
              </Button>
            )}

            {/* Referrals list */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Recent Referrals</h4>
              {(selectedDetail?.referrals ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No referrals yet</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {selectedDetail?.referrals.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[9px] ${
                          r.status === 'converted' ? 'text-green-400 border-green-400/40'
                            : r.status === 'signed_up' ? 'text-blue-400 border-blue-400/40'
                            : 'text-muted-foreground border-border'
                        }`}>
                          {r.status}
                        </Badge>
                        <span className="text-muted-foreground">{r.source}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payouts list */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Payout History</h4>
              {(selectedDetail?.payouts ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No payouts yet</p>
              ) : (
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {selectedDetail?.payouts.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">${p.amount.toFixed(2)}</span>
                        <Badge variant="outline" className={`text-[9px] ${
                          p.status === 'paid' ? 'text-green-400 border-green-400/40'
                            : p.status === 'pending' ? 'text-amber-400 border-amber-400/40'
                            : 'text-muted-foreground border-border'
                        }`}>
                          {p.status}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {aff && (
        <PayoutDialog
          open={payoutOpen}
          onOpenChange={setPayoutOpen}
          affiliateId={aff.id}
          affiliateName={aff.name}
          maxAmount={due}
        />
      )}
    </>
  )
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border p-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}
