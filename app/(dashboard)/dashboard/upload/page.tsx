"use client"

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  UploadCloud, FileVideo, X, Loader2, CheckCircle2,
  Sparkles, ArrowRight, Film,
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPage() {
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setSelectedFile(acceptedFiles[0])
      setError(null)
      // Auto-fill title from filename if empty
      if (!title) {
        const name = acceptedFiles[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        setTitle(name)
      }
    }
  }, [title])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.mkv', '.avi', '.webm'] },
    maxFiles: 1,
    disabled: uploading,
    maxSize: 500 * 1024 * 1024,
  })

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('title', title || selectedFile.name)

      // Simulate progress (real XHR progress would need XMLHttpRequest)
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 5, 90))
      }, 300)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.message || 'Upload failed')
        setUploading(false)
        setUploadProgress(0)
        return
      }

      setUploadProgress(100)
      setUploadedVideoId(data.data.id)
      setUploading(false)
    } catch {
      setError('Network error — please try again')
      setUploading(false)
      setUploadProgress(0)
    }
  }, [selectedFile, title])

  const handleClear = useCallback(() => {
    setSelectedFile(null)
    setTitle('')
    setError(null)
    setUploadProgress(0)
    setUploadedVideoId(null)
  }, [])

  // Success state — video uploaded, redirect to enhance
  if (uploadedVideoId) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-6 animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Upload complete!</h2>
          <p className="text-muted-foreground mt-2">
            Your clip is ready to enhance. Add captions, split-screen, hooks and more.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold shadow-lg shadow-orange-500/25"
            onClick={() => router.push(`/dashboard/enhance/${uploadedVideoId}?source=upload`)}
          >
            <Sparkles className="h-5 w-5" />
            Enhance this clip
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={handleClear}
          >
            <UploadCloud className="h-4 w-4" />
            Upload another clip
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Film className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Upload your clip</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Upload your own video and boost its virality with karaoke captions, split-screen, hooks and more.
        </p>
      </div>

      {/* Upload zone */}
      <div className="space-y-4">
        {selectedFile ? (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-xl shrink-0">
                <FileVideo className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold truncate text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{formatBytes(selectedFile.size)}</p>

                {/* Progress bar during upload */}
                {uploading && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              {!uploading && (
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Remove"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200',
              isDragActive
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-muted hover:border-primary/50 hover:bg-muted/30'
            )}
          >
            <input {...getInputProps()} />
            <div className="p-4 bg-muted rounded-full mb-4">
              <UploadCloud className={cn('h-10 w-10', isDragActive ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <p className="font-semibold text-lg mb-1">
              {isDragActive ? 'Drop your video here' : 'Click or drag & drop'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">MP4, MOV, MKV, AVI, WebM — max 500 MB</p>
            <Button variant="secondary" size="default" type="button">
              Select file
            </Button>
          </div>
        )}

        {/* Title input */}
        {selectedFile && !uploading && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
            <label className="text-sm font-medium text-foreground">Clip title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My epic clip..."
              className="bg-background/50 h-11"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-3">
            <X className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Upload button */}
        {selectedFile && !uploading && (
          <Button
            size="lg"
            className="w-full h-14 text-base font-bold gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-xl"
            onClick={handleUpload}
          >
            <UploadCloud className="h-5 w-5" />
            Upload & enhance
          </Button>
        )}

        {uploading && (
          <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading your clip...
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground font-medium px-2">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Browse trending option */}
      <div className="text-center">
        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          onClick={() => router.push('/dashboard')}
        >
          <Sparkles className="h-4 w-4" />
          Browse trending clips instead
        </Button>
      </div>
    </div>
  )
}
