import type { GeneratedClip } from '@/stores/clips-store'

// ─── Generic polling utility ─────────────────────────────────────────────────

interface PollOptions {
  intervalMs?: number
  maxWaitMs?: number
  signal?: { cancelled: boolean }
}

async function pollUntil<T>(
  fetcher: () => Promise<T>,
  isComplete: (data: T) => boolean,
  opts: PollOptions = {},
): Promise<T | null> {
  const { intervalMs = 4_000, maxWaitMs = 600_000, signal } = opts
  const start = Date.now()

  while (Date.now() - start < maxWaitMs) {
    if (signal?.cancelled) return null
    await new Promise((r) => setTimeout(r, intervalMs))
    if (signal?.cancelled) return null

    try {
      const data = await fetcher()
      if (isComplete(data)) return data
    } catch {
      // network error — keep trying
    }
  }

  return null
}

// ─── Poll video status until VPS finishes downloading ────────────────────────

export async function waitForVideoReady(videoId: string, maxWaitMs = 600_000): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 4_000))

    const res = await fetch(`/api/videos/status?video_id=${videoId}`)
    if (!res.ok) continue

    const { data } = await res.json() as { data: { status: string; error_message?: string } | null }
    if (!data) continue

    if (data.status === 'uploaded' || data.status === 'transcribing' || data.status === 'analyzing' || data.status === 'done') {
      return
    }
    if (data.status === 'error') {
      throw new Error(data.error_message || 'Le téléchargement de la vidéo a échoué sur le serveur')
    }
  }

  throw new Error('Le téléchargement prend trop de temps (> 10 min). Réessayez plus tard.')
}

// ─── Poll clip rendering status ──────────────────────────────────────────────

interface PollClipsResult {
  clips: GeneratedClip[]
  allFinished: boolean
}

export async function pollClipRendering(
  videoId: string,
  clipIds: string[],
  onUpdate: (clips: GeneratedClip[]) => void,
  opts: PollOptions = {},
): Promise<PollClipsResult> {
  const { intervalMs = 4_000, maxWaitMs = 600_000, signal } = opts

  const result = await pollUntil<GeneratedClip[]>(
    async () => {
      const res = await fetch(`/api/clips?video_id=${videoId}`)
      const data = await res.json() as { data: GeneratedClip[] | null }
      if (!data.data) throw new Error('no data')
      onUpdate(data.data)
      return data.data
    },
    (clips) => {
      const tracked = clipIds.length > 0
        ? clips.filter((c) => clipIds.includes(c.id))
        : clips
      return tracked.every((c) => c.status === 'done' || c.status === 'error')
    },
    { intervalMs, maxWaitMs, signal },
  )

  return {
    clips: result ?? [],
    allFinished: result !== null,
  }
}
