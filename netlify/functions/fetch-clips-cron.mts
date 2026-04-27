import type { Config } from "@netlify/functions"

// Runs every 3 hours — fetches new Twitch + Kick clips
export default async () => {
  const baseUrl = process.env.URL || "https://viral-studio-pro.netlify.app"
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not set")
    return new Response("CRON_SECRET missing", { status: 500 })
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
    console.log("[Cron] Fetch result:", JSON.stringify(data))

    // Also trigger rescore for clips due for re-evaluation
    try {
      const rescoreRes = await fetch(`${baseUrl}/api/cron/rescore-clips`, {
        method: "POST",
        headers: {
          "x-api-key": cronSecret,
          "Content-Type": "application/json",
        },
      })
      const rescoreData = await rescoreRes.json()
      console.log("[Cron] Rescore result:", JSON.stringify(rescoreData))
    } catch (err) {
      console.error("[Cron] Rescore failed:", err instanceof Error ? err.message : String(err))
    }

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Cron] Error:", msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}

export const config: Config = {
  // Every 3 hours: at minute 0 of hours 0, 3, 6, 9, 12, 15, 18, 21
  schedule: "0 */3 * * *",
}
