'use client'

import { useState } from 'react'
import { Loader2, Zap, CheckCircle2, XCircle } from 'lucide-react'

interface BulkGenerateModalProps {
  templateId: string
  templateName: string
  onClose: () => void
  onGenerate: (ids: string[], tplId: string) => Promise<{ generated: number; blocked: number; failed: number; total: number }>
}

export function BulkGenerateModal({ templateId, templateName, onClose, onGenerate }: BulkGenerateModalProps) {
  const [loading, setLoading] = useState(false)
  const [fetchingLeads, setFetchingLeads] = useState(false)
  const [leads, setLeads] = useState<Array<{ id: string; email: string; display_name: string | null }>>([])
  const [result, setResult] = useState<{ generated: number; blocked: number; failed: number; total: number } | null>(null)
  const [niche, setNiche] = useState('')

  const fetchLeads = async () => {
    setFetchingLeads(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (niche) params.set('niche', niche)
      const res = await fetch(`/api/admin/influencers/search?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setLeads(json.data.filter((l: { email: string }) => l.email))
    } catch { /* silent */ }
    finally { setFetchingLeads(false) }
  }

  const handleGenerate = async () => {
    if (leads.length === 0) return
    setLoading(true)
    try { setResult(await onGenerate(leads.map(l => l.id), templateId)) }
    catch { /* silent */ }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Bulk Generate</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-sm">Close</button>
        </div>
        <p className="text-xs text-zinc-400 mb-4">Template: <span className="text-zinc-200 font-medium">{templateName}</span></p>

        {result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-green-400">{result.generated}</p>
                <p className="text-[10px] text-zinc-500">Generated</p>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-lg">
                <XCircle className="h-5 w-5 text-red-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-red-400">{result.blocked}</p>
                <p className="text-[10px] text-zinc-500">Blocked</p>
              </div>
              <div className="text-center p-3 bg-zinc-800 rounded-lg">
                <p className="text-lg font-bold text-zinc-400 mt-1">{result.failed}</p>
                <p className="text-[10px] text-zinc-500">Failed</p>
              </div>
            </div>
            <button onClick={onClose} className="w-full py-2 bg-zinc-800 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input type="text" placeholder="Filter niche..." value={niche} onChange={e => setNiche(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
              <button onClick={fetchLeads} disabled={fetchingLeads} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-md hover:bg-zinc-700 disabled:opacity-50">
                {fetchingLeads ? 'Loading...' : 'Find Leads'}
              </button>
            </div>
            {leads.length > 0 && (
              <>
                <p className="text-xs text-zinc-400"><span className="text-amber-400 font-medium">{leads.length}</span> leads found.</p>
                <button onClick={handleGenerate} disabled={loading} className="w-full py-2.5 bg-amber-500 text-black font-semibold text-sm rounded-lg hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Generate {leads.length} Offers
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
