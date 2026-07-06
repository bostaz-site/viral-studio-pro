'use client'

import { useState, useRef } from 'react'
import { X, Upload, Film, Check } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { extractClientMetadata, generateThumbnailClient } from '@/lib/admin/video-library/metadata'

interface UploadDialogProps {
  onClose: () => void
  onUploaded: () => void
}

const NICHES = [
  'ai_tools', 'productivity', 'gaming', 'creator_tools', 'side_hustle',
  'app_reviews', 'editing', 'streaming', 'business', 'education',
]

const HOOK_TYPES = [
  { value: 'curiosity', label: 'Curiosity' },
  { value: 'shock', label: 'Shock' },
  { value: 'transformation', label: 'Transformation' },
  { value: 'social_proof', label: 'Social Proof' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'testimonial', label: 'Testimonial' },
]

const TONES = [
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'funny', label: 'Funny' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'edgy', label: 'Edgy' },
]

type Step = 'select' | 'uploading' | 'metadata' | 'saving'

export function UploadDialog({ onClose, onUploaded }: UploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('select')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [storagePath, setStoragePath] = useState('')
  const [thumbnailPath, setThumbnailPath] = useState<string | null>(null)

  // Metadata form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedNiches, setSelectedNiches] = useState<string[]>([])
  const [hookType, setHookType] = useState('')
  const [tone, setTone] = useState('')
  const [language, setLanguage] = useState('en')
  const [videoMeta, setVideoMeta] = useState<{
    duration_seconds?: number | null
    width?: number | null
    height?: number | null
    aspect_ratio?: string | null
    file_size_bytes?: number
  }>({})

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))

    // Extract client-side metadata
    const meta = await extractClientMetadata(f)
    setVideoMeta(meta)

    // Start upload
    setStep('uploading')
    try {
      // 1. Get signed URL
      const urlRes = await fetch('/api/admin/video-library/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: f.name }),
      })
      const urlJson = await urlRes.json()
      if (!urlJson.data) throw new Error(urlJson.error || 'Failed to get upload URL')

      const { signedUrl, storagePath: path } = urlJson.data
      setStoragePath(path)

      // 2. Upload file directly to Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': f.type || 'video/mp4' },
        body: f,
      })

      if (!uploadRes.ok) throw new Error('Upload failed')
      setProgress(80)

      // 3. Generate and upload thumbnail client-side
      const thumbBlob = await generateThumbnailClient(f, 1)
      if (thumbBlob) {
        const thumbFilename = path.replace(/\.[^.]+$/, '_thumb.webp').replace('originals/', 'thumbnails/')
        const thumbUrlRes = await fetch('/api/admin/video-library/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: thumbFilename }),
        })
        const thumbUrlJson = await thumbUrlRes.json()
        if (thumbUrlJson.data) {
          await fetch(thumbUrlJson.data.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/webp' },
            body: thumbBlob,
          })
          setThumbnailPath(thumbUrlJson.data.storagePath)
        }
      }

      setProgress(100)
      setStep('metadata')
    } catch (err) {
      console.error('Upload error:', err)
      setStep('select')
    }
  }

  const handleSave = async () => {
    setStep('saving')
    try {
      const res = await fetch('/api/admin/video-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          storage_path: storagePath,
          thumbnail_path: thumbnailPath,
          niche: selectedNiches,
          hook_type: hookType || null,
          tone: tone || null,
          language,
          ...videoMeta,
        }),
      })

      const json = await res.json()
      if (json.error) throw new Error(json.error)

      onUploaded()
      onClose()
    } catch (err) {
      console.error('Save error:', err)
      setStep('metadata')
    }
  }

  const toggleNiche = (n: string) => {
    setSelectedNiches(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-medium text-zinc-200">Upload Promo Video</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Step: Select file */}
          {step === 'select' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:border-amber-500/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-zinc-500 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">Click or drag to upload a video</p>
              <p className="text-xs text-zinc-600 mt-1">MP4, MOV, WebM — max 100MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Step: Uploading */}
          {step === 'uploading' && (
            <div className="text-center py-8">
              <WolfLoader variant="spinner" size={32} mode="amber" />
              <p className="text-sm text-zinc-300">Uploading {file?.name}...</p>
              <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-4">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Step: Metadata */}
          {step === 'metadata' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <Check className="h-4 w-4" />
                <span className="text-xs">Upload complete</span>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>

              {/* Niches */}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Niches (multi-select)</label>
                <div className="flex flex-wrap gap-1.5">
                  {NICHES.map(n => (
                    <button
                      key={n}
                      onClick={() => toggleNiche(n)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        selectedNiches.includes(n)
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      {n.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hook type + Tone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Hook Type</label>
                  <select
                    value={hookType}
                    onChange={(e) => setHookType(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {HOOK_TYPES.map(h => (
                      <option key={h.value} value={h.value}>{h.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {TONES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                  <option value="pt">Portuguese</option>
                </select>
              </div>

              {/* Video metadata preview */}
              {videoMeta.duration_seconds && (
                <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-500 space-y-1">
                  <p>Duration: {String(videoMeta.duration_seconds)}s</p>
                  <p>Resolution: {String(videoMeta.width)}x{String(videoMeta.height)} ({String(videoMeta.aspect_ratio)})</p>
                  <p>Size: {((Number(videoMeta.file_size_bytes) || 0) / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={!title}
                className="w-full py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                Save Video
              </button>
            </div>
          )}

          {/* Step: Saving */}
          {step === 'saving' && (
            <div className="text-center py-8">
              <WolfLoader variant="spinner" size={24} mode="amber" />
              <p className="text-sm text-zinc-400">Saving...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
