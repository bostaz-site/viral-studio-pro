import { schedule } from "@netlify/functions"

// Every 3 hours — fetch new Twitch + Kick clips
export const handler = schedule("0 */3 * * *", async () => {
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || "https://viralanimal.com"
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[cron-fetch-clips] CRON_SECRET not set")
    return { statusCode: 500, body: "CRON_SECRET missing" }
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/fetch-twitch-clips`, {
      method: "POST",
      headers: {
        "x-api-key": cronSecret,
        "Content-Type": "application/json",
      },
    })

    const data = await res.json()
    console.log("[cron-fetch-clips] Result:", JSON.stringify(data))

    return { statusCode: res.status, body: JSON.stringify(data) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[cron-fetch-clips] Error:", msg)
    return { statusCode: 500, body: JSON.stringify({ error: msg }) }
  }
})
