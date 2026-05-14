'use client'

import { Mail } from 'lucide-react'

interface Template {
  id: string
  name: string
  description: string | null
  subject_line_variants: string[]
  niche: string[]
  ab_variant_label: string | null
  total_sent: number
  total_opens: number
  total_replies: number
  status: string
}

interface TemplateListProps {
  templates: Template[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function TemplateList({ templates, selectedId, onSelect }: TemplateListProps) {
  if (templates.length === 0) {
    return <p className="text-sm text-zinc-500 text-center py-8">No templates found</p>
  }

  return (
    <div className="space-y-2">
      {templates.map(t => {
        const openRate = t.total_sent > 0 ? ((t.total_opens / t.total_sent) * 100).toFixed(1) : '0'
        const replyRate = t.total_sent > 0 ? ((t.total_replies / t.total_sent) * 100).toFixed(1) : '0'

        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`w-full text-left p-4 rounded-lg border transition-colors ${
              selectedId === t.id
                ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-zinc-200 truncate">{t.name}</span>
                  {t.ab_variant_label && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">{t.ab_variant_label}</span>
                  )}
                </div>
                {t.description && <p className="text-xs text-zinc-500 mt-1 truncate">{t.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
                  <span>{t.subject_line_variants.length} variants</span>
                  <span>{t.niche.length > 0 ? t.niche.join(', ') : 'all niches'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs flex-shrink-0">
                <div className="text-center">
                  <p className="text-zinc-400 font-medium">{t.total_sent}</p>
                  <p className="text-[10px] text-zinc-600">sent</p>
                </div>
                <div className="text-center">
                  <p className="text-zinc-400 font-medium">{openRate}%</p>
                  <p className="text-[10px] text-zinc-600">opens</p>
                </div>
                <div className="text-center">
                  <p className="text-zinc-400 font-medium">{replyRate}%</p>
                  <p className="text-[10px] text-zinc-600">replies</p>
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
