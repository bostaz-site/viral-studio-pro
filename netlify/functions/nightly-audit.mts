import { schedule } from '@netlify/functions'

// 6am UTC = 2am EST — runs daily
export const handler = schedule('0 6 * * *', async () => {
  const baseUrl =
    process.env.URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://viralanimal.com'
  const cronSecret = process.env.AUDIT_CRON_SECRET

  if (!cronSecret) {
    console.error('[nightly-audit] AUDIT_CRON_SECRET not set')
    return { statusCode: 500, body: 'AUDIT_CRON_SECRET missing' }
  }

  try {
    const res = await fetch(`${baseUrl}/api/admin/audits/trigger?mode=brief`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await res.json()
    console.log('[nightly-audit] Result:', JSON.stringify(data))

    return { statusCode: res.status, body: JSON.stringify(data) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[nightly-audit] Error:', msg)
    return { statusCode: 500, body: JSON.stringify({ error: msg }) }
  }
})
