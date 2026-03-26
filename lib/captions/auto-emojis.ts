/**
 * Auto-emoji insertion for karaoke subtitles.
 *
 * Scans caption text for keywords/patterns and appends contextual emojis.
 * Operates as a post-processing step on word timestamps before ASS generation.
 */

import type { WordTimestamp } from '@/lib/ffmpeg/captions'

// ── Keyword → Emoji mapping ─────────────────────────────────────────────────
// Ordered by specificity (multi-word first, then single words).
// Each entry: [pattern (lowercase), emoji, matchMode]
// matchMode: 'exact' = full word match, 'includes' = substring match

interface EmojiRule {
  pattern: string
  emoji: string
  mode: 'exact' | 'includes'
}

const EMOJI_RULES: EmojiRule[] = [
  // ── Laughter / Joy ──
  { pattern: 'hahaha',     emoji: '😂', mode: 'includes' },
  { pattern: 'haha',       emoji: '😂', mode: 'includes' },
  { pattern: 'mdr',        emoji: '😂', mode: 'exact' },
  { pattern: 'lol',        emoji: '😂', mode: 'exact' },
  { pattern: 'ptdr',       emoji: '🤣', mode: 'exact' },
  { pattern: 'mort',       emoji: '💀', mode: 'exact' },

  // ── Hype / Excitement ──
  { pattern: 'incroyable', emoji: '🤯', mode: 'includes' },
  { pattern: 'incredible', emoji: '🤯', mode: 'includes' },
  { pattern: 'amazing',    emoji: '🤯', mode: 'includes' },
  { pattern: 'insane',     emoji: '🤯', mode: 'includes' },
  { pattern: 'dingue',     emoji: '🤯', mode: 'includes' },
  { pattern: 'ouf',        emoji: '🔥', mode: 'exact' },
  { pattern: 'fou',        emoji: '🔥', mode: 'exact' },
  { pattern: 'chaud',      emoji: '🔥', mode: 'exact' },
  { pattern: 'fire',       emoji: '🔥', mode: 'exact' },
  { pattern: 'let\'s go',  emoji: '🚀', mode: 'includes' },
  { pattern: 'on y va',    emoji: '🚀', mode: 'includes' },
  { pattern: 'go',         emoji: '🚀', mode: 'exact' },
  { pattern: 'gg',         emoji: '🏆', mode: 'exact' },
  { pattern: 'easy',       emoji: '😎', mode: 'exact' },
  { pattern: 'facile',     emoji: '😎', mode: 'exact' },
  { pattern: 'clutch',     emoji: '🏆', mode: 'exact' },

  // ── Victory / Win ──
  { pattern: 'gagné',      emoji: '🏆', mode: 'includes' },
  { pattern: 'victoire',   emoji: '🏆', mode: 'includes' },
  { pattern: 'win',        emoji: '🏆', mode: 'exact' },
  { pattern: 'won',        emoji: '🏆', mode: 'exact' },
  { pattern: 'champion',   emoji: '🏆', mode: 'includes' },
  { pattern: 'record',     emoji: '🏆', mode: 'exact' },
  { pattern: 'top',        emoji: '👑', mode: 'exact' },

  // ── Negative / Shock ──
  { pattern: 'non',        emoji: '😱', mode: 'exact' },
  { pattern: 'no',         emoji: '😱', mode: 'exact' },
  { pattern: 'impossible', emoji: '😱', mode: 'includes' },
  { pattern: 'choc',       emoji: '😱', mode: 'exact' },
  { pattern: 'shocked',    emoji: '😱', mode: 'includes' },
  { pattern: 'quoi',       emoji: '😳', mode: 'exact' },
  { pattern: 'what',       emoji: '😳', mode: 'exact' },
  { pattern: 'wait',       emoji: '😳', mode: 'exact' },
  { pattern: 'attends',    emoji: '😳', mode: 'exact' },
  { pattern: 'rip',        emoji: '💀', mode: 'exact' },

  // ── Emotion ──
  { pattern: 'love',       emoji: '❤️', mode: 'exact' },
  { pattern: 'amour',      emoji: '❤️', mode: 'exact' },
  { pattern: 'adore',      emoji: '❤️', mode: 'includes' },
  { pattern: 'triste',     emoji: '😢', mode: 'includes' },
  { pattern: 'sad',        emoji: '😢', mode: 'exact' },
  { pattern: 'pleure',     emoji: '😢', mode: 'includes' },
  { pattern: 'crying',     emoji: '😢', mode: 'includes' },
  { pattern: 'peur',       emoji: '😨', mode: 'exact' },
  { pattern: 'scared',     emoji: '😨', mode: 'includes' },

  // ── Money / Success ──
  { pattern: 'argent',     emoji: '💰', mode: 'exact' },
  { pattern: 'money',      emoji: '💰', mode: 'exact' },
  { pattern: 'million',    emoji: '💰', mode: 'includes' },
  { pattern: 'milliard',   emoji: '💰', mode: 'includes' },
  { pattern: 'billion',    emoji: '💰', mode: 'includes' },
  { pattern: 'euro',       emoji: '💶', mode: 'includes' },
  { pattern: 'dollar',     emoji: '💵', mode: 'includes' },

  // ── Gaming-specific ──
  { pattern: 'headshot',   emoji: '🎯', mode: 'includes' },
  { pattern: 'snipe',      emoji: '🎯', mode: 'includes' },
  { pattern: 'kill',       emoji: '💥', mode: 'exact' },
  { pattern: 'elimination',emoji: '💥', mode: 'includes' },
  { pattern: 'noscope',    emoji: '🎯', mode: 'includes' },
  { pattern: 'pentakill',  emoji: '⚡', mode: 'includes' },
  { pattern: 'ace',        emoji: '⚡', mode: 'exact' },
  { pattern: 'clutch',     emoji: '⚡', mode: 'exact' },
  { pattern: 'rage',       emoji: '😤', mode: 'includes' },
  { pattern: 'nerf',       emoji: '📉', mode: 'exact' },
  { pattern: 'buff',       emoji: '📈', mode: 'exact' },
  { pattern: 'OP',         emoji: '💪', mode: 'exact' },
  { pattern: 'broken',     emoji: '💪', mode: 'exact' },
  { pattern: 'pété',       emoji: '💪', mode: 'exact' },

  // ── Thinking / Ideas ──
  { pattern: 'secret',     emoji: '🤫', mode: 'includes' },
  { pattern: 'astuce',     emoji: '💡', mode: 'includes' },
  { pattern: 'trick',      emoji: '💡', mode: 'includes' },
  { pattern: 'tip',        emoji: '💡', mode: 'exact' },
  { pattern: 'attention',  emoji: '⚠️', mode: 'includes' },
  { pattern: 'warning',    emoji: '⚠️', mode: 'includes' },
  { pattern: 'important',  emoji: '⚠️', mode: 'includes' },

  // ── Exclamation energy ──
  { pattern: 'boom',       emoji: '💥', mode: 'exact' },
  { pattern: 'bang',       emoji: '💥', mode: 'exact' },
  { pattern: 'wow',        emoji: '🤩', mode: 'exact' },
  { pattern: 'waouh',      emoji: '🤩', mode: 'exact' },
  { pattern: 'omg',        emoji: '🤩', mode: 'exact' },
  { pattern: 'bruh',       emoji: '💀', mode: 'exact' },
  { pattern: 'bro',        emoji: '🤝', mode: 'exact' },
  { pattern: 'frérot',     emoji: '🤝', mode: 'exact' },
]

/**
 * Normalize a word for matching: lowercase, strip punctuation.
 */
function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-zéèêëàâùûîïôçœæ']/gi, '')
}

/**
 * Check if a word matches any emoji rule.
 * Returns the emoji string or null.
 */
function matchEmoji(word: string): string | null {
  const clean = normalize(word)
  if (!clean) return null

  for (const rule of EMOJI_RULES) {
    if (rule.mode === 'exact') {
      if (clean === rule.pattern) return rule.emoji
    } else {
      if (clean.includes(rule.pattern)) return rule.emoji
    }
  }
  return null
}

/**
 * Process word timestamps and insert emojis after matching words.
 *
 * Strategy: When a word matches, append the emoji to the word text.
 * This preserves timing — the emoji appears with the word in karaoke mode.
 *
 * Deduplication: won't add the same emoji to consecutive words (avoids 😂😂😂).
 */
export function insertAutoEmojis(words: WordTimestamp[]): WordTimestamp[] {
  let lastEmoji: string | null = null

  return words.map((w) => {
    const emoji = matchEmoji(w.word)

    if (emoji && emoji !== lastEmoji) {
      lastEmoji = emoji
      return { ...w, word: `${w.word} ${emoji}` }
    }

    // Reset dedup tracker if no match
    if (!emoji) lastEmoji = null

    return w
  })
}

/**
 * Check for multi-word phrases by looking at sliding windows.
 * Handles phrases like "let's go", "on y va" across word boundaries.
 */
export function insertAutoEmojisWithPhrases(words: WordTimestamp[]): WordTimestamp[] {
  const PHRASE_RULES: { words: string[]; emoji: string }[] = [
    { words: ['let\'s', 'go'],    emoji: '🚀' },
    { words: ['lets', 'go'],      emoji: '🚀' },
    { words: ['on', 'y', 'va'],   emoji: '🚀' },
    { words: ['c\'est', 'fini'],  emoji: '🏁' },
    { words: ['oh', 'my', 'god'], emoji: '🤩' },
    { words: ['je', 'pleure'],    emoji: '😢' },
    { words: ['trop', 'fort'],    emoji: '💪' },
    { words: ['bien', 'joué'],    emoji: '👏' },
    { words: ['well', 'played'],  emoji: '👏' },
    { words: ['no', 'way'],       emoji: '😱' },
  ]

  // First mark phrase matches (last word of each phrase gets the emoji)
  const phraseEmojis = new Map<number, string>()

  for (const rule of PHRASE_RULES) {
    const phraseLen = rule.words.length
    for (let i = 0; i <= words.length - phraseLen; i++) {
      const windowWords = words.slice(i, i + phraseLen).map((w) => normalize(w.word))
      if (windowWords.every((w, idx) => w === rule.words[idx])) {
        phraseEmojis.set(i + phraseLen - 1, rule.emoji)
      }
    }
  }

  // Apply phrase emojis first, then single-word emojis
  let lastEmoji: string | null = null

  return words.map((w, i) => {
    const phraseEmoji = phraseEmojis.get(i)
    if (phraseEmoji) {
      lastEmoji = phraseEmoji
      return { ...w, word: `${w.word} ${phraseEmoji}` }
    }

    const emoji = matchEmoji(w.word)
    if (emoji && emoji !== lastEmoji) {
      lastEmoji = emoji
      return { ...w, word: `${w.word} ${emoji}` }
    }

    if (!emoji) lastEmoji = null
    return w
  })
}
