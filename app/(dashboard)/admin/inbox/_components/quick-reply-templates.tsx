'use client'

import { Zap } from 'lucide-react'

export interface QuickTemplate {
  label: string
  subject: string
  body: string
}

export const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    label: 'Quick yes',
    subject: 'Re: Getting started',
    body: `Awesome, here's the link to get started: {{signup_link}}

Let me know if you have any questions!

Best,
Viral Animal`,
  },
  {
    label: 'Schedule a call',
    subject: 'Re: Let\'s chat',
    body: `Sounds good! Can you grab a slot here: {{calendly}}

Looking forward to it,
Viral Animal`,
  },
  {
    label: 'Soft pitch',
    subject: 'Re: No worries',
    body: `No worries, no pressure at all.

If you ever change your mind, here's our link: {{link}}

Cheers,
Viral Animal`,
  },
  {
    label: 'Decline politely',
    subject: 'Re: Thanks!',
    body: `All good, thanks for the response! Wishing you the best.

Cheers,
Viral Animal`,
  },
]

interface QuickReplyTemplatesProps {
  onSelect: (template: QuickTemplate) => void
  disabled?: boolean
}

export function QuickReplyTemplates({ onSelect, disabled }: QuickReplyTemplatesProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Zap className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
      {QUICK_TEMPLATES.map((tpl, i) => (
        <button
          key={i}
          onClick={() => onSelect(tpl)}
          disabled={disabled}
          className="px-2 py-1 text-[11px] rounded-md border border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {tpl.label}
        </button>
      ))}
    </div>
  )
}
