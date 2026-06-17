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
