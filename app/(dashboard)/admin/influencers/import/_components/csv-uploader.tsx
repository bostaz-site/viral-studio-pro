'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet } from 'lucide-react'

interface CSVUploaderProps {
  onFileAccepted: (file: File) => void
  disabled?: boolean
}

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export function CSVUploader({ onFileAccepted, disabled }: CSVUploaderProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onFileAccepted(accepted[0])
    },
    [onFileAccepted]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    maxSize: MAX_SIZE,
    disabled,
  })

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={`
          flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="rounded-full bg-muted p-3">
          {isDragActive ? (
            <FileSpreadsheet className="h-8 w-8 text-primary" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {isDragActive ? 'Drop your CSV here' : 'Drag & drop a CSV file'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            or click to browse (max 10 MB)
          </p>
        </div>
      </div>
      {fileRejections.length > 0 && (
        <p className="text-xs text-destructive">
          {fileRejections[0].errors[0]?.message ?? 'Invalid file'}
        </p>
      )}
    </div>
  )
}
