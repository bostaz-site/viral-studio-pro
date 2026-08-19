/**
 * Typed Discord notification helpers for the live activity feed.
 *
 * Channels:
 *   'activity'        — good news (signups, first renders, publishes)
 *   'critical-alerts' — failures, disconnections, queue congestion
 *
 * Anti-spam: Redis counter groups identical events.
 * If ≥20 of the same event key fire within 5 min, sends one grouped message.
 *
 * IMPORTANT: every call site wraps in `void ... .catch(() => {})`.
 * Discord must NEVER block a user-facing action.
 */

import { postToDiscord } from './post'
import { redis } from '@/lib/upstash'

// ── Anti-spam ──────────────────────────────────────────────────────────────────

const SPAM_WINDOW = 300 // 5 minutes
const SPAM_THRESHOLD = 20

/**
 * Returns true if the event should be sent.
 * After SPAM_THRESHOLD identical events within SPAM_WINDOW seconds,
 * suppresses individual messages and sends a grouped one instead.
 */
async function shouldSend(eventKey: string): Promise<{ send: boolean; count?: number }> {
  try {
    const key = `discord:spam:${eventKey}`
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, SPAM_WINDOW)
    }
    if (count === SPAM_THRESHOLD) {
      return { send: true, count } // send grouped message
    }
    if (count > SPAM_THRESHOLD) {
      return { send: false }
    }
    return { send: true }
  } catch {
    return { send: true } // Redis down → send anyway
  }
}

/** Mask email for Discord: s***@gmail.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  return `${local[0]}***@${domain}`
}

// ── Activity channel (good news) ───────────────────────────────────────────────

export async function notifySignup(opts: {
  email: string
  plan?: string
  source?: string | null
}): Promise<void> {
  const spam = await shouldSend('signup')
  if (!spam.send) return

  const description = spam.count
    ? `${spam.count}× new signups in the last 5 min`
    : `${maskEmail(opts.email)}` +
      (opts.source ? ` (via ${opts.source})` : '') +
      ` — ${opts.plan ?? 'free'}`

  await postToDiscord({
    channel: 'activity',
    embed: {
      title: spam.count ? `🎉 ${spam.count}× New signups` : '🎉 New signup',
      description,
      color: 0x10b981,
    },
  })
}

export async function notifyFirstRender(opts: {
  userId: string
}): Promise<void> {
  const spam = await shouldSend('first_render')
  if (!spam.send) return

  await postToDiscord({
    channel: 'activity',
    embed: {
      title: '✅ First render',
      description: spam.count
        ? `${spam.count}× users rendered their first clip`
        : `User rendered their first clip`,
      color: 0x22d3ee,
      fields: spam.count ? [] : [
        { name: 'User', value: opts.userId.slice(0, 8) + '…', inline: true },
      ],
    },
  })
}

export async function notifyPublishSuccess(opts: {
  platform: string
  mode: 'manual' | 'autofarm'
  clipTitle?: string | null
}): Promise<void> {
  const spam = await shouldSend(`publish_ok_${opts.platform}`)
  if (!spam.send) return

  await postToDiscord({
    channel: 'activity',
    embed: {
      title: spam.count
        ? `📤 ${spam.count}× ${opts.platform} publishes`
        : `📤 Published to ${opts.platform}`,
      description: spam.count
        ? `${spam.count}× clips published (${opts.mode})`
        : `${opts.mode === 'autofarm' ? 'Auto-posted' : 'Manual'}: ${(opts.clipTitle ?? 'untitled').slice(0, 80)}`,
      color: 0x8b5cf6,
    },
  })
}

// ── Critical alerts channel (bad news) ─────────────────────────────────────────

export async function notifyRenderFailed(opts: {
  jobId: string
  clipId: string
  userId: string
  errorMessage: string
  consecutiveFailures: number
}): Promise<void> {
  const spam = await shouldSend('render_failed')
  if (!spam.send) return

  const isCritical = opts.consecutiveFailures >= 3

  await postToDiscord({
    channel: 'critical-alerts',
    content: isCritical ? '@here' : undefined,
    embed: {
      title: spam.count
        ? `🔴 ${spam.count}× Render failures`
        : isCritical
          ? `🔴 CRITICAL: ${opts.consecutiveFailures} consecutive render failures — VPS may be down`
          : '🔴 Render failed',
      description: spam.count
        ? `${spam.count}× render failures in 5 min — check VPS health`
        : opts.errorMessage.slice(0, 200),
      color: 0xef4444,
      fields: spam.count ? [] : [
        { name: 'Job', value: opts.jobId.slice(0, 8) + '…', inline: true },
        { name: 'User', value: opts.userId.slice(0, 8) + '…', inline: true },
        { name: 'Streak', value: `${opts.consecutiveFailures} consecutive`, inline: true },
      ],
    },
  })
}

export async function notifyPublishFailed(opts: {
  platform: string
  reason: string
  userId: string
  mode: 'manual' | 'autofarm'
}): Promise<void> {
  const spam = await shouldSend(`publish_fail_${opts.platform}`)
  if (!spam.send) return

  await postToDiscord({
    channel: 'critical-alerts',
    embed: {
      title: spam.count
        ? `🔴 ${spam.count}× ${opts.platform} publish failures`
        : `🔴 Publish failed (${opts.platform})`,
      description: spam.count
        ? `${spam.count}× failures in 5 min`
        : `${opts.mode === 'autofarm' ? 'Autofarm' : 'Manual'}: ${opts.reason.slice(0, 200)}`,
      color: 0xef4444,
      fields: spam.count ? [] : [
        { name: 'User', value: opts.userId.slice(0, 8) + '…', inline: true },
      ],
    },
  })
}

export async function notifyQueueCongestion(opts: {
  queued: number
  active: number
}): Promise<void> {
  const spam = await shouldSend('queue_congestion')
  if (!spam.send) return

  await postToDiscord({
    channel: 'critical-alerts',
    embed: {
      title: '⚠️ Render queue congested',
      description: `${opts.queued} jobs waiting, ${opts.active} active — consider scaling VPS`,
      color: 0xf59e0b,
    },
  })
}

export async function notifyAccountDisconnected(opts: {
  platform: string
  userId: string
  reason: string
}): Promise<void> {
  const spam = await shouldSend('account_disconnected')
  if (!spam.send) return

  await postToDiscord({
    channel: 'critical-alerts',
    embed: {
      title: spam.count
        ? `⚠️ ${spam.count}× accounts disconnected`
        : `⚠️ ${opts.platform} account disconnected`,
      description: spam.count
        ? `${spam.count}× accounts lost token in 5 min`
        : opts.reason.slice(0, 200),
      color: 0xf59e0b,
      fields: spam.count ? [] : [
        { name: 'User', value: opts.userId.slice(0, 8) + '…', inline: true },
        { name: 'Platform', value: opts.platform, inline: true },
      ],
    },
  })
}
