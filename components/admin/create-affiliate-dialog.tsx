'use client'

import { useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAffiliateStore } from '@/stores/affiliate-store'

interface CreateAffiliateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateAffiliateDialog({ open, onOpenChange }: CreateAffiliateDialogProps) {
  const { createAffiliate } = useAffiliateStore()

  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [platform, setPlatform] = useState('')
  const [niche, setNiche] = useState('')
  const [commissionRate, setCommissionRate] = useState(20)
  const [discount, setDiscount] = useState(20)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generatedCode = `${handle.toUpperCase()}${discount}`
  const generatedLink = `viralanimal.com/ref/${handle.toLowerCase()}`

  const handleSubmit = async () => {
    if (!name.trim() || !handle.trim()) {
      setError('Name and handle are required')
      return
    }

    setLoading(true)
    setError(null)

    const result = await createAffiliate({
      name: name.trim(),
      handle: handle.trim().toLowerCase(),
      email: email.trim() || undefined,
      platform: platform || undefined,
      niche: niche || undefined,
      commission_rate: commissionRate / 100,
      promo_discount_percent: discount,
      notes: notes || undefined,
    })

    setLoading(false)

    if (result) {
      onOpenChange(false)
      setName('')
      setHandle('')
      setEmail('')
      setPlatform('')
      setNiche('')
      setCommissionRate(20)
      setDiscount(20)
      setNotes('')
    } else {
      setError('Failed to create affiliate. Handle may already exist.')
    }
  }

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} title="Add Affiliate" className="max-w-md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Name *</Label>
            <Input placeholder="xQc" value={name} onChange={e => setName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Handle *</Label>
            <Input placeholder="xqc" value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} className="h-9 font-mono" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Email</Label>
          <Input type="email" placeholder="contact@example.com" value={email} onChange={e => setEmail(e.target.value)} className="h-9" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Platform</Label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="">Select...</option>
              <option value="twitch">Twitch</option>
              <option value="youtube">YouTube</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Niche</Label>
            <Input placeholder="gaming, irl..." value={niche} onChange={e => setNiche(e.target.value)} className="h-9" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Commission %</Label>
            <Input type="number" min={5} max={50} value={commissionRate} onChange={e => setCommissionRate(parseInt(e.target.value) || 20)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Discount %</Label>
            <Input type="number" min={5} max={50} value={discount} onChange={e => setDiscount(parseInt(e.target.value) || 20)} className="h-9" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Notes</Label>
          <Input placeholder="Internal notes..." value={notes} onChange={e => setNotes(e.target.value)} className="h-9" />
        </div>

        {/* Auto-generated preview */}
        {handle && (
          <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Auto-generated</p>
            <div className="text-xs">
              <span className="text-muted-foreground">Link:</span>{' '}
              <span className="font-mono text-foreground">{generatedLink}</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Code:</span>{' '}
              <span className="font-mono text-foreground">{generatedCode}</span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 gap-1.5" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
