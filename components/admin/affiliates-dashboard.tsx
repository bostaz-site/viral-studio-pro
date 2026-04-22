'use client'

import { useEffect, useState } from 'react'
import { Users, MousePointerClick, CreditCard, DollarSign, Loader2, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAffiliateStore } from '@/stores/affiliate-store'
import { AffiliateTable } from './affiliate-table'
import { AffiliateDetail } from './affiliate-detail'
import { CreateAffiliateDialog } from './create-affiliate-dialog'

export function AffiliatesDashboard() {
  const { affiliates, loading, error, fetchAffiliates, selectedDetail } = useAffiliateStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    fetchAffiliates()
  }, [fetchAffiliates])

  const activeCount = affiliates.filter(a => a.status === 'active').length
  const totalSignups = affiliates.reduce((sum, a) => sum + (a.total_signups ?? 0), 0)
  const totalConversions = affiliates.reduce((sum, a) => sum + (a.total_conversions ?? 0), 0)
  const totalCommissionDue = affiliates.reduce(
    (sum, a) => sum + ((a.total_commission_earned ?? 0) - (a.total_commission_paid ?? 0)),
    0
  )

  if (loading && affiliates.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Affiliates</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your affiliate partners</p>
        </div>
        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Affiliate
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Affiliates" value={activeCount} icon={<Users className="h-4 w-4" />} color="text-blue-400" />
        <StatCard label="Total Signups" value={totalSignups} icon={<MousePointerClick className="h-4 w-4" />} color="text-green-400" />
        <StatCard label="Conversions" value={totalConversions} icon={<CreditCard className="h-4 w-4" />} color="text-amber-400" />
        <StatCard label="Commission Due" value={`$${totalCommissionDue.toFixed(2)}`} icon={<DollarSign className="h-4 w-4" />} color="text-red-400" />
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Table */}
      <AffiliateTable affiliates={affiliates} onViewDetail={setDetailId} />

      {/* Dialogs */}
      <CreateAffiliateDialog open={createOpen} onOpenChange={setCreateOpen} />
      {detailId && (
        <AffiliateDetail
          affiliateId={detailId}
          open={!!detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={color}>{icon}</div>
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
