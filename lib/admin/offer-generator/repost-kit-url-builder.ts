const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'

export function buildRepostKitUrl(handle: string, campaignId?: string): string {
  const base = `${APP_URL}/partner/repost/${encodeURIComponent(handle)}`
  if (campaignId) return `${base}?c=${campaignId}`
  return base
}
