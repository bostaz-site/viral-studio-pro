'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, ShieldCheck, AlertTriangle, Copy, FileText } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'

interface ExportPreviewProps {
  campaignId: string
  selectedIds: string[]
  onExportComplete?: (result: ExportResult) => void
}

interface ExportResult {
  campaign_id: string
  total_selected: number
  suppressed: number
  duplicates: number
  exported: number
  download_url: string | null
  storage_path: string
}

interface PreviewData {
  totalSelected: number
  suppressed: number
  duplicates: number
  willExport: number
}

export function ExportPreview({ campaignId, selectedIds, onExportComplete }: ExportPreviewProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const computePreview = async () => {
    if (selectedIds.length === 0) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencer_ids: selectedIds }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Preview failed')
      setPreview(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compute preview')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencer_ids: selectedIds }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Export failed')
      setExportResult(json.data)
      onExportComplete?.(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (selectedIds.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center text-sm text-zinc-500">
        Select influencers to see export preview
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Preview section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-300">Export Preview</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={computePreview}
            disabled={loading}
            className="h-7 text-xs"
          >
            {loading ? (
              <WolfLoader variant="spinner" size={12} mode="amber" className="mr-1" />
            ) : (
              <ShieldCheck className="mr-1 h-3 w-3" />
            )}
            Check Suppression
          </Button>
        </div>

        {preview ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Selected"
              value={preview.totalSelected}
              color="text-white"
            />
            <StatCard
              label="Suppressed"
              value={preview.suppressed}
              color="text-red-400"
              sub="will skip"
            />
            <StatCard
              label="Duplicates"
              value={preview.duplicates}
              color="text-yellow-400"
              sub="in active campaign"
            />
            <StatCard
              label="Will Export"
              value={preview.willExport}
              color="text-green-400"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Selected" value={selectedIds.length} color="text-white" />
            <StatCard label="Suppressed" value="?" color="text-zinc-500" sub="run check" />
            <StatCard label="Duplicates" value="?" color="text-zinc-500" sub="run check" />
            <StatCard label="Will Export" value="?" color="text-zinc-500" sub="run check" />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Export button */}
      {!exportResult && (
        <Button
          type="button"
          onClick={handleExport}
          disabled={exporting || selectedIds.length === 0}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {exporting ? (
            <>
              <WolfLoader variant="spinner" size={16} mode="amber" className="mr-2" />
              Exporting {selectedIds.length} recipients...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export to Instantly ({preview ? preview.willExport : selectedIds.length} recipients)
            </>
          )}
        </Button>
      )}

      {/* Export result */}
      {exportResult && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-400">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Export Complete</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <span className="text-zinc-500">Exported:</span>{' '}
              <span className="text-white">{exportResult.exported}</span>
            </div>
            <div>
              <span className="text-zinc-500">Suppressed:</span>{' '}
              <span className="text-red-400">{exportResult.suppressed}</span>
            </div>
            <div>
              <span className="text-zinc-500">Duplicates:</span>{' '}
              <span className="text-yellow-400">{exportResult.duplicates}</span>
            </div>
            <div>
              <span className="text-zinc-500">Storage:</span>{' '}
              <span className="text-zinc-400 truncate">{exportResult.storage_path}</span>
            </div>
          </div>

          {exportResult.download_url && (
            <div className="flex gap-2">
              <a
                href={exportResult.download_url}
                download
                className="inline-flex items-center gap-1.5 rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </a>
              <button
                onClick={() => {
                  if (exportResult.download_url) {
                    navigator.clipboard.writeText(exportResult.download_url)
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Link
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string
  value: number | string
  color: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
      {sub && <div className="text-[10px] text-zinc-600">{sub}</div>}
    </div>
  )
}
