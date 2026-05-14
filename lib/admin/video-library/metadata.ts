/**
 * Video metadata types and helpers.
 * Actual ffprobe/ffmpeg runs on the VPS (Railway) via API call.
 * For the admin video library, we extract basic metadata client-side
 * from the File object and enrich server-side after upload.
 */

export interface VideoMetadata {
  duration_seconds: number | null
  width: number | null
  height: number | null
  aspect_ratio: string | null
  codec: string | null
  file_size_bytes: number
}

/**
 * Extract basic metadata from a video file using browser APIs.
 * Called client-side before upload to populate initial metadata.
 */
export function extractClientMetadata(file: File): Promise<Partial<VideoMetadata>> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      resolve({
        duration_seconds: Math.round(video.duration * 100) / 100,
        width: video.videoWidth,
        height: video.videoHeight,
        aspect_ratio: simplifyAspectRatio(video.videoWidth, video.videoHeight),
        file_size_bytes: file.size,
      })
      URL.revokeObjectURL(video.src)
    }

    video.onerror = () => {
      resolve({ file_size_bytes: file.size })
      URL.revokeObjectURL(video.src)
    }

    video.src = URL.createObjectURL(file)
  })
}

/**
 * Generate a thumbnail from a video file at a specific time.
 * Returns a Blob of the thumbnail image.
 */
export function generateThumbnailClient(file: File, timeSeconds = 1): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true

    video.onloadeddata = () => {
      video.currentTime = Math.min(timeSeconds, video.duration * 0.1)
    }

    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }

      ctx.drawImage(video, 0, 0)
      canvas.toBlob((blob) => {
        resolve(blob)
        URL.revokeObjectURL(video.src)
      }, 'image/webp', 0.8)
    }

    video.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(video.src)
    }

    video.src = URL.createObjectURL(file)
  })
}

function simplifyAspectRatio(w: number, h: number): string {
  if (!w || !h) return 'unknown'
  const ratio = w / h
  if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16'
  if (Math.abs(ratio - 1) < 0.05) return '1:1'
  if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3'
  return `${w}:${h}`
}
