import { schedule } from "@netlify/functions"

// Every 5 minutes — cleanup zombie render jobs stuck in pending/rendering
export const handler = schedule("*/5 * * * *", async () => {
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || "https://viralanimal.com"
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[cron-cleanup-render-jobs] CRON_SECRET not set")
    return { statusCode: 500, body: "CRON_SECRET missing" }
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/cleanup-render-jobs`, {
      method: "POST",
      headers: {
        "x-api-key": cronSecret,
        "Content-Type": "application/json",
      },
    })

    const data = await res.json()
    console.log("[cron-cleanup-render-jobs] Result:", JSON.stringify(data))

    return { statusCode: res.status, body: JSON.stringify(data) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[cron-cleanup-render-jobs] Error:", msg)
    return { statusCode: 500, body: JSON.stringify({ error: msg }) }
  }
})
