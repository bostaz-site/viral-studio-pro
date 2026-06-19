import { schedule } from '@netlify/functions'

// Monday 2pm UTC = Monday 10am EST
export const handler = schedule('0 14 * * 1', async () => {
  const baseUrl =
    process.env.URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://viralanimal.com'
  const cronSecret = process.env.AUDIT_CRON_SECRET

  if (!cronSecret) {
    console.error('[weekly-stats] AUDIT_CRON_SECRET not set')
    return { statusCode: 500, body: 'AUDIT_CRON_SECRET missing' }
  }

  try {
    const res = await fetch(`${baseUrl}/api/admin/audits/trigger?mode=weekly-stats`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await res.json()
    console.log('[weekly-stats] Result:', JSON.stringify(data))
    return { statusCode: res.status, body: JSON.stringify(data) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[weekly-stats] Error:', msg)
    return { statusCode: 500, body: JSON.stringify({ error: msg }) }
  }
})
