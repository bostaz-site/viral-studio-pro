import { getInstantlyClient } from '@/lib/integrations/instantly/client'

/**
 * Pause an email account in Instantly.
 * Uses the accounts API endpoint.
 */
export async function pauseEmailAccount(instantlyAccountId: string): Promise<void> {
  const client = getInstantlyClient()
  await (client as unknown as { request: (m: string, p: string) => Promise<void> })
    .request('POST', `/accounts/${instantlyAccountId}/pause`)
}

/**
 * Resume an email account in Instantly.
 */
export async function resumeEmailAccount(instantlyAccountId: string): Promise<void> {
  const client = getInstantlyClient()
  await (client as unknown as { request: (m: string, p: string) => Promise<void> })
    .request('POST', `/accounts/${instantlyAccountId}/resume`)
}

/**
 * Get warmup status for an email account.
 */
export async function getAccountWarmupStatus(
  instantlyAccountId: string,
): Promise<{ status: string; warmup_started_at?: string }> {
  const client = getInstantlyClient()
  return (client as unknown as { request: <T>(m: string, p: string) => Promise<T> })
    .request('GET', `/accounts/${instantlyAccountId}/warmup`)
}
