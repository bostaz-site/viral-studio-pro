'use client'

import { useState } from 'react'
import { Loader2, DollarSign } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAffiliateStore } from '@/stores/affiliate-store'

interface PayoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  affiliateId: string
  affiliateName: string
  maxAmount: number
}

export function PayoutDialog({ open, onOpenChange, affiliateId, affiliateName, maxAmount }: PayoutDialogProps) {
  const { createPayout } = useAffiliateStore()

  const [amount, setAmount] = useState(maxAmount)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    if (amount <= 0) return
    setLoading(true)
    await createPayout(affiliateId, {
      amount,
      notes: notes || undefined,
    })
    setLoading(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} title={`Pay ${affiliateName}`} className="max-w-sm">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Amount (USD)</Label>
          <Input
            type="number"
            min={0.01}
            max={maxAmount}
            step={0.01}
            value={amount}
            onChange={e => setAmount(parseFloat(e.target.value) || 0)}
            className="h-9"
          />
          <p className="text-[10px] text-muted-foreground">Max: ${maxAmount.toFixed(2)}</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Notes</Label>
          <Input
            placeholder="Payment notes..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 gap-1.5" onClick={handlePay} disabled={loading || amount <= 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
            Pay ${amount.toFixed(2)}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
