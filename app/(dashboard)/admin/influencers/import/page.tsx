'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { ArrowLeft, FileSpreadsheet, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { autoDetectMapping, applyMapping, type InfluencerCSVRow } from '@/lib/admin/csv-parser'
import { CSVUploader } from './_components/csv-uploader'
import { ColumnMapper } from './_components/column-mapper'
import { ImportPreview } from './_components/import-preview'
import { ImportProgress } from './_components/import-progress'
import { ImportResult } from './_components/import-result'
import Link from 'next/link'

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done'

interface ImportResultData {
  batchId: string
  status: string
  imported: number
  duplicates: number
  suppressed: number
  failed: number
  errors: { row: number; message: string }[]
}

interface BatchStatus {
  rows_total: number
  rows_imported: number
  rows_skipped_duplicate: number
  rows_skipped_suppression: number
  rows_failed: number
  status: string
}

export default function ImportPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  // Wizard state
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validRows, setValidRows] = useState<InfluencerCSVRow[]>([])
  const [validationErrors, setValidationErrors] = useState<{ row: number; message: string }[]>([])
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null)
  const [importResult, setImportResult] = useState<ImportResultData | null>(null)
  const [importing, setImporting] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => {
          if (!d.isAdmin) { router.push('/dashboard'); return }
          setAuthorized(true)
          setAuthLoading(false)
        })
        .catch(() => router.push('/dashboard'))
    })
  }, [router])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  // Step 1: Parse CSV
  const handleFileAccepted = useCallback((file: File) => {
    setFileName(file.name)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? []
        const rows = results.data as Record<string, string>[]
        setCsvHeaders(headers)
        setRawRows(rows)
        setMapping(autoDetectMapping(headers))
        setStep('map')
      },
      error: () => {
        // Show error via validation
        setValidationErrors([{ row: 0, message: 'Failed to parse CSV file' }])
      },
    })
  }, [])

  // Step 2 -> 3: Apply mapping and validate
  const handleProceedToPreview = useCallback(() => {
    const { valid, errors } = applyMapping(rawRows, mapping)
    setValidRows(valid)
    setValidationErrors(errors)
    setStep('preview')
  }, [rawRows, mapping])

  // Step 3 -> 4: Start import
  const handleStartImport = useCallback(async () => {
    if (validRows.length === 0) return
    setStep('importing')
    setImporting(true)
    setBatchStatus(null)

    try {
      const res = await fetch('/api/admin/influencers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows, fileName }),
      })

      const json = await res.json()

      if (!res.ok) {
        setImportResult({
          batchId: '',
          status: 'failed',
          imported: 0,
          duplicates: 0,
          suppressed: 0,
          failed: validRows.length,
          errors: [{ row: 0, message: json.error ?? 'Import failed' }],
        })
        setStep('done')
        setImporting(false)
        return
      }

      const result = json.data
      setImportResult(result)
      setBatchStatus({
        rows_total: validRows.length,
        rows_imported: result.imported,
        rows_skipped_duplicate: result.duplicates,
        rows_skipped_suppression: result.suppressed,
        rows_failed: result.failed,
        status: result.status,
      })
      setStep('done')
    } catch {
      setImportResult({
        batchId: '',
        status: 'failed',
        imported: 0,
        duplicates: 0,
        suppressed: 0,
        failed: validRows.length,
        errors: [{ row: 0, message: 'Network error' }],
      })
      setStep('done')
    } finally {
      setImporting(false)
    }
  }, [validRows, fileName])

  // Reset
  const handleReset = useCallback(() => {
    setStep('upload')
    setFileName('')
    setCsvHeaders([])
    setRawRows([])
    setMapping({})
    setValidRows([])
    setValidationErrors([])
    setBatchStatus(null)
    setImportResult(null)
  }, [])

  const emailMapped = Object.values(mapping).includes('email')

  if (authLoading || !authorized) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin/influencers/imports">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import CSV</h1>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file to bulk-import influencers into the CRM.
          </p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-xs">
        {(['upload', 'map', 'preview', 'importing', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-border" />}
            <span className={`px-2 py-1 rounded-md ${
              step === s ? 'bg-primary text-primary-foreground font-medium' :
              (['upload', 'map', 'preview', 'importing', 'done'].indexOf(step) > i)
                ? 'bg-muted text-foreground' : 'bg-muted/50 text-muted-foreground'
            }`}>
              {['Upload', 'Map', 'Preview', 'Import', 'Done'][i]}
            </span>
          </div>
        ))}
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {step === 'upload' && 'Upload CSV File'}
            {step === 'map' && `Column Mapping - ${fileName}`}
            {step === 'preview' && `Preview - ${validRows.length} rows ready`}
            {step === 'importing' && 'Importing...'}
            {step === 'done' && 'Import Complete'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'upload' && (
            <CSVUploader onFileAccepted={handleFileAccepted} />
          )}

          {step === 'map' && (
            <div className="space-y-4">
              <ColumnMapper
                csvHeaders={csvHeaders}
                mapping={mapping}
                onMappingChange={setMapping}
                previewRows={rawRows.slice(0, 3)}
              />
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Back
                </Button>
                <Button onClick={handleProceedToPreview} disabled={!emailMapped}>
                  Preview Import
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <ImportPreview
                validRows={validRows}
                validationErrors={validationErrors}
                totalParsed={rawRows.length}
              />
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('map')}>
                  Back to Mapping
                </Button>
                <Button
                  onClick={handleStartImport}
                  disabled={validRows.length === 0 || importing}
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${validRows.length} rows`
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <ImportProgress batch={batchStatus} isPolling={false} />
          )}

          {step === 'done' && importResult && (
            <ImportResult result={importResult} onReset={handleReset} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
