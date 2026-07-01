import { extractEmailsFromText, extractUrlsFromText, classifyUrl, type EmailSource } from './youtube'

interface CrawlResult {
  email: string
  source: EmailSource
  sourceUrl: string
  isBusinessContact: boolean
  context: string
}

/**
 * Crawl external links from descriptions to find emails.
 * Fetches each URL with a 5s timeout, max 3 links per channel.
 * Silent error handling — a down site never breaks the run.
 */
export async function crawlExternalLinksForEmails(
  descriptions: string[]
): Promise<CrawlResult[]> {
  // Collect all URLs from all descriptions
  const allUrls: Array<{ url: string; type: EmailSource }> = []
  for (const text of descriptions) {
    const urls = extractUrlsFromText(text)
    for (const url of urls) {
      const classification = classifyUrl(url)
      if (classification) {
        allUrls.push({ url, type: classification })
      }
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const uniqueUrls = allUrls.filter(u => {
    const lower = u.url.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })

  // Sort: linktree first (higher priority), then limit to 3
  uniqueUrls.sort((a, b) => {
    if (a.type === 'linktree' && b.type !== 'linktree') return -1
    if (a.type !== 'linktree' && b.type === 'linktree') return 1
    return 0
  })
  const toFetch = uniqueUrls.slice(0, 3)

  const results: CrawlResult[] = []

  await Promise.all(
    toFetch.map(async ({ url, type }) => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
          redirect: 'follow',
        })

        clearTimeout(timeoutId)

        if (!res.ok) return

        const contentType = res.headers.get('content-type') ?? ''
        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return

        const html = await res.text()
        // Limit to first 50KB to avoid huge pages
        const truncated = html.slice(0, 50_000)

        const emails = extractEmailsFromText(truncated)
        for (const e of emails) {
          results.push({
            email: e.email,
            source: type,
            sourceUrl: url,
            isBusinessContact: e.isBusinessContact,
            context: e.context,
          })
        }
      } catch {
        // Silent — network errors, timeouts, aborts are all expected
      }
    })
  )

  return results
}
