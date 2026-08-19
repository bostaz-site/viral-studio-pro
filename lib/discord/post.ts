import {
  sendBotMessage,
  type DiscordEmbed,
  type DiscordActionRow,
} from '../audit/discord'

/**
 * Channel map — each key maps to an env var holding a Discord channel ID.
 * Samy creates the channels manually and sets the env vars.
 */
const CHANNEL_ENV_MAP = {
  // Business
  'new-signups': 'DISCORD_NEW_SIGNUPS_CHANNEL_ID',
  'new-paid': 'DISCORD_NEW_PAID_CHANNEL_ID',
  'churn-alerts': 'DISCORD_CHURN_ALERTS_CHANNEL_ID',
  'stripe-events': 'DISCORD_STRIPE_EVENTS_CHANNEL_ID',
  'weekly-stats': 'DISCORD_WEEKLY_STATS_CHANNEL_ID',
  // Acquisition
  'cold-email-replies': 'DISCORD_COLD_EMAIL_REPLIES_CHANNEL_ID',
  'positive-replies': 'DISCORD_POSITIVE_REPLIES_CHANNEL_ID',
  'promo-codes-sent': 'DISCORD_PROMO_CODES_CHANNEL_ID',
  'conversions': 'DISCORD_CONVERSIONS_CHANNEL_ID',
  'influencer-status': 'DISCORD_INFLUENCER_STATUS_CHANNEL_ID',
  // Produit
  'activity': 'DISCORD_ACTIVITY_CHANNEL_ID',
  'critical-alerts': 'DISCORD_CRITICAL_ALERTS_CHANNEL_ID',
  'morning-brief': 'DISCORD_MORNING_BRIEF_CHANNEL_ID',
  'production-errors': 'DISCORD_PRODUCTION_ERRORS_CHANNEL_ID',
} as const

export type DiscordChannel = keyof typeof CHANNEL_ENV_MAP

function getChannelId(channel: DiscordChannel): string | undefined {
  const envKey = CHANNEL_ENV_MAP[channel]
  return process.env[envKey]
}

/**
 * Post a message to a named Discord channel.
 * Uses the Bot API (supports interactive buttons) with webhook fallback.
 */
export async function postToDiscord(opts: {
  channel: DiscordChannel
  embed: DiscordEmbed
  components?: DiscordActionRow[]
  content?: string
}): Promise<void> {
  const channelId = getChannelId(opts.channel)
  if (!channelId) {
    console.warn(
      `[discord] Channel "${opts.channel}" not configured (missing ${CHANNEL_ENV_MAP[opts.channel]})`
    )
    return
  }

  await sendBotMessage(channelId, {
    content: opts.content,
    embeds: [
      {
        ...opts.embed,
        footer: opts.embed.footer ?? { text: 'Viral Animal' },
        timestamp: opts.embed.timestamp ?? new Date().toISOString(),
      },
    ],
    components: opts.components,
  })
}
