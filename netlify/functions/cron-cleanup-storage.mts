import { schedule } from "@netlify/functions"

// Daily at 4am — cleanup expired clips from Storage based on plan TTL
export const handler = schedule("0 4 * * *", async () => {
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || "https://viralanimal.com"
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[cron-cleanup-storage] CRON_SECRET not set")
    return { statusCode: 500, body: "CRON_SECRET missing" }
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/cleanup-storage`, {
      method: "POST",
      headers: {
        "x-api-key": cronSecret,
        "Content-Type": "application/json",
      },
    })

    const data = await res.json()
    console.log("[cron-cleanup-storage] Result:", JSON.stringify(data))

    return { statusCode: res.status, body: JSON.stringify(data) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[cron-cleanup-storage] Error:", msg)
    return { statusCode: 500, body: JSON.stringify({ error: msg }) }
  }
})
