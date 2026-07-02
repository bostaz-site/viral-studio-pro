'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Film } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UploadZone } from '@/components/video/upload-zone'
import { ViralAnimalLogo } from '@/components/brand/viral-animal-logo'
import { isAuditMode } from '@/lib/feature-flags'

export function UploadPageClient() {
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedBytes, setUploadedBytes] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [url, setUrl] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  // Track pre-created videoId so we can reuse on retry or clean up on abandon
  const lastVideoIdRef = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setIsAuthenticated(d.isAdmin !== undefined))
      .catch(() => setIsAuthenticated(false))
  }, [])

  const handleFileSelect = useCallback(
    async (file: File) => {
      setSelectedFile(file)
      setUploadError(null)
      setUploadSuccess(false)
      setIsUploading(true)
      setUploadProgress(0)
      setUploadedBytes(0)

      try {
        // Step 1: Get signed upload URL
        // If we have a leftover videoId from a failed attempt, pass it so the API can reuse it
        const signBody: Record<string, unknown> = {
          filename: file.name,
          contentType: file.type || 'video/mp4',
          fileSize: file.size,
        }
        if (lastVideoIdRef.current) {
          signBody.existingVideoId = lastVideoIdRef.current
        }

        const signRes = await fetch('/api/upload/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signBody),
        })

        const signJson = await signRes.json()
        if (!signRes.ok || signJson.error) {
          setUploadError(signJson.message ?? signJson.error ?? 'Failed to prepare upload')
          setIsUploading(false)
          return
        }

        const { signedUrl, videoId } = signJson.data
        lastVideoIdRef.current = videoId

        // Step 2: Upload file directly to Supabase Storage via signed URL
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', signedUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
            setUploadedBytes(e.loaded)
          }
        })

        xhr.addEventListener('load', async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Step 3: Confirm upload completed
            try {
              const completeRes = await fetch('/api/upload/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId }),
              })
              if (!completeRes.ok) {
                const cj = await completeRes.json().catch(() => null)
                setUploadError(cj?.message ?? 'Failed to confirm upload — please retry')
                setIsUploading(false)
                return
              }
            } catch {
              setUploadError('Failed to confirm upload — please retry')
              setIsUploading(false)
              return
            }

            setUploadSuccess(true)
            setIsUploading(false)
            lastVideoIdRef.current = null
            setTimeout(() => {
              router.push(`/dashboard/enhance/${videoId}?source=upload`)
            }, 800)
          } else {
            setUploadError('Upload to storage failed — please try again')
            setIsUploading(false)
          }
        })

        xhr.addEventListener('error', () => {
          setUploadError('Network error — please try again')
          setIsUploading(false)
        })

        xhr.send(file)
      } catch {
        setUploadError('Unexpected error — please try again')
        setIsUploading(false)
      }
    },
    [router]
  )

  const handleFileClear = () => {
    // If there's an orphaned video record, clean it up
    if (lastVideoIdRef.current) {
      fetch(`/api/upload/sign?videoId=${lastVideoIdRef.current}`, { method: 'DELETE' }).catch(() => {})
      lastVideoIdRef.current = null
    }
    setSelectedFile(null)
    setUploadError(null)
    setUploadSuccess(false)
    setUploadProgress(0)
    setUploadedBytes(0)
  }

  // Retry: re-upload the same file without clearing it
  const handleRetry = useCallback(() => {
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }, [selectedFile, handleFileSelect])

  const isLargeFile = selectedFile && selectedFile.size > 200 * 1024 * 1024

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-16 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <ViralAnimalLogo size={32} />
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/20 mb-5">
              <Film className="h-7 w-7 text-orange-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Upload Your Clip
            </h1>
            <p className="text-muted-foreground mt-3 text-base max-w-md mx-auto">
              Upload your video and enhance it with AI captions, split-screen, and more
            </p>
          </div>

          <div className="bg-card/50 border border-border rounded-2xl p-6">
            <UploadZone
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onFileClear={handleFileClear}
              onRetry={handleRetry}
              uploadProgress={uploadProgress}
              uploadedBytes={uploadedBytes}
              isUploading={isUploading}
              uploadError={uploadError}
              uploadSuccess={uploadSuccess}
              url={url}
              onUrlChange={setUrl}
              hideUrlImport={isAuditMode}
            />
          </div>

          {isLargeFile && isUploading && (
            <p className="text-xs text-amber-400/80 text-center mt-3">
              Large file — this may take a few minutes. Safe to leave this tab open.
            </p>
          )}

          <p className="text-xs text-muted-foreground/60 text-center mt-4">
            Accepted: MP4, MOV, MKV, AVI, WebM &middot; Max 2 GB
          </p>

          {!isAuditMode && (
            <div className="text-center mt-8 pt-6 border-t border-border/30">
              <p className="text-sm text-muted-foreground mb-3">
                Don&apos;t have a clip yet?
              </p>
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="gap-2">
                  Browse trending clips
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
