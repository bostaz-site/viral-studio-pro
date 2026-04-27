import { schedule } from "@netlify/functions"

// Every 15 minutes — rescore clips whose next_check_at has elapsed
export const handler = schedule("*/15 * * * *", async () => {
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || "https://viralanimal.com"
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[cron-rescore] CRON_SECRET not set")
    return { statusCode: 500, body: "CRON_SECRET missing" }
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/rescore-clips`, {
      method: "POST",
      headers: {
        "x-api-key": cronSecret,
        "Content-Type": "application/json",
      },
    })

    const data = await res.json()
    console.log("[cron-rescore] Result:", JSON.stringify(data))

    return { statusCode: res.status, body: JSON.stringify(data) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[cron-rescore] Error:", msg)
    return { statusCode: 500, body: JSON.stringify({ error: msg }) }
  }
})
