import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  detectPhase,
  analyzePerformances,
  type PublicationPerformance,
  type AccountIntelligence,
} from '@/lib/distribution/smart-publisher'

const optimizeSchema = z.object({
  niche: z.string().max(50).optional(),
})

interface NichePreset {
  max_posts_per_day: number
  min_hours_between_posts: number
  default_hashtags: string[]
  optimal_hours: Record<string, number[]>
  caption_template: string
}

const NICHE_PRESETS: Record<string, NichePreset> = {
  gaming: {
    max_posts_per_day: 3,
    min_hours_between_posts: 3,
    default_hashtags: [
      'gaming', 'gamer', 'clips', 'twitch', 'streamer',
      'epicmoment', 'gamingclips', 'viral', 'fyp',
    ],
    optimal_hours: {
      tiktok: [12, 17, 21],
      youtube: [14, 20],
      instagram: [13, 18, 21],
    },
    caption_template: '🎮 {title}\n\n#gaming #clips #viral #fyp',
  },
  irl: {
    max_posts_per_day: 2,
    min_hours_between_posts: 4,
    default_hashtags: [
      'irl', 'lifestyle', 'funny', 'viral', 'fyp',
      'streamer', 'lol', 'moment', 'trending',
    ],
    optimal_hours: {
      tiktok: [7, 12, 17, 21],
      youtube: [8, 14, 20],
      instagram: [9, 13, 18, 21],
    },
    caption_template: '😂 {title}\n\n#funny #viral #fyp #irl',
  },
  fps: {
    max_posts_per_day: 3,
    min_hours_between_posts: 3,
    default_hashtags: [
      'fps', 'valorant', 'csgo', 'aim', 'headshot',
      'gaming', 'clips', 'viral', 'fyp', 'insane',
    ],
    optimal_hours: {
      tiktok: [12, 17, 21],
      youtube: [14, 20],
      instagram: [13, 18, 21],
    },
    caption_template: '🎯 {title}\n\n#fps #gaming #clips #viral #fyp',
  },
  moba: {
    max_posts_per_day: 2,
    min_hours_between_posts: 4,
    default_hashtags: [
      'league', 'lol', 'dota', 'moba', 'outplay',
      'gaming', 'clips', 'viral', 'fyp',
    ],
    optimal_hours: {
      tiktok: [12, 17, 21],
      youtube: [14, 20],
      instagram: [13, 18, 21],
    },
    caption_template: '⚔️ {title}\n\n#moba #gaming #clips #viral #fyp',
  },
}

const DEFAULT_PRESET: NichePreset = {
  max_posts_per_day: 3,
  min_hours_between_posts: 3,
  default_hashtags: [
    'viral', 'fyp', 'clips', 'trending', 'streamer',
    'funny', 'epic', 'moment',
  ],
  optimal_hours: {
    tiktok: [7, 12, 17, 21],
    youtube: [8, 14, 20],
    instagram: [9, 13, 18, 21],
  },
  caption_template: '🔥 {title}\n\n#viral #fyp #clips #trending',
}

export const POST = withAuth(async (req, user) => {
  const body = await req.json()
  const parsed = optimizeSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const niche = parsed.data.niche?.toLowerCase() ?? null
  const preset = (niche && NICHE_PRESETS[niche]) ? NICHE_PRESETS[niche] : DEFAULT_PRESET

  const supabase = createAdminClient()

  // Check if we have enough data to use smart optimization
  const { data: performances } = await supabase
    .from('publication_performance')
    .select('*')
    .eq('user_id', user.id)
    .order('posted_at', { ascending: false })
    .limit(200)

  const perfs = (performances ?? []) as PublicationPerformance[]
  const totalPosts = perfs.length
  const phase = detectPhase(totalPosts)

  let optimizedSettings: Record<string, unknown> = {
    user_id: user.id,
    niche,
    max_posts_per_day: preset.max_posts_per_day,
    min_hours_between_posts: preset.min_hours_between_posts,
    default_hashtags: preset.default_hashtags,
    optimal_hours: preset.optimal_hours,
    caption_template: preset.caption_template,
    ai_optimized: true,
    updated_at: new Date().toISOString(),
  }

  let phaseMessage = 'Setting up test schedule to discover your best posting times...'

  // Phase optimizing/scaling: use real performance data
  if (phase !== 'testing' && perfs.length >= 15) {
    // Analyze per-platform
    const platforms = ['tiktok', 'youtube', 'instagram']
    const smartOptimalHours: Record<string, number[]> = { ...preset.optimal_hours }

    for (const platform of platforms) {
      const analysis = analyzePerformances(perfs, platform)
      if (analysis.bestHours.length > 0) {
        smartOptimalHours[platform] = analysis.bestHours.map(h => h.hour)
      }
      // Use optimal frequency if discovered
      if (analysis.optimalPostsPerDay != null) {
        optimizedSettings.max_posts_per_day = analysis.optimalPostsPerDay
      }
    }

    optimizedSettings.optimal_hours = smartOptimalHours

    if (phase === 'optimizing') {
      phaseMessage = `Analyzing your ${totalPosts} posts to find optimal patterns...`
    } else {
      phaseMessage = 'Fine-tuning your strategy based on momentum...'
    }

    // Also update account intelligence per platform
    for (const platform of platforms) {
      const analysis = analyzePerformances(perfs, platform)
      const platformPerfs = perfs.filter(p => p.platform === platform)
      if (platformPerfs.length > 0) {
        await supabase
          .from('account_intelligence')
          .upsert({
            user_id: user.id,
            platform,
            phase,
            total_posts: platformPerfs.length,
            best_hours: JSON.parse(JSON.stringify(analysis.bestHours)),
            worst_hours: JSON.parse(JSON.stringify(analysis.worstHours)),
            optimal_posts_per_day: analysis.optimalPostsPerDay,
            best_clip_duration_range: analysis.bestDurationRange ? JSON.parse(JSON.stringify(analysis.bestDurationRange)) : null,
            captions_boost_percent: analysis.captionsBoost,
            split_screen_boost_percent: analysis.splitScreenBoost,
            current_momentum: analysis.momentum,
            hot_threshold: analysis.adjustedHotThreshold || 75,
            flop_threshold: analysis.adjustedFlopThreshold || 25,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
      }
    }
  }

  const { data, error } = await supabase
    .from('distribution_settings')
    .upsert(optimizedSettings, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ ...data, phase, phaseMessage })
})
