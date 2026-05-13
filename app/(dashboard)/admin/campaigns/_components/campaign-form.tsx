'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

const NICHE_OPTIONS = [
  'gaming', 'fps', 'moba', 'irl', 'fitness', 'business',
  'beauty', 'music', 'education', 'tech', 'cooking', 'travel',
  'sports', 'comedy', 'art', 'science', 'lifestyle', 'other',
]

const PLATFORM_OPTIONS = [
  'twitch', 'kick', 'youtube', 'tiktok', 'instagram', 'podcast', 'other',
]

interface CampaignFormData {
  name: string
  description: string
  target_niches: string[]
  target_platforms: string[]
  mailbox_id: string
  subject_template: string
  body_template: string
}

interface CampaignFormProps {
  onSubmit: (data: CampaignFormData) => Promise<void>
  isSubmitting?: boolean
}

export function CampaignForm({ onSubmit, isSubmitting }: CampaignFormProps) {
  const [form, setForm] = useState<CampaignFormData>({
    name: '',
    description: '',
    target_niches: [],
    target_platforms: [],
    mailbox_id: '',
    subject_template: '',
    body_template: '',
  })

  const toggleArrayField = (field: 'target_niches' | 'target_platforms', value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Campaign Name *</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Q1 Twitch Streamers - Gaming niche"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Campaign targeting mid-tier gaming streamers..."
          rows={3}
        />
      </div>

      {/* Target Niches */}
      <div className="space-y-2">
        <Label>Target Niches</Label>
        <div className="flex flex-wrap gap-2">
          {NICHE_OPTIONS.map((niche) => (
            <button
              key={niche}
              type="button"
              onClick={() => toggleArrayField('target_niches', niche)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                form.target_niches.includes(niche)
                  ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {niche}
            </button>
          ))}
        </div>
      </div>

      {/* Target Platforms */}
      <div className="space-y-2">
        <Label>Target Platforms</Label>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => toggleArrayField('target_platforms', platform)}
              className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
                form.target_platforms.includes(platform)
                  ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>

      {/* Subject Template */}
      <div className="space-y-2">
        <Label htmlFor="subject">Subject Template</Label>
        <Input
          id="subject"
          value={form.subject_template}
          onChange={(e) => setForm((prev) => ({ ...prev, subject_template: e.target.value }))}
          placeholder="Hey {{first_name}}, your clips could go viral"
        />
        <p className="text-xs text-zinc-500">
          Variables: {'{{first_name}}'}, {'{{display_name}}'}, {'{{platform}}'}, {'{{niche}}'}
        </p>
      </div>

      {/* Body Template */}
      <div className="space-y-2">
        <Label htmlFor="body">Body Template</Label>
        <Textarea
          id="body"
          value={form.body_template}
          onChange={(e) => setForm((prev) => ({ ...prev, body_template: e.target.value }))}
          placeholder="Hi {{first_name}},&#10;&#10;I noticed your {{platform}} content..."
          rows={8}
        />
        <p className="text-xs text-zinc-500">
          Include {'{{unsubscribe_token}}'} for compliance. Used as: /unsubscribe?t={'{{unsubscribe_token}}'}
        </p>
      </div>

      <Button type="submit" disabled={!form.name || isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          'Create Campaign'
        )}
      </Button>
    </form>
  )
}
