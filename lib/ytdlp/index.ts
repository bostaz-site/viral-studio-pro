import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import os from 'os'
import { existsSync, unlinkSync } from 'fs'

const execAsync = promisify(exec)

export interface DownloadResult {
  title: string
  platform: string
  localPath: string
  duration: number
  thumbnailUrl: string | null
  authorName: string | null
  authorHandle: string | null
}

interface YtdlpInfo {
  title: string
  extractor_key: string
  duration: number
  thumbnail: string
  uploader: string
  uploader_id: string
}

/**
 * Validates a URL for yt-dlp (basic shell injection prevention).
 */
function validateUrl(url: string): string {
  const trimmed = url.trim()
  // Allow only http/https URLs
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('URL invalide : seuls les liens http/https sont acceptés')
  }
  // Reject shell metacharacters
  if (/[;&|`$\\\n\r]/.test(trimmed)) {
    throw new Error('URL invalide : caractères non autorisés')
  }
  return trimmed
}

/**
 * Fetch video metadata without downloading.
 */
export async function getVideoInfo(url: string): Promise<YtdlpInfo> {
  const safeUrl = validateUrl(url)
  const { stdout } = await execAsync(`yt-dlp --no-playlist --dump-json "${safeUrl}"`, {
    timeout: 30_000,
    maxBuffer: 1024 * 1024 * 10,
  })
  return JSON.parse(stdout.trim()) as YtdlpInfo
}

/**
 * Downloads a video from a URL using yt-dlp.
 * Returns info + local path to the downloaded file.
 */
export async function downloadVideo(url: string): Promise<DownloadResult> {
  const safeUrl = validateUrl(url)

  // Get metadata first (fast, no download)
  const info = await getVideoInfo(safeUrl)

  // Build temp output path
  const tempDir = os.tmpdir()
  const tempId = `ytdlp_${Date.now()}`
  const outputTemplate = path.join(tempDir, `${tempId}.%(ext)s`)

  // Download with best quality ≤ 1080p, forcing MP4 container
  await execAsync(
    [
      'yt-dlp',
      '--no-playlist',
      '--format "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]"',
      '--merge-output-format mp4',
      '--max-filesize 500m',
      `--output "${outputTemplate}"`,
      `"${safeUrl}"`,
    ].join(' '),
    { timeout: 300_000, maxBuffer: 1024 * 1024 }
  )

  const localPath = path.join(tempDir, `${tempId}.mp4`)

  if (!existsSync(localPath)) {
    throw new Error('Fichier téléchargé introuvable — vérifiez que yt-dlp est installé sur le serveur')
  }

  return {
    title: info.title,
    platform: info.extractor_key.toLowerCase(),
    localPath,
    duration: info.duration,
    thumbnailUrl: info.thumbnail ?? null,
    authorName: info.uploader ?? null,
    authorHandle: info.uploader_id ?? null,
  }
}

/**
 * Deletes a temporary file safely.
 */
export function cleanupTempFile(filePath: string): void {
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch {
    // Best-effort cleanup, ignore errors
  }
}
