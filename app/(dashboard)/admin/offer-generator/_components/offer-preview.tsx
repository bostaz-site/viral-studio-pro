'use client'

import { Shield, CheckCircle2 } from 'lucide-react'

interface OfferPreviewProps {
  preview: { subject: string; body: string; repostKitUrl: string } | null
  compliance: { allowed: boolean; blocks: string[]; warnings: string[] } | null
  allSubjectVariants: string[]
  loading: boolean
}

export function OfferPreview({ preview, compliance, allSubjectVariants, loading }: OfferPreviewProps) {
  if (loading) {
    return <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 animate-pulse"><div className="h-4 bg-zinc-800 rounded w-1/3 mb-4" /><div className="h-40 bg-zinc-800 rounded" /></div>
  }
  if (!preview) {
    return <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center text-sm text-zinc-500">Select a template and influencer to preview</div>
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
      {compliance && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${compliance.allowed ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
          {compliance.allowed ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Shield className="h-4 w-4 text-red-400" />}
          <span className={`text-xs ${compliance.allowed ? 'text-green-400' : 'text-red-400'}`}>
            {compliance.allowed ? 'Compliance OK' : `Blocked: ${compliance.blocks.join(', ')}`}
          </span>
        </div>
      )}
      <div>
        <span className="text-[10px] uppercase text-zinc-500 font-medium">Subject Variants</span>
        <div className="mt-1 space-y-1">
          {allSubjectVariants.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-purple-400 font-mono w-4">{String.fromCharCode(65 + i)}</span>
              <span className="text-sm text-zinc-300">{s}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <span className="text-[10px] uppercase text-zinc-500 font-medium">Email Body</span>
        <div className="mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-4">
          <p className="text-xs font-medium text-zinc-200 mb-2">Subject: {preview.subject}</p>
          <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed border-t border-zinc-800 pt-3">{preview.body}</div>
        </div>
      </div>
      <div className="text-xs text-zinc-500">
        Kit: <a href={preview.repostKitUrl} target="_blank" rel="noopener" className="text-amber-400 hover:underline">{preview.repostKitUrl}</a>
      </div>
    </div>
  )
}
