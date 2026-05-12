import { logger } from '@/lib/logger'
import type {
  InstantlyEmailAccount,
  InstantlyCampaign,
  InstantlyCampaignAnalytics,
  InstantlyPaginatedResponse,
} from './types'

const INSTANTLY_API_BASE = 'https://api.instantly.ai/api/v2'

/**
 * Rate-limited Instantly API v2 client.
 * Server-only — never import this in client components.
 */
export class InstantlyClient {
  private apiKey: string

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('INSTANTLY_API_KEY is required')
    this.apiKey = apiKey
  }

  // ── Core request helper ─────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${INSTANTLY_API_BASE}${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown error')
      throw new Error(`Instantly API ${method} ${path} failed (${res.status}): ${text}`)
    }

    return res.json() as Promise<T>
  }

  // ── Email Accounts ──────────────────────────────────────────────────────

  async getEmailAccounts(limit = 100): Promise<InstantlyEmailAccount[]> {
    const accounts: InstantlyEmailAccount[] = []
    let startingAfter: string | undefined

    // Paginate to get all accounts
    while (true) {
      const params = new URLSearchParams({ limit: String(limit) })
      if (startingAfter) params.set('starting_after', startingAfter)

      const res = await this.request<InstantlyPaginatedResponse<InstantlyEmailAccount>>(
        'GET',
        `/accounts?${params}`
      )

      accounts.push(...res.items)

      if (!res.next_starting_after || res.items.length < limit) break
      startingAfter = res.next_starting_after

      // Rate limit safety: small delay between pages
      await delay(200)
    }

    return accounts
  }

  // ── Campaigns ───────────────────────────────────────────────────────────

  async getCampaigns(limit = 100): Promise<InstantlyCampaign[]> {
    const campaigns: InstantlyCampaign[] = []
    let startingAfter: string | undefined

    while (true) {
      const params = new URLSearchParams({
        limit: String(limit),
        status: 'active', // Only active campaigns, skip archived
      })
      if (startingAfter) params.set('starting_after', startingAfter)

      const res = await this.request<InstantlyPaginatedResponse<InstantlyCampaign>>(
        'GET',
        `/campaigns?${params}`
      )

      campaigns.push(...res.items)

      if (!res.next_starting_after || res.items.length < limit) break
      startingAfter = res.next_starting_after

      await delay(200)
    }

    // Also fetch paused campaigns (they might have recent stats)
    startingAfter = undefined
    while (true) {
      const params = new URLSearchParams({
        limit: String(limit),
        status: 'paused',
      })
      if (startingAfter) params.set('starting_after', startingAfter)

      const res = await this.request<InstantlyPaginatedResponse<InstantlyCampaign>>(
        'GET',
        `/campaigns?${params}`
      )

      campaigns.push(...res.items)

      if (!res.next_starting_after || res.items.length < limit) break
      startingAfter = res.next_starting_after

      await delay(200)
    }

    return campaigns
  }

  async getCampaignAnalytics(campaignId: string): Promise<InstantlyCampaignAnalytics> {
    return this.request<InstantlyCampaignAnalytics>(
      'GET',
      `/campaigns/${campaignId}/analytics`
    )
  }

  // ── Campaign Actions ────────────────────────────────────────────────────

  async pauseCampaign(campaignId: string): Promise<void> {
    await this.request('POST', `/campaigns/${campaignId}/pause`)
    logger.info({ campaignId }, 'Instantly campaign paused')
  }

  async resumeCampaign(campaignId: string): Promise<void> {
    await this.request('POST', `/campaigns/${campaignId}/resume`)
    logger.info({ campaignId }, 'Instantly campaign resumed')
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

let _client: InstantlyClient | null = null

export function getInstantlyClient(): InstantlyClient {
  if (!_client) {
    const apiKey = process.env.INSTANTLY_API_KEY
    if (!apiKey) throw new Error('INSTANTLY_API_KEY env var is not set')
    _client = new InstantlyClient(apiKey)
  }
  return _client
}

// ── Helpers ───────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
