'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CampaignForm } from '../_components/campaign-form'
import { RecipientSelector } from '../_components/recipient-selector'
import { ExportPreview } from '../_components/export-preview'

type Step = 'form' | 'recipients' | 'export'

export default function NewCampaignPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('form')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [campaignName, setCampaignName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((d) => {
          if (!d.isAdmin) { router.push('/dashboard'); return }
          setAuthorized(true)
          setLoading(false)
        })
        .catch(() => router.push('/dashboard'))
    })
  }, [router])

  const handleCreateCampaign = async (data: Parameters<typeof CampaignForm>[0] extends { onSubmit: (d: infer T) => unknown } ? T : never) => {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setCampaignId(json.data.id)
      setCampaignName(json.data.name)
      setStep('recipients')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setCreating(false)
    }
  }

  if (!authorized || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'form', label: 'Campaign Details' },
    { key: 'recipients', label: 'Select Recipients' },
    { key: 'export', label: 'Review & Export' },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin/campaigns')}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">New Campaign</h1>
          {campaignName && (
            <p className="text-sm text-zinc-500">{campaignName}</p>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-zinc-700" />}
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                step === s.key
                  ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                  : steps.findIndex((x) => x.key === step) > i
                    ? 'border-green-500/50 bg-green-500/10 text-green-400'
                    : 'border-zinc-700 text-zinc-500'
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-xs">
                {i + 1}
              </span>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'form' && (
        <CampaignForm onSubmit={handleCreateCampaign} isSubmitting={creating} />
      )}

      {step === 'recipients' && (
        <div className="space-y-4">
          <RecipientSelector
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => setStep('export')}
              disabled={selectedIds.length === 0}
            >
              Continue to Export
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'export' && campaignId && (
        <div className="space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep('recipients')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Selection
          </Button>
          <ExportPreview
            campaignId={campaignId}
            selectedIds={selectedIds}
            onExportComplete={() => {
              // Navigate to the campaign detail after export
              setTimeout(() => {
                router.push(`/admin/campaigns/${campaignId}`)
              }, 2000)
            }}
          />
        </div>
      )}
    </div>
  )
}
