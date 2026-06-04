'use client'

import { useState, useCallback, useEffect } from 'react'
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
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [url, setUrl] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  // Check auth status on mount (non-blocking)
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

      try {
        // Step 1: Get signed upload URL from our API
        const signRes = await fetch('/api/upload/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || 'video/mp4',
            fileSize: file.size,
          }),
        })

        const signJson = await signRes.json()
        if (!signRes.ok || signJson.error) {
          setUploadError(signJson.message ?? signJson.error ?? 'Failed to prepare upload')
          setIsUploading(false)
          return
        }

        const { signedUrl, videoId } = signJson.data

        // Step 2: Upload file directly to Supabase Storage via signed URL
        // Use XHR for progress tracking
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', signedUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadSuccess(true)
            setIsUploading(false)
            setTimeout(() => {
              // Authenticated → editor; anonymous → signup with redirect
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
    setSelectedFile(null)
    setUploadError(null)
    setUploadSuccess(false)
    setUploadProgress(0)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Simple nav */}
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

      {/* Main content */}
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

          {/* Upload zone */}
          <div className="bg-card/50 border border-border rounded-2xl p-6">
            <UploadZone
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onFileClear={handleFileClear}
              uploadProgress={uploadProgress}
              isUploading={isUploading}
              uploadError={uploadError}
              uploadSuccess={uploadSuccess}
              url={url}
              onUrlChange={setUrl}
            />
          </div>

          {/* Accepted formats */}
          <p className="text-xs text-muted-foreground/60 text-center mt-4">
            Accepted: MP4, MOV &middot; Max 500 MB
          </p>

          {/* Secondary CTA — hidden in audit mode */}
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
