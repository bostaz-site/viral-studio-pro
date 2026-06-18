const DISCORD_WEBHOOK = process.env.DISCORD_AUDIT_WEBHOOK_URL

export async function sendDiscordAlert(finding: {
  severity: string
  agent_type: string
  title: string
  description: string
  location?: string
}) {
  if (!DISCORD_WEBHOOK || finding.severity !== 'critical') return

  const color = {
    critical: 0xff0000,
    high: 0xff9900,
    normal: 0xffcc00,
    low: 0x999999,
  }[finding.severity] ?? 0x999999

  await fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: `\uD83D\uDD25 ${finding.title}`,
        description: finding.description,
        color,
        fields: [
          { name: 'Agent', value: finding.agent_type, inline: true },
          { name: 'Location', value: finding.location ?? 'N/A', inline: true },
        ],
        footer: { text: 'Viral Animal Audit System' },
        timestamp: new Date().toISOString(),
      }]
    })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Discord Bot API (supports interactive buttons via custom_id)
// ─────────────────────────────────────────────────────────────────────────────

export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string }
  timestamp?: string
}

export interface DiscordButton {
  type: 2
  style: 1 | 2 | 3 | 4 | 5 // 1=primary, 2=secondary, 3=success, 4=danger, 5=link
  label: string
  custom_id?: string // required for styles 1-4
  url?: string       // required for style 5
}

export interface DiscordActionRow {
  type: 1
  components: DiscordButton[]
}

export interface DiscordMessagePayload {
  content?: string
  embeds?: DiscordEmbed[]
  components?: DiscordActionRow[]
}

/**
 * Send a message via Discord Bot API (supports interactive buttons).
 * Falls back to webhook if bot token is not configured.
 */
export async function sendBotMessage(
  channelId: string,
  payload: DiscordMessagePayload,
): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN

  if (botToken && channelId) {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[discord-bot] Send failed (${res.status}): ${err}`)
      // Fall through to webhook fallback
    } else {
      return
    }
  }

  // Fallback: webhook (no components/buttons, but embeds work)
  if (DISCORD_WEBHOOK) {
    const { components: _, ...webhookPayload } = payload
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    })
  }
}
