"use client"

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, FileVideo, X, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface UploadZoneProps {
  selectedFile: File | null
  onFileSelect: (file: File) => void
  onFileClear: () => void
  uploadProgress: number
  isUploading: boolean
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
  url,
  onUrlChange,
  onUrlImport,
  disabled = false,
}: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) onFileSelect(acceptedFiles[0])
    },
    [onFileSelect]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.mkv', '.avi'] },
    maxFiles: 1,
    disabled: disabled || isUploading,
  })

  return (
    <div className="space-y-4">
      {/* Drop zone / file preview */}
      {selectedFile ? (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <FileVideo className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(selectedFile.size)}</p>

              {/* Progress bar */}
              {isUploading && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Upload en cours…</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            {!isUploading && (
              <button
                onClick={onFileClear}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Supprimer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-muted hover:border-primary/50 hover:bg-muted/30',
            disabled && 'pointer-events-none opacity-50'
          )}
        >
          <input {...getInputProps()} />
          <div className="p-3 bg-muted rounded-full mb-3">
            <UploadCloud className={cn('h-7 w-7', isDragActive ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <p className="font-semibold text-sm mb-1">
            {isDragActive ? 'Déposez ici' : 'Cliquez ou glissez-déposez'}
          </p>
          <p className="text-xs text-muted-foreground mb-3">MP4, MOV, MKV, AVI — max 500 MB</p>
          <Button variant="secondary" size="sm" type="button" disabled={disabled}>
            Sélectionner un fichier
          </Button>
        </div>
      )}

      {/* URL divider + input */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground font-medium px-1">ou importer par URL</span>
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
          Importer
        </Button>
      </div>
    </div>
  )
}
