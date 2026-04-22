'use client'

import { useState } from 'react'
import { CalendarPlus, Loader2, AlertCircle } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useScheduleStore } from '@/stores/schedule-store'

const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', available: true },
  { id: 'tiktok', name: 'TikTok', available: false },
  { id: 'instagram', name: 'Instagram', available: false },
] as const

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clipId?: string
}

export function ScheduleDialog({ open, onOpenChange, clipId: initialClipId }: ScheduleDialogProps) {
  const { scheduleClip, settings } = useScheduleStore()

  const [clipId, setClipId] = useState(initialClipId ?? '')
  const [platform, setPlatform] = useState<string>('youtube')
  const [caption, setCaption] = useState(settings?.caption_template ?? '')
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() + 1, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSchedule = async () => {
    if (!clipId.trim()) {
      setError('Clip ID is required')
      return
    }

    setLoading(true)
    setError(null)

    const result = await scheduleClip({
      clip_id: clipId.trim(),
      platform,
      caption: caption || undefined,
      hashtags: settings?.default_hashtags ?? [],
      scheduled_at: new Date(scheduledAt).toISOString(),
    })

    setLoading(false)

    if (result) {
      onOpenChange(false)
      setClipId('')
      setCaption(settings?.caption_template ?? '')
      setError(null)
    } else {
      setError('Failed to schedule. Check anti-shadowban rules.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Schedule Publication"
      className="max-w-md"
    >
      <div className="space-y-4">
        {/* Clip ID */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Clip ID</Label>
          <Input
            placeholder="Enter clip ID..."
            value={clipId}
            onChange={e => setClipId(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Platform */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Platform</Label>
          <div className="flex gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`relative text-xs px-3 py-2 rounded-lg font-medium transition-colors border ${
                  platform === p.id
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {p.name}
                {!p.available && (
                  <Badge className="absolute -top-2 -right-2 text-[8px] px-1 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                    Soon
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Caption */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Caption</Label>
          <Input
            placeholder="Write a caption..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Schedule time */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Schedule for</Label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="h-9"
          />
          <p className="text-[10px] text-muted-foreground">
            A random +/- 30min variation will be applied for anti-shadowban
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 gap-1.5"
            onClick={handleSchedule}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}
            Schedule
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
