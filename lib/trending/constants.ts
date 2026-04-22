/**
 * Shared constants for trending clips UI.
 * Single source of truth for platform styles, niche labels, etc.
 */

export const PLATFORM_STYLES: Record<string, { label: string; colorClass: string; badgeClass: string }> = {
  twitch: {
    label: 'Twitch',
    colorClass: 'text-purple-400',
    badgeClass: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  },
  kick: {
    label: 'Kick',
    colorClass: 'text-green-400',
    badgeClass: 'text-green-400 bg-green-500/15 border-green-500/30',
  },
  youtube_gaming: {
    label: 'YouTube Gaming',
    colorClass: 'text-red-400',
    badgeClass: 'text-red-400 bg-red-500/15 border-red-500/30',
  },
}

/** Comprehensive niche/game labels — used by cards, modals, and filters */
export const NICHE_LABELS: Record<string, string> = {
  irl: 'IRL',
  just_chatting: 'Just Chatting',
  fps: 'FPS',
  moba: 'MOBA',
  rpg: 'RPG',
  slots: 'Slots',
  music: 'Music',
  sports: 'Sports',
  fighting: 'Fighting',
  racing: 'Racing',
  creative: 'Creative',
  variety: 'Variety',
}
