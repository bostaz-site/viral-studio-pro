import type { SupabaseClient } from '@supabase/supabase-js'

const ALERT_EMAIL = 'samycloutier30@gmail.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'

interface AlertRow {
  id: string
  severity: string
  category: string
  title: string
  description: string | null
}

/**
 * Send email notification for critical alerts.
 * Uses Resend if RESEND_API_KEY is set, otherwise logs to console.
 */
export async function notifyCriticalAlerts(
  admin: SupabaseClient,
  alerts: AlertRow[]
): Promise<void> {
  const criticals = alerts.filter(a => a.severity === 'critical')
  if (criticals.length === 0) return

  const resendKey = process.env.RESEND_API_KEY

  // Build email body
  const subject = `[Watchdog] ${criticals.length} critical alert(s) detected`
  const body = criticals
    .map(a => `**${a.title}**\n${a.description || 'No details'}\nCategory: ${a.category}`)
    .join('\n\n---\n\n')
  const html = `
    <div style="font-family: sans-serif; max-width: 600px;">
      <h2 style="color: #ef4444;">Watchdog Alert</h2>
      <p>${criticals.length} critical alert(s) detected:</p>
      ${criticals.map(a => `
        <div style="border-left: 3px solid #ef4444; padding: 12px; margin: 12px 0; background: #1a1a1a; color: #e5e5e5;">
          <strong>${a.title}</strong>
          <p style="margin: 4px 0; color: #a1a1aa;">${a.description || ''}</p>
          <small style="color: #71717a;">Category: ${a.category}</small>
        </div>
      `).join('')}
      <p><a href="${APP_URL}/admin/watchdog" style="color: #f59e0b;">View alerts dashboard</a></p>
    </div>
  `

  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'Viral Animal Watchdog <alerts@viralanimal.com>',
          to: [ALERT_EMAIL],
          subject,
          html,
        }),
      })
      if (!res.ok) {
        const err = await res.text().catch(() => 'unknown')
        console.error('[watchdog/notifier] Resend failed:', res.status, err)
      }
    } catch (err) {
      console.error('[watchdog/notifier] Resend error:', err)
    }
  } else {
    // Fallback: log to console (visible in Netlify function logs)
    console.warn('[watchdog/notifier] No RESEND_API_KEY set. Alert email not sent.')
    console.warn(`[watchdog/notifier] Subject: ${subject}`)
    console.warn(`[watchdog/notifier] Body:\n${body}`)
  }

  // Mark all as notified
  const alertIds = criticals.map(a => a.id)
  await admin
    .from('agent_alerts')
    .update({ notified: true })
    .in('id', alertIds)
}
