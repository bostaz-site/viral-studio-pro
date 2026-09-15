/**
 * Signal-triggered outbound: when a followed streamer spikes, promote
 * matching influencer leads with fresh clip data for cold email priority.
 *
 * No email is sent here — this only enriches and prioritizes.
 * Sending stays in Instantly with the 12/day cap.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import Anthropic from '@anthropic-ai/sdk'

interface SpikeInput {
  streamerLogin: string
  platform: 'twitch' | 'kick'
  clipTitle: string
  clipId: string
}

interface SpikeResult {
  triggered: boolean
  influencerId?: string
  reason?: string
}

/**
 * Given a spiking streamer, find matching influencer leads and enrich them.
 * Sets tag 'spike', refreshes recent_video_titles, regenerates compliment,
 * and stores demo_clip_url if a 3/3 render exists.
 */
export async function handleSpikeTrigger(input: SpikeInput): Promise<SpikeResult> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // 1. Find influencer by platform_handle matching streamer login
  const { data: influencer } = await db
    .from('influencers')
    .select('id, status, email, platform_handle, tags, recent_video_titles, notes, unsubscribed, has_bounced')
    .or(`platform_handle.eq.${input.streamerLogin},platform_handle.ilike.${input.streamerLogin}`)
    .single()

  if (!influencer) {
    return { triggered: false, reason: 'no_matching_influencer' }
  }

  // 2. Check status eligibility
  const eligibleStatuses = new Set(['cold', 'queued'])
  if (!eligibleStatuses.has(influencer.status)) {
    return { triggered: false, influencerId: influencer.id, reason: `status_${influencer.status}` }
  }

  // 3. Check suppression
  if (influencer.unsubscribed || influencer.has_bounced) {
    return { triggered: false, influencerId: influencer.id, reason: 'suppressed' }
  }

  const { data: suppressed } = await db
    .from('suppression_list')
    .select('id')
    .eq('email', influencer.email)
    .limit(1)

  if (suppressed && suppressed.length > 0) {
    return { triggered: false, influencerId: influencer.id, reason: 'suppressed' }
  }

  // 4. Enrich: tag, follow-up, recent titles
  const existingTags: string[] = influencer.tags ?? []
  const newTags = existingTags.includes('spike') ? existingTags : [...existingTags, 'spike']

  const existingTitles: string[] = Array.isArray(influencer.recent_video_titles)
    ? influencer.recent_video_titles
    : []
  const updatedTitles = [input.clipTitle, ...existingTitles.filter(t => t !== input.clipTitle)].slice(0, 5)

  const updates: Record<string, unknown> = {
    tags: newTags,
    next_follow_up_at: new Date().toISOString(),
    recent_video_titles: updatedTitles,
    updated_at: new Date().toISOString(),
  }

  // 5. Regenerate ai_specific_compliment
  const compliment = await generateCompliment(input.streamerLogin, input.clipTitle)
  if (compliment) {
    updates.ai_specific_compliment = compliment
  }

  // 6. Check for a 3/3 render of the spiking clip
  const demoUrl = await findDemoClipUrl(db, input.clipId)
  if (demoUrl) {
    updates.notes = JSON.stringify({ ...(parseNotes(influencer.notes)), demo_clip_url: demoUrl })
  }

  await db.from('influencers').update(updates).eq('id', influencer.id)

  logger.info(
    { influencerId: influencer.id, streamer: input.streamerLogin, clipTitle: input.clipTitle },
    'Spike trigger: influencer enriched and prioritized'
  )

  return { triggered: true, influencerId: influencer.id }
}

async function generateCompliment(streamerLogin: string, clipTitle: string): Promise<string | null> {
  try {
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: 'Write a 1-sentence specific compliment about this streamer\'s clip that would work in a cold email. Be genuine, short, no hype. Output ONLY the sentence.',
      messages: [{ role: 'user', content: `Streamer: ${streamerLogin}\nClip: "${clipTitle}"` }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : null
    return text
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'Failed to generate spike compliment')
    return null
  }
}

async function findDemoClipUrl(
  db: ReturnType<typeof createAdminClient>,
  clipId: string
): Promise<string | null> {
  try {
    const { data: renderJob } = await (db as ReturnType<typeof Object>)
      .from('render_jobs')
      .select('output_url, render_contract')
      .eq('clip_id', clipId)
      .in('status', ['done', 'degraded'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!renderJob?.output_url) return null

    // Check transform score 3/3
    const contract = renderJob.render_contract as Record<string, unknown> | null
    if (contract && typeof contract.transform_score === 'number' && contract.transform_score >= 3) {
      return renderJob.output_url as string
    }

    return null
  } catch {
    return null
  }
}

function parseNotes(notes: unknown): Record<string, unknown> {
  if (!notes) return {}
  if (typeof notes === 'object') return notes as Record<string, unknown>
  try {
    return JSON.parse(String(notes))
  } catch {
    return { original: String(notes) }
  }
}
