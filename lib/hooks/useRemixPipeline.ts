import { useCallback } from 'react'
import { useVideoStore } from '@/stores/video-store'
import { useClipsStore, type GeneratedClip } from '@/stores/clips-store'
import { waitForVideoReady, pollClipRendering } from '@/lib/hooks/useVideoPolling'

// ─── Hook: useRemixPipeline ─────────────────────────────────────────────────

export function useRemixPipeline(setVideoUrl: (url: string | null) => void) {
  const { setCurrentVideoId, setProcessingStep, setUploadProgress, setErrorMessage } = useVideoStore()
  const { generatedClips, setGeneratedClips, clearClips } = useClipsStore()

  const fetchVideoUrl = (videoId: string) => {
    fetch(`/api/videos/url?video_id=${videoId}`)
      .then((r) => r.json())
      .then((d: { data: { url: string } | null }) => { if (d.data?.url) setVideoUrl(d.data.url) })
      .catch(() => null)
  }

  const runRemixPipeline = useCallback(async (videoId: string) => {
    setErrorMessage(null)
    clearClips()
    setCurrentVideoId(videoId)

    try {
      // Step 1 — Wait for VPS download
      setProcessingStep('uploading')
      setUploadProgress(30)
      await waitForVideoReady(videoId)
      setUploadProgress(100)

      fetchVideoUrl(videoId)

      // Step 2 — Transcription
      setProcessingStep('transcribing')
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId }),
      })
      const transcribeData = await transcribeRes.json() as { error: string | null; message: string }
      if (!transcribeRes.ok) throw new Error(transcribeData.message ?? 'Transcription failed')

      // Step 3 — Analyse IA
      setProcessingStep('analyzing')
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId }),
      })
      const analyzeData = await analyzeRes.json() as { error: string | null; message: string }
      if (!analyzeRes.ok) throw new Error(analyzeData.message ?? 'Analysis failed')

      // Step 4 — Fetch clips + fire render
      const clipsRes = await fetch(`/api/clips?video_id=${videoId}`)
      const clipsData = await clipsRes.json() as { data: GeneratedClip[] | null; error: string | null }
      if (!clipsRes.ok || !clipsData.data) throw new Error(clipsData.error ?? 'Failed to load clips')

      setGeneratedClips(clipsData.data)
      setProcessingStep('rendering')

      const clipsToRender = clipsData.data.filter((c) => c.status !== 'done')
      if (clipsToRender.length > 0) {
        await Promise.allSettled(
          clipsToRender.map((clip) =>
            fetch('/api/render', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clip_id: clip.id }),
            })
          )
        )
      }

      // Poll until all clips are terminal
      const clipIds = clipsData.data.map((c) => c.id)
      await pollClipRendering(videoId, clipIds, setGeneratedClips)

      setProcessingStep('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      setErrorMessage(msg)
      setProcessingStep('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCurrentVideoId, setProcessingStep, setUploadProgress, setErrorMessage, clearClips, setGeneratedClips])

  const loadExistingVideo = useCallback(async (videoId: string) => {
    try {
      setCurrentVideoId(videoId)
      fetchVideoUrl(videoId)

      const clipsRes = await fetch(`/api/clips?video_id=${videoId}`)
      const clipsData = await clipsRes.json() as { data: GeneratedClip[] | null; error: string | null }

      if (clipsData.data && clipsData.data.length > 0) {
        setGeneratedClips(clipsData.data)
        const allTerminal = clipsData.data.every((c) => c.status === 'done' || c.status === 'error')
        if (allTerminal) {
          setProcessingStep('done')
        } else {
          setProcessingStep('rendering')
          const clipIds = clipsData.data.map((c) => c.id)
          await pollClipRendering(videoId, clipIds, setGeneratedClips)
          setProcessingStep('done')
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du chargement'
      setErrorMessage(msg)
      setProcessingStep('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCurrentVideoId, setProcessingStep, setErrorMessage, setGeneratedClips])

  return { runRemixPipeline, loadExistingVideo, generatedClips }
}
