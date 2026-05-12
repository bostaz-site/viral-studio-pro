'use client'

import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const REASONS = [
  { value: 'manual_block', label: 'Manual Block' },
  { value: 'unsubscribe', label: 'Unsubscribe' },
  { value: 'hard_bounce', label: 'Hard Bounce' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'gdpr_request', label: 'GDPR Request' },
  { value: 'fraud_flag', label: 'Fraud Flag' },
]

interface BulkAddDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function BulkAddDialog({ open, onClose, onSuccess }: BulkAddDialogProps) {
  const [text, setText] = useState('')
  const [reason, setReason] = useState('manual_block')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ added: number; total_requested: number } | null>(null)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const parsed = text
    .split('\n')
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean)

  const validEmails = parsed.filter((l) => emailRegex.test(l))
  const invalidLines = parsed.filter((l) => !emailRegex.test(l))

  const handleSubmit = async () => {
    if (validEmails.length === 0) {
      setError('No valid emails found')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/admin/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: validEmails.map((email) => ({ email, reason })),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to add entries')

      setResult(json.data)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setText('')
    setError(null)
    setResult(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Bulk Add to Suppression List" description="Paste one email per line. Max 500 at a time.">
      <div className="space-y-4">
        {/* Reason selector */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Reason</Label>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  reason === r.value
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Email input */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">
            Emails ({validEmails.length} valid{invalidLines.length > 0 ? `, ${invalidLines.length} invalid` : ''})
          </Label>
          <Textarea
            placeholder={'john@example.com\njane@example.com\nspammer@bad-domain.com'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="font-mono text-xs"
          />
        </div>

        {invalidLines.length > 0 && (
          <div className="text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
            Invalid lines will be skipped: {invalidLines.slice(0, 3).join(', ')}
            {invalidLines.length > 3 && ` +${invalidLines.length - 3} more`}
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {result && (
          <div className="text-xs text-green-400 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
            Added {result.added} of {result.total_requested} entries (duplicates skipped).
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleSubmit} disabled={loading || validEmails.length === 0} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Add {validEmails.length} Email{validEmails.length !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
