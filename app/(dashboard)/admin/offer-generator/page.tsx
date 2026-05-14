'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, AlertCircle, Loader2, Send, Zap } from 'lucide-react'
import { TemplateList } from './_components/template-list'
import { OfferPreview } from './_components/offer-preview'
import { BulkGenerateModal } from './_components/bulk-generate-modal'

interface Template { id: string; name: string; description: string | null; subject_line_variants: string[]; body_template: string; niche: string[]; ab_variant_label: string | null; total_sent: number; total_opens: number; total_replies: number; status: string }
interface Offer { id: string; status: string; rendered_subject: string | null; passed_compliance: boolean; generated_at: string; influencers: Record<string, unknown> }
type Tab = 'templates' | 'offers'

export default function OfferGeneratorPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('templates')
  const [templates, setTemplates] = useState<Template[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ subject: string; body: string; repostKitUrl: string } | null>(null)
  const [compliance, setCompliance] = useState<{ allowed: boolean; blocks: string[]; warnings: string[] } | null>(null)
  const [allSubjectVariants, setAllSubjectVariants] = useState<string[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [offersStats, setOffersStats] = useState({ draft: 0, sent: 0, blocked: 0 })
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [tplRes, offRes] = await Promise.all([
        fetch('/api/admin/offer-generator/templates', { cache: 'no-store' }),
        fetch('/api/admin/offer-generator/offers?limit=50', { cache: 'no-store' }),
      ])
      if (tplRes.status === 403 || tplRes.status === 401) { router.push('/dashboard'); return }
      const tplJson = await tplRes.json()
      const offJson = await offRes.json()
      if (tplJson.data) setTemplates(tplJson.data)
      if (offJson.data) { setOffers(offJson.data.offers || []); setOffersStats(offJson.data.stats || { draft: 0, sent: 0, blocked: 0 }) }
    } catch { setError('Failed to load') }
    finally { setLoading(false) }
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  const handleBulkGenerate = async (ids: string[], tplId: string) => {
    const res = await fetch('/api/admin/offer-generator/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ influencerIds: ids, templateId: tplId }),
    })
    const json = await res.json()
    await loadData()
    return json.data
  }

  const handleSendAll = async () => {
    const draftIds = offers.filter(o => o.status === 'draft' && o.passed_compliance).map(o => o.id)
    if (draftIds.length === 0) return
    setSendingIds(new Set(draftIds))
    try {
      await fetch('/api/admin/offer-generator/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offerIds: draftIds }) })
      await loadData()
    } catch { /* silent */ }
    finally { setSendingIds(new Set()) }
  }

  if (error) {
    return <div className="max-w-2xl mx-auto mt-12"><div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3"><AlertCircle className="h-5 w-5 text-red-400" /><span className="text-sm text-red-400">{error}</span></div></div>
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-amber-400" />
          <h1 className="text-lg font-semibold text-zinc-100">Offer Generator</h1>
        </div>
        <div className="flex items-center gap-2">
          {offersStats.draft > 0 && (
            <button onClick={handleSendAll} disabled={sendingIds.size > 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 text-green-400 text-xs rounded-md hover:bg-green-500/25 disabled:opacity-50">
              <Send className="h-3.5 w-3.5" />Send {offersStats.draft} Draft(s)
            </button>
          )}
          <button onClick={loadData} disabled={loading} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-md hover:bg-zinc-700 disabled:opacity-50">Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-amber-400">{offersStats.draft}</p><p className="text-xs text-zinc-500">Drafts</p></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-green-400">{offersStats.sent}</p><p className="text-xs text-zinc-500">Sent</p></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-red-400">{offersStats.blocked}</p><p className="text-xs text-zinc-500">Blocked</p></div>
      </div>

      <div className="flex items-center gap-4 border-b border-zinc-800">
        {(['templates', 'offers'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-amber-400 text-amber-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            {t === 'templates' ? `Templates (${templates.length})` : `Generated (${offers.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
      ) : tab === 'templates' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">Email Templates</span>
              {selectedTemplate && (
                <button onClick={() => setBulkModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-400 text-xs rounded-md hover:bg-amber-500/25">
                  <Zap className="h-3.5 w-3.5" />Bulk Generate
                </button>
              )}
            </div>
            <TemplateList templates={templates} selectedId={selectedTemplate} onSelect={id => setSelectedTemplate(id)} />
          </div>
          <div>
            <span className="text-sm text-zinc-400 mb-3 block">Preview</span>
            <OfferPreview preview={preview} compliance={compliance} allSubjectVariants={allSubjectVariants} loading={previewLoading} />
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase"><th className="text-left p-3">Influencer</th><th className="text-left p-3">Subject</th><th className="text-left p-3">Status</th><th className="text-left p-3">Compliance</th><th className="text-left p-3">Date</th></tr></thead>
            <tbody>
              {offers.map(o => (
                <tr key={o.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="p-3 text-xs text-zinc-300">{(o.influencers as { display_name?: string; email?: string }).display_name || (o.influencers as { email: string }).email}</td>
                  <td className="p-3 text-xs text-zinc-400 truncate max-w-[200px]">{o.rendered_subject || '—'}</td>
                  <td className="p-3"><span className={`text-[10px] px-1.5 py-0.5 rounded ${o.status === 'draft' ? 'bg-amber-500/15 text-amber-400' : o.status === 'sent' ? 'bg-green-500/15 text-green-400' : o.status === 'failed' ? 'bg-red-500/15 text-red-400' : 'bg-zinc-700 text-zinc-400'}`}>{o.status}</span></td>
                  <td className="p-3 text-[10px]"><span className={o.passed_compliance ? 'text-green-400' : 'text-red-400'}>{o.passed_compliance ? 'OK' : 'Blocked'}</span></td>
                  <td className="p-3 text-xs text-zinc-500">{new Date(o.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                </tr>
              ))}
              {offers.length === 0 && <tr><td colSpan={5} className="text-center text-zinc-500 text-sm py-8">No offers yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {bulkModalOpen && selectedTemplate && (
        <BulkGenerateModal templateId={selectedTemplate} templateName={templates.find(t => t.id === selectedTemplate)?.name || ''} onClose={() => setBulkModalOpen(false)} onGenerate={handleBulkGenerate} />
      )}
    </div>
  )
}
