"use client"

import { useCallback, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { UploadCloud, FileVideo, X, Link as LinkIcon, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB
const ACCEPTED_TYPES = { 'video/*': ['.mp4', '.mov', '.mkv', '.avi', '.webm'] }

type UploadState = 'idle' | 'selected' | 'uploading' | 'success' | 'error'

interface UploadZoneProps {
  selectedFile: File | null
  onFileSelect: (file: File) => void
  onFileClear: () => void
  uploadProgress: number
  isUploading: boolean
  uploadError?: string | null
  uploadSuccess?: boolean
  url: string
  onUrlChange: (url: string) => void
  onUrlImport?: (url: string) => void
  disabled?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadZone({
  selectedFile,
  onFileSelect,
  onFileClear,
  uploadProgress,
  isUploading,
  uploadError,
  uploadSuccess,
  url,
  onUrlChange,
  onUrlImport,
  disabled = false,
}: UploadZoneProps) {
  const [dropError, setDropError] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[], rejections: FileRejection[]) => {
      setDropError(null)
      if (rejections.length > 0) {
        const r = rejections[0]
        const code = r.errors[0]?.code
        if (code === 'file-too-large') {
          setDropError('File too large — maximum size is 500 MB')
        } else if (code === 'file-invalid-type') {
          setDropError('Invalid file type — use MP4, MOV, MKV, AVI, or WebM')
        } else {
          setDropError(r.errors[0]?.message ?? 'Invalid file')
        }
        return
      }
      if (acceptedFiles[0]) onFileSelect(acceptedFiles[0])
    },
    [onFileSelect]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    disabled: disabled || isUploading,
  })

  // Determine visual state
  const state: UploadState = uploadSuccess ? 'success'
    : (uploadError || dropError) ? 'error'
    : isUploading ? 'uploading'
    : selectedFile ? 'selected'
    : 'idle'

  const errorMsg = uploadError || dropError

  return (
    <div className="space-y-4">
      {/* Drop zone / file preview */}
      {selectedFile || state === 'success' ? (
        <div className={cn(
          'rounded-xl border p-4 transition-all duration-300',
          state === 'success' ? 'border-emerald-500/40 bg-emerald-500/5' :
          state === 'error' ? 'border-destructive/40 bg-destructive/5' :
          'border-primary/40 bg-primary/5'
        )}>
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg shrink-0',
              state === 'success' ? 'bg-emerald-500/10' :
              state === 'error' ? 'bg-destructive/10' :
              'bg-primary/10'
            )}>
              {state === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : state === 'error' ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <FileVideo className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {state === 'success' ? (
                <p className="text-sm font-medium text-emerald-400">Redirecting to editor...</p>
              ) : (
                <>
                  <p className="text-sm font-medium truncate text-foreground">{selectedFile?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedFile ? formatBytes(selectedFile.size) : ''}</p>
                </>
              )}

              {/* Error message */}
              {state === 'error' && errorMsg && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-xs text-destructive flex-1">{errorMsg}</p>
                  <button
                    onClick={() => { setDropError(null); onFileClear() }}
                    className="text-xs text-destructive/80 hover:text-destructive flex items-center gap-1 shrink-0"
                  >
                    <RotateCcw className="h-3 w-3" /> Retry
                  </button>
                </div>
              )}

              {/* Progress bar */}
              {state === 'uploading' && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            {state === 'selected' && (
              <button
                onClick={() => { setDropError(null); onFileClear() }}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200',
              isDragActive
                ? 'border-orange-400 bg-orange-500/5 scale-[1.01]'
                : 'border-muted hover:border-primary/50 hover:bg-muted/30',
              disabled && 'pointer-events-none opacity-50'
            )}
          >
            <input {...getInputProps()} />
            <div className={cn('p-3 rounded-full mb-3 transition-colors', isDragActive ? 'bg-orange-500/10' : 'bg-muted')}>
              <UploadCloud className={cn('h-7 w-7', isDragActive ? 'text-orange-400' : 'text-muted-foreground')} />
            </div>
            <p className="font-semibold text-sm mb-1">
              {isDragActive ? 'Drop your clip here' : 'Drop your clip here or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mb-3">MP4, MOV, MKV, AVI, WebM — max 500 MB</p>
            <Button variant="secondary" size="sm" type="button" disabled={disabled}>
              Select file
            </Button>
          </div>
          {/* Client-side drop rejection error */}
          {dropError && !selectedFile && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{dropError}</span>
            </div>
          )}
        </>
      )}

      {/* URL divider + input */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground font-medium px-1">or import by URL</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && url && onUrlImport) onUrlImport(url) }}
            className="pl-9 bg-background/50 h-10"
            disabled={disabled || isUploading || !!selectedFile}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-10 px-4 shrink-0"
          disabled={!url || disabled || isUploading || !!selectedFile}
          onClick={() => url && onUrlImport?.(url)}
        >
          Import
        </Button>
      </div>
    </div>
  )
}
