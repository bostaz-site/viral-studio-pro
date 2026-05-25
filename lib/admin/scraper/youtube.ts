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
  const maxResults = Math.min(params.maxResults ?? 15, 25)

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
 * Filters false positives (file extensions, no-reply, placeholder domains).
 * Detects business-contact proximity keywords.
 */
export function extractEmailsFromText(text: string): Array<{
  email: string
  context: string
  isBusinessContact: boolean
}> {
  const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
  const matches = text.match(emailRegex) ?? []

  // Domain blacklist — placeholder/example domains only (NOT real providers like gmail)
  const domainBlacklist = ['example.com', 'email.com', 'youremail.com', 'domain.com', 'test.com', 'sample.com']

  // Local-part exact blacklist
  const localBlacklist = [
    /^no[-.]?reply$/i,
    /^do[-.]?not[-.]?reply$/i,
    /^support$/i,
    /^example$/i,
    /^your$/i,
    /^name$/i,
    /^email$/i,
    /^someone$/i,
    /^user(name)?$/i,
  ]

  // File-extension false positives (e.g. logo.png@2x won't match TLD, but logo.png@company.com could)
  const fileExtPattern = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico|mp4|mov)$/i

  const businessKeywords = /business|contact|inquir|collab|sponsor|booking|partnership|press|media|pr\b/i

  const seen = new Set<string>()

  return matches
    .filter(e => {
      const atIdx = e.indexOf('@')
      const local = e.slice(0, atIdx)
      const domain = e.slice(atIdx + 1).toLowerCase()
      if (domainBlacklist.includes(domain)) return false
      if (`${local.toLowerCase()}@${domain}` === 'support@youtube.com') return false
      if (localBlacklist.some(re => re.test(local))) return false
      if (fileExtPattern.test(local)) return false
      const lower = e.toLowerCase()
      if (seen.has(lower)) return false
      seen.add(lower)
      return true
    })
    .map(email => {
      const idx = text.indexOf(email)
      const contextStart = Math.max(0, idx - 60)
      const contextEnd = Math.min(text.length, idx + email.length + 60)
      const context = text.slice(contextStart, contextEnd).trim()
      const isBusinessContact = businessKeywords.test(context)
      return { email: email.toLowerCase(), context, isBusinessContact }
    })
}
