/* ─── Clip Verdict Engine ───
 * Pure functions that generate contextual verdicts, CTAs, and colors
 * from a TrendingClip's real sub-scores. No side effects.
 */

import type { TrendingClip } from '@/types/trending'

// ── 1. Contextual verdict ──

export function getClipVerdict(clip: TrendingClip): { text: string; reason: string } {
  const early = clip.early_signal_score ?? 0
  const sat = clip.saturation_score ?? 0
  const mom = clip.momentum_score ?? 0
  const rec = clip.recency_score ?? 0
  const anom = clip.anomaly_score ?? 0
  const eng = clip.engagement_score ?? 0
  const fmt = clip.format_score ?? 0
  const vs = clip.velocity_score ?? 0

  if (early >= 60 && sat <= 30)
    return { text: 'Exploding \u2014 catch it now', reason: 'Early spike + low saturation' }

  if (mom >= 70 && rec >= 60)
    return { text: 'Surging fast', reason: 'High momentum + fresh clip' }

  if (mom >= 70)
    return { text: 'Strong momentum', reason: 'Trending velocity above average' }

  if (anom >= 70)
    return { text: 'Outperforming expectations', reason: "Beats streamer's usual performance" }

  if (eng >= 75 && fmt === 100)
    return { text: 'Perfect setup', reason: 'High engagement + ideal format' }

  if (eng >= 70)
    return { text: 'High engagement clip', reason: 'Strong like-to-view ratio' }

  if (early >= 40)
    return { text: 'Early signal detected', reason: 'Gaining traction fast' }

  if (vs >= 60)
    return { text: 'Consistent banger', reason: 'Solid metrics across the board' }

  if (vs >= 40)
    return { text: 'Could pop with the right hook', reason: 'Needs a strong intro to stand out' }

  if (rec <= 20 && vs >= 30)
    return { text: 'Late but still climbing', reason: 'Older clip still gaining views' }

  return { text: 'Wild card', reason: 'Test it with your audience' }
}

// ── 2. Dynamic CTA ──

export type CTAIcon = 'Flame' | 'Sparkles' | 'SlidersHorizontal' | 'Zap'

export function getDynamicCTA(clip: TrendingClip): { label: string; icon: CTAIcon } {
  const vs = clip.velocity_score ?? 0

  if (vs >= 80) return { label: 'Steal this clip', icon: 'Flame' }
  if (vs >= 65) return { label: 'Remix & post', icon: 'Sparkles' }
  if (vs >= 45) return { label: 'Needs a hook', icon: 'SlidersHorizontal' }
  return { label: 'Test it', icon: 'Zap' }
}

// ── 3. Verdict color ──

export function getVerdictColor(score: number): string {
  if (score >= 80) return '#FDBA74' // orange-300
  if (score >= 65) return '#A78BFA' // violet-400
  if (score >= 45) return '#94A3B8' // slate-400
  return '#71717A'                  // zinc-500
}
