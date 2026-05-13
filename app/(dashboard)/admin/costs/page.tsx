'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, DollarSign, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PnLCard } from '../_components/analytics/pnl-card'

interface CostData {
  costs: {
    month: string
    auto: { anthropic_api: number; stripe_fees: number; affiliate_commissions: number }
    manual: { category: string; vendor: string; amount_cents: number }[]
    total_auto: number
    total_manual: number
    total: number
  }
  pnl: {
    revenue_cents: number
    stripe_fees: number
    commissions: number
    infra: number
    tools: number
    other: number
    net_profit: number
  }
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

const CATEGORIES = ['infra', 'cold_email', 'tools', 'vas', 'legal', 'banking', 'taxes', 'misc'] as const

export default function CostsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const [month] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

  // Auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: d }) => {
      if (!d.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(j => {
          if (!j.isAdmin) { router.push('/dashboard'); return }
          setAuthorized(true)
          setAuthLoading(false)
        })
        .catch(() => router.push('/dashboard'))
    })
  }, [router])

  const loadData = useCallback(() => {
    fetch(`/api/admin/costs?month=${month}`)
      .then(r => r.json())
      .then(j => setData(j.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month])

  useEffect(() => {
    if (authorized) loadData()
  }, [authorized, loadData])

  const handleAddCost = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)

    try {
      await fetch('/api/admin/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: fd.get('category'),
          vendor: fd.get('vendor'),
          description: fd.get('description') || undefined,
          amount_cents: Math.round(parseFloat(fd.get('amount') as string) * 100),
          billing_period_start: `${month}-01`,
          invoice_url: fd.get('invoice_url') || undefined,
        }),
      })
      setShowModal(false)
      loadData()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !authorized) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
  }

  if (loading || !data) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      {/* Nav tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {[
          { label: 'Events', href: '/dashboard/admin/analytics' },
          { label: 'Funnel', href: '/dashboard/admin/analytics/funnel' },
          { label: 'Revenue', href: '/dashboard/admin/analytics/revenue' },
          { label: 'Affiliates', href: '/dashboard/admin/analytics/affiliates' },
          { label: 'Campaigns', href: '/dashboard/admin/analytics/campaigns' },
          { label: 'Cohorts', href: '/dashboard/admin/analytics/cohorts' },
          { label: 'Costs', href: '/dashboard/admin/costs', active: true },
        ].map(tab => (
          <a
            key={tab.href}
            href={tab.href}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab.active
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-red-400" />
          <h1 className="text-xl font-bold text-zinc-100">Costs & P&L — {month}</h1>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Cost
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="text-center py-4">
          <p className="text-xl font-bold text-red-400">{fmt(data.costs.total)}</p>
          <p className="text-xs text-zinc-500">Total Costs</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-lg font-bold text-zinc-300">{fmt(data.costs.total_auto)}</p>
          <p className="text-xs text-zinc-500">Auto-computed</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className="text-lg font-bold text-zinc-300">{fmt(data.costs.total_manual)}</p>
          <p className="text-xs text-zinc-500">Manual Entries</p>
        </CardContent></Card>
        <Card><CardContent className="text-center py-4">
          <p className={`text-xl font-bold ${data.pnl.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(data.pnl.net_profit)}</p>
          <p className="text-xs text-zinc-500">Net Profit</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* P&L */}
        <Card>
          <CardHeader><CardTitle>Profit & Loss</CardTitle></CardHeader>
          <CardContent>
            <PnLCard data={data.pnl} />
          </CardContent>
        </Card>

        {/* Auto-computed */}
        <Card>
          <CardHeader><CardTitle>Auto-Computed Costs</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Anthropic API (Claude)</span>
                <span className="font-mono text-zinc-300">{fmt(data.costs.auto.anthropic_api)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Stripe Fees (est. 2.9%+30c)</span>
                <span className="font-mono text-zinc-300">{fmt(data.costs.auto.stripe_fees)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Affiliate Commissions</span>
                <span className="font-mono text-zinc-300">{fmt(data.costs.auto.affiliate_commissions)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual entries */}
      {data.costs.manual.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Manual Cost Entries</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                  <th className="text-left px-3 py-2">Category</th>
                  <th className="text-left px-3 py-2">Vendor</th>
                  <th className="text-right px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.costs.manual.map((c, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="px-3 py-2 text-zinc-400 capitalize">{c.category}</td>
                    <td className="px-3 py-2 text-zinc-300">{c.vendor}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">{fmt(c.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add cost modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-100">Add Manual Cost</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddCost} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Category</label>
                <select name="category" required className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Vendor</label>
                <input name="vendor" required className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200" placeholder="e.g. Netlify" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Description (optional)</label>
                <input name="description" className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Amount (USD)</label>
                <input name="amount" type="number" step="0.01" min="0.01" required className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200" placeholder="19.99" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Invoice URL (optional)</label>
                <input name="invoice_url" type="url" className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Cost'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
