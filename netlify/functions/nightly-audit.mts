import { schedule } from '@netlify/functions'

// 7am UTC = 3am EST — fallback for morning brief generation
// Runs 1h after Railway cron (6am UTC) to ensure findings are already inserted.
// If Railway ran successfully, this just regenerates the brief (idempotent).
// If Railway was down, this still generates a brief from whatever findings exist.
export const handler = schedule('0 7 * * *', async () => {
  const baseUrl =
    process.env.URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://viralanimal.com'
  const cronSecret = process.env.AUDIT_CRON_SECRET

  if (!cronSecret) {
    console.error('[morning-brief-fallback] AUDIT_CRON_SECRET not set')
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
    console.log('[morning-brief-fallback] Result:', JSON.stringify(data))

    return { statusCode: res.status, body: JSON.stringify(data) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[morning-brief-fallback] Error:', msg)
    return { statusCode: 500, body: JSON.stringify({ error: msg }) }
  }
})
