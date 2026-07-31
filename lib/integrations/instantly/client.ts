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

    // Handle 204 No Content (common for DELETE operations)
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return {} as T
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

  // ── Lead Management (v2 API) ────────────────────────────────────────

  /**
   * Find leads by email across all campaigns and delete them.
   * Instantly v2: POST /leads/list to find, then DELETE /leads/{id} to remove.
   */
  async removeLeadFromAllCampaigns(email: string): Promise<{ removed: number; failed: number }> {
    let removed = 0
    let failed = 0

    try {
      // List leads by email (v2 endpoint)
      const leads = await this.request<{ items?: Array<{ id: string; campaign_id?: string }> }>(
        'POST',
        '/leads/list',
        { email, limit: 100 },
      )

      const items = leads.items ?? []
      if (items.length === 0) {
        logger.info({ email }, 'No Instantly leads found for email')
        return { removed: 0, failed: 0 }
      }

      // Delete each lead entry
      for (const lead of items) {
        try {
          await this.request('DELETE', `/leads/${lead.id}`)
          removed++
        } catch (err) {
          logger.warn({ leadId: lead.id, email, error: (err as Error).message }, 'Failed to delete Instantly lead')
          failed++
        }
        await delay(300) // Rate limit safety
      }
    } catch (err) {
      // If the list endpoint fails entirely, log and return failure
      logger.error({ email, error: (err as Error).message }, 'Failed to list Instantly leads for removal')
      failed = 1
    }

    return { removed, failed }
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
