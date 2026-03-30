import { useCallback } from 'react'
import { useVideoStore } from '@/stores/video-store'
import { useClipsStore, type GeneratedClip } from '@/stores/clips-store'
import { waitForVideoReady, pollClipRendering } from '@/lib/hooks/useVideoPolling'
import { parseSrtToWordTimestamps, parseSrt, srtToFullText, srtToTranscriptionSegments } from '@/lib/captions/srt-parser'

// ─── Import by URL ───────────────────────────────────────────────────────────

async function importUrl(url: string): Promise<string> {
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json() as { data: { video_id: string } | null; error: string | null; message: string }
  if (!res.ok || !data.data) throw new Error(data.message ?? 'Import failed')
  return data.data.video_id
}

// ─── Upload with XHR progress ───────────────────────────────────────────────

function uploadFile(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { data: { video_id: string } | null; error: string | null; message: string }
          if (data.data?.video_id) resolve(data.data.video_id)
          else reject(new Error(data.message || 'Upload failed'))
        } catch { reject(new Error('Invalid server response')) }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`))
      }
    })
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  })
}

// ─── Fetch video signed URL (non-blocking) ──────────────────────────────────

function fetchVideoUrl(videoId: string, setter: (url: string) => void) {
  fetch(`/api/videos/url?video_id=${videoId}`)
    .then((r) => r.json())
    .then((d: { data: { url: string } | null }) => { if (d.data?.url) setter(d.data.url) })
    .catch(() => null)
}

// ─── Fire render jobs ───────────────────────────────────────────────────────

async function fireRenderJobs(clips: GeneratedClip[], onlyPending = false) {
  const toRender = onlyPending ? clips.filter((c) => c.status !== 'done') : clips
  if (toRender.length === 0) return
  await Promise.allSettled(
    toRender.map((clip) =>
      fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id: clip.id }),
      })
    )
  )
}

// ─── Hook: useCreatePipeline ────────────────────────────────────────────────

interface CreatePipelineOpts {
  pendingFile: File | null
  url: string
  srtFile: File | null
  setVideoUrl: (url: string | null) => void
}

export function useCreatePipeline({ pendingFile, url, srtFile, setVideoUrl }: CreatePipelineOpts) {
  const { setCurrentVideoId, setProcessingStep, setUploadProgress, setErrorMessage, reset: resetVideo } = useVideoStore()
  const { setGeneratedClips, clearClips } = useClipsStore()

  const runPipeline = useCallback(async (sourceUrl?: string) => {
    const effectiveUrl = sourceUrl ?? (url && !pendingFile ? url : undefined)
    if (!pendingFile && !effectiveUrl) return

    setErrorMessage(null)
    clearClips()

    try {
      // Step 1 — Upload or URL import
      setProcessingStep('uploading')
      setUploadProgress(0)

      let videoId: string
      if (effectiveUrl) {
        videoId = await importUrl(effectiveUrl)
        setUploadProgress(30)
        await waitForVideoReady(videoId)
        setUploadProgress(100)
      } else {
        videoId = await uploadFile(pendingFile!, (pct) => setUploadProgress(pct))
        setUploadProgress(100)
      }
      setCurrentVideoId(videoId)
      fetchVideoUrl(videoId, (u) => setVideoUrl(u))

      // Step 2 — Transcription
      setProcessingStep('transcribing')

      if (srtFile) {
        const srtContent = await srtFile.text()
        const srtSegments = parseSrt(srtContent)
        const wordTimestamps = parseSrtToWordTimestamps(srtContent)
        const fullText = srtToFullText(srtSegments)
        const segments = srtToTranscriptionSegments(srtSegments)

        const transcribeRes = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: videoId,
            srt_data: { full_text: fullText, segments, word_timestamps: wordTimestamps },
          }),
        })
        const transcribeData = await transcribeRes.json() as { error: string | null; message: string }
        if (!transcribeRes.ok) throw new Error(transcribeData.message ?? 'SRT import failed')
      } else {
        const transcribeRes = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId }),
        })
        const transcribeData = await transcribeRes.json() as { error: string | null; message: string }
        if (!transcribeRes.ok) throw new Error(transcribeData.message ?? 'Transcription failed')
      }

      // Step 3 — Analyse IA
      setProcessingStep('analyzing')
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId }),
      })
      const analyzeData = await analyzeRes.json() as { error: string | null; message: string }
      if (!analyzeRes.ok) throw new Error(analyzeData.message ?? 'Analysis failed')

      // Step 4 — Fetch clips
      const clipsRes = await fetch(`/api/clips?video_id=${videoId}`)
      const clipsData = await clipsRes.json() as { data: GeneratedClip[] | null; error: string | null }
      if (!clipsRes.ok || !clipsData.data) throw new Error(clipsData.error ?? 'Failed to load clips')

      setGeneratedClips(clipsData.data)

      // Step 5 — Render + poll
      setProcessingStep('rendering')
      await fireRenderJobs(clipsData.data)

      const clipIds = clipsData.data.map((c) => c.id)
      const { allFinished } = await pollClipRendering(videoId, clipIds, setGeneratedClips)
      if (!allFinished) {
        console.warn('[create] Render polling timed out — some clips may still be processing')
      }
      setProcessingStep('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      setErrorMessage(msg)
      setProcessingStep('error')
    }
  }, [pendingFile, url, srtFile, setCurrentVideoId, setProcessingStep, setUploadProgress, setErrorMessage, clearClips, setGeneratedClips, setVideoUrl])

  return { runPipeline, resetVideo }
}
