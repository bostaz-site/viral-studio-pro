'use client'

import { useState } from 'react'
import { FileText, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'

interface GdprRequestsProps {
  onExport: (email: string) => Promise<void>
  onDelete: (email: string) => Promise<void>
}

export function GdprRequests({ onExport, onDelete }: GdprRequestsProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleExport = async () => {
    if (!email.trim()) return
    setLoading(true)
    setResult(null)
    try {
      await onExport(email.trim())
      setResult({ type: 'success', message: 'GDPR data export completed. Check browser download.' })
    } catch {
      setResult({ type: 'error', message: 'Export failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!email.trim() || !confirmDelete) return
    setLoading(true)
    setResult(null)
    try {
      await onDelete(email.trim())
      setResult({ type: 'success', message: 'All data deleted and email added to suppression list.' })
      setConfirmDelete(false)
      setEmail('')
    } catch {
      setResult({ type: 'error', message: 'Deletion failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">GDPR / Data Requests</h3>

      <div className="space-y-3">
        <input
          type="email"
          placeholder="Enter email to export or delete..."
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={loading || !email.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 text-purple-400 text-xs rounded-md hover:bg-purple-500/25 transition-colors disabled:opacity-50"
          >
            <FileText className="h-3.5 w-3.5" />
            Export Data
          </button>

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={loading || !email.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 text-red-400 text-xs rounded-md hover:bg-red-500/25 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete All Data
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {loading ? <WolfLoader variant="spinner" size={14} mode="amber" /> : <Trash2 className="h-3.5 w-3.5" />}
              Confirm Delete (irreversible)
            </button>
          )}
        </div>

        {result && (
          <div className={`flex items-center gap-2 text-xs p-2 rounded ${
            result.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {result.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {result.message}
          </div>
        )}
      </div>
    </div>
  )
}
