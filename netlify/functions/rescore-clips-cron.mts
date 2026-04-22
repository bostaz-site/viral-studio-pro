import type { Config } from "@netlify/functions"

// Runs every 5 minutes — rescores clips whose next_check_at has elapsed
export default async () => {
  const baseUrl = process.env.URL || "https://viral-studio-pro.netlify.app"
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[Rescore Cron] CRON_SECRET not set")
    return new Response("CRON_SECRET missing", { status: 500 })
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
    console.log("[Rescore Cron] Result:", JSON.stringify(data))

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Rescore Cron] Error:", msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}

export const config: Config = {
  schedule: "*/5 * * * *",
}
