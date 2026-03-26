/**
 * Twitch Helix API client with auto-refreshing Client Credentials token.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface TwitchClip {
  id: string
  url: string
  embed_url: string
  broadcaster_id: string
  broadcaster_name: string
  creator_id: string
  creator_name: string
  video_id: string
  game_id: string
  language: string
  title: string
  view_count: number
  created_at: string
  thumbnail_url: string
  duration: number
}

export interface TwitchGame {
  id: string
  name: string
  box_art_url: string
  igdb_id: string
}

export interface TwitchChannel {
  broadcaster_login: string
  display_name: string
  game_id: string
  game_name: string
  id: string
  is_live: boolean
  thumbnail_url: string
  title: string
}

// ── Token management ─────────────────────────────────────────────────────────

let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken
  }

  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set')
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twitch auth failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number; token_type: string }
  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + data.expires_in * 1000

  return cachedToken
}

// ── API helper ───────────────────────────────────────────────────────────────

async function twitchFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const token = await getAccessToken()
  const clientId = process.env.TWITCH_CLIENT_ID!

  const url = new URL(`https://api.twitch.tv/helix${endpoint}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-Id': clientId,
    },
  })

  if (res.status === 401) {
    // Token expired — force refresh and retry once
    cachedToken = null
    tokenExpiresAt = 0
    const newToken = await getAccessToken()

    const retryRes = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${newToken}`,
        'Client-Id': clientId,
      },
    })

    if (!retryRes.ok) {
      throw new Error(`Twitch API error (${retryRes.status}): ${await retryRes.text()}`)
    }

    return (await retryRes.json()) as T
  }

  if (!res.ok) {
    throw new Error(`Twitch API error (${res.status}): ${await res.text()}`)
  }

  return (await res.json()) as T
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get top clips for a game, filtered by time period.
 *
 * @param gameId - Twitch game ID
 * @param hoursAgo - Only clips created within the last N hours (default 6)
 * @param limit - Max clips to return (default 20, max 100)
 */
export async function getTopClips(
  gameId: string,
  hoursAgo = 6,
  limit = 20
): Promise<TwitchClip[]> {
  const startedAt = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString()

  const data = await twitchFetch<{ data: TwitchClip[] }>('/clips', {
    game_id: gameId,
    first: String(Math.min(limit, 100)),
    started_at: startedAt,
  })

  return data.data ?? []
}

/**
 * Get top clips for a specific broadcaster.
 */
export async function getClipsByBroadcaster(
  broadcasterId: string,
  hoursAgo = 24,
  limit = 20
): Promise<TwitchClip[]> {
  const startedAt = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString()

  const data = await twitchFetch<{ data: TwitchClip[] }>('/clips', {
    broadcaster_id: broadcasterId,
    first: String(Math.min(limit, 100)),
    started_at: startedAt,
  })

  return data.data ?? []
}

/**
 * Get top games on Twitch.
 */
export async function getTopGames(limit = 20): Promise<TwitchGame[]> {
  const data = await twitchFetch<{ data: TwitchGame[] }>('/games/top', {
    first: String(Math.min(limit, 100)),
  })

  return data.data ?? []
}

/**
 * Search channels by name.
 */
export async function searchChannels(query: string, limit = 10): Promise<TwitchChannel[]> {
  const data = await twitchFetch<{ data: TwitchChannel[] }>('/search/channels', {
    query,
    first: String(Math.min(limit, 100)),
  })

  return data.data ?? []
}

/**
 * Get game details by name (exact match lookup).
 */
export async function getGameByName(name: string): Promise<TwitchGame | null> {
  const data = await twitchFetch<{ data: TwitchGame[] }>('/games', {
    name,
  })

  return data.data?.[0] ?? null
}

// ── Game ID mapping ──────────────────────────────────────────────────────────

/**
 * Known Twitch game IDs for our tracked categories.
 * These are stable and won't change.
 */
export const TRACKED_GAMES: Record<string, { gameId: string; niche: string }> = {
  'Fortnite':          { gameId: '33214',  niche: 'fortnite' },
  'VALORANT':          { gameId: '516575', niche: 'valorant' },
  'League of Legends': { gameId: '21779',  niche: 'league_of_legends' },
  'Minecraft':         { gameId: '27471',  niche: 'minecraft' },
  'Grand Theft Auto V':{ gameId: '32982',  niche: 'gta' },
  'Just Chatting':     { gameId: '509658', niche: 'just_chatting' },
  'Apex Legends':      { gameId: '511224', niche: 'apex_legends' },
}
