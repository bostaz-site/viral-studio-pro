/**
 * Kick API client (unofficial).
 * Fetches clips from public channels. No auth required.
 */

export interface KickClip {
  id: string
  title: string
  thumbnail_url: string
  view_count: number
  likes: number
  duration: number
  clip_url: string
  created_at: string
  channel_name: string
}

interface KickApiClip {
  id: number
  title: string
  thumbnail_url: string
  view_count: number
  likes_count: number
  duration: number
  clip_url: string
  created_at: string
  channel?: { username: string }
  creator?: { username: string }
}

const KICK_API_BASE = 'https://kick.com/api/v2'
const TIMEOUT_MS = 10_000

/**
 * Fetch recent clips for a Kick channel.
 * Gracefully returns empty array on errors (rate limit, not found, etc.)
 */
export async function getKickClips(
  username: string,
  limit = 20
): Promise<KickClip[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(
      `${KICK_API_BASE}/channels/${encodeURIComponent(username)}/clips?limit=${limit}`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ViralAnimal/1.0',
        },
      }
    )
    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[Kick] ${username}: HTTP ${res.status}`)
      return []
    }

    const data = await res.json()
    const clips: KickApiClip[] = Array.isArray(data) ? data : (data?.clips ?? data?.data ?? [])

    return clips.slice(0, limit).map((c) => ({
      id: String(c.id),
      title: c.title || `${username} clip`,
      thumbnail_url: c.thumbnail_url || '',
      view_count: c.view_count || 0,
      likes: c.likes_count || 0,
      duration: c.duration || 0,
      clip_url: c.clip_url || `https://kick.com/${username}/clips`,
      created_at: c.created_at || new Date().toISOString(),
      channel_name: c.channel?.username || c.creator?.username || username,
    }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort')) {
      console.error(`[Kick] ${username}: request timed out`)
    } else {
      console.error(`[Kick] ${username}: ${msg}`)
    }
    return []
  }
}
