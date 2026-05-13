const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('YOUTUBE_API_KEY not set')
  return key
}

interface YouTubeChannel {
  id: string
  title: string
  handle: string | null
  description: string
  thumbnailUrl: string | null
  subscriberCount: number
  videoCount: number
  viewCount: number
  publishedAt: string
  country: string | null
  links: string[]
}

interface SearchParams {
  query: string
  maxResults?: number
  language?: string
  regionCode?: string
  order?: 'relevance' | 'date' | 'rating' | 'viewCount'
}

/**
 * Search YouTube channels by query. Cost: 100 units per call.
 */
export async function searchYouTubeChannels(params: SearchParams): Promise<{ channels: YouTubeChannel[]; quotaUsed: number }> {
  const key = getApiKey()
  const maxResults = Math.min(params.maxResults ?? 50, 50)

  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'channel',
    q: params.query,
    maxResults: String(maxResults),
    key,
  })
  if (params.language) searchParams.set('relevanceLanguage', params.language)
  if (params.regionCode) searchParams.set('regionCode', params.regionCode)
  if (params.order) searchParams.set('order', params.order)

  const searchRes = await fetch(`${YOUTUBE_API_BASE}/search?${searchParams}`)
  if (!searchRes.ok) {
    const err = await searchRes.text()
    throw new Error(`YouTube search failed (${searchRes.status}): ${err}`)
  }

  const searchData = await searchRes.json()
  const channelIds = (searchData.items ?? [])
    .map((item: { id?: { channelId?: string } }) => item.id?.channelId)
    .filter(Boolean) as string[]

  if (channelIds.length === 0) return { channels: [], quotaUsed: 100 }

  // Enrich with channel details. Cost: 1 unit per call (up to 50 IDs).
  const channels = await getChannelDetails(channelIds)

  return { channels, quotaUsed: 100 + 1 } // search=100 + channels=1
}

/**
 * Get detailed channel info for up to 50 channel IDs. Cost: 1 unit.
 */
export async function getChannelDetails(channelIds: string[]): Promise<YouTubeChannel[]> {
  const key = getApiKey()

  const params = new URLSearchParams({
    part: 'snippet,statistics,brandingSettings',
    id: channelIds.slice(0, 50).join(','),
    key,
  })

  const res = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`YouTube channels failed (${res.status}): ${err}`)
  }

  const data = await res.json()

  return (data.items ?? []).map((ch: any) => ({
    id: ch.id,
    title: ch.snippet?.title ?? '',
    handle: ch.snippet?.customUrl?.replace('@', '') ?? null,
    description: ch.snippet?.description ?? '',
    thumbnailUrl: ch.snippet?.thumbnails?.medium?.url ?? null,
    subscriberCount: parseInt(ch.statistics?.subscriberCount ?? '0'),
    videoCount: parseInt(ch.statistics?.videoCount ?? '0'),
    viewCount: parseInt(ch.statistics?.viewCount ?? '0'),
    publishedAt: ch.snippet?.publishedAt ?? '',
    country: ch.snippet?.country ?? null,
    links: extractLinks(ch.brandingSettings),
  }))
}

function extractLinks(branding: any): string[] {
  const links: string[] = []
  const channels = branding?.channel?.featuredChannelsUrls ?? []
  links.push(...channels)
  // brandingSettings doesn't expose About page links directly via API
  // We extract from description instead
  return links
}

/**
 * Extract emails from channel description + about page text.
 */
export function extractEmailsFromText(text: string): Array<{ email: string; context: string }> {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = text.match(emailRegex) ?? []

  // Filter out common false positives
  const blacklist = ['example.com', 'email.com', 'youremail.com', 'gmail.com']
  return matches
    .filter(e => !blacklist.some(bl => e.endsWith(`@${bl}`)))
    .map(email => {
      const idx = text.indexOf(email)
      const context = text.slice(Math.max(0, idx - 40), idx + email.length + 40).trim()
      return { email: email.toLowerCase(), context }
    })
}
