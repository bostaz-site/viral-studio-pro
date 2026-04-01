/**
 * Derives a Twitch clip video preview URL from its thumbnail URL.
 *
 * Works for the "old" CDN format:
 *   Thumbnail: https://static-cdn.jtvnw.net/twitch-clips/SLUG/AT-cm%7CSLUG-preview-480x272.jpg
 *   Video:     https://clips-media-assets2.twitch.tv/SLUG/AT-cm%7CSLUG.mp4
 *
 * The newer "twitch-clips-thumbnails-prod" format returns 403 on the video
 * CDN, so we return null for those and the caller should fall back to the
 * static thumbnail image.
 */
export function twitchThumbnailToVideoUrl(thumbnailUrl: string): string | null {
  if (!thumbnailUrl) return null

  // Newer format — video not available on public CDN
  if (thumbnailUrl.includes('twitch-clips-thumbnails-prod')) return null

  // Old format: .../twitch-clips/SLUG/AT-cm|SLUG-preview-WxH.jpg
  const prefix = 'https://static-cdn.jtvnw.net/twitch-clips/'
  if (!thumbnailUrl.startsWith(prefix)) return null

  const path = thumbnailUrl.slice(prefix.length)
  const base = path.split('-preview-')[0]
  if (!base) return null

  return `https://clips-media-assets2.twitch.tv/${base}.mp4`
}
