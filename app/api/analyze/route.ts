import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runHookHunter, type HookHunterResult } from '@/lib/claude/hook-hunter'
import { runRetentionEditor, type RetentionEditorResult } from '@/lib/claude/retention-editor'
import { runCopywriterSeo, type CopywriterSeoResult } from '@/lib/claude/copywriter-seo'
import { runCreditManager, type CreditManagerResult } from '@/lib/claude/credit-manager'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import type { Json } from '@/lib/supabase/types'

const inputSchema = z.object({
  video_id: z.string().uuid(),
})

interface SkillResults {
  hookHunter: HookHunterResult | null
  retentionEditor: RetentionEditorResult | null
  copywriterSeo: CopywriterSeoResult | null
  creditManager: CreditManagerResult | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }

    // ── Rate limiting (AI operation: 5 req/min) ─────────────────────────────
    const rl = rateLimit(user.id, RATE_LIMITS.ai.limit, RATE_LIMITS.ai.windowMs)
    if (!rl.allowed) {
      return NextResponse.json(
        { data: null, error: 'Rate limited', message: `Trop de requêtes. Réessayez dans ${Math.ceil((rl.retryAfterMs ?? 0) / 1000)}s` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = inputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.message, message: 'Invalid input' },
        { status: 400 }
      )
    }

    const { video_id } = parsed.data
    const admin = createAdminClient()

    // Fetch video + transcription
    const { data: video, error: videoError } = await admin
      .from('videos')
      .select()
      .eq('id', video_id)
      .eq('user_id', user.id)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { data: null, error: 'Video not found', message: 'Video not found' },
        { status: 404 }
      )
    }

    const { data: transcription, error: transcriptionError } = await admin
      .from('transcriptions')
      .select()
      .eq('video_id', video_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (transcriptionError || !transcription) {
      return NextResponse.json(
        {
          data: null,
          error: 'Transcription not found',
          message: 'Run /api/transcribe first',
        },
        { status: 404 }
      )
    }

    await admin.from('videos').update({ status: 'analyzing' }).eq('id', video_id)

    // Run 4 Claude skills in parallel
    const videoDuration = video.duration_seconds ?? 300
    const isRemake =
      video.source_url !== null &&
      video.source_platform !== null &&
      video.source_platform !== 'upload'

    const [hookResult, retentionResult, copywriterResult, creditResult] =
      await Promise.allSettled([
        runHookHunter(transcription.full_text),
        runRetentionEditor(transcription.full_text, videoDuration),
        runCopywriterSeo(transcription.full_text),
        isRemake && video.source_url
          ? runCreditManager(
              video.title ?? 'Créateur inconnu',
              video.source_platform ?? 'unknown',
              video.source_url
            )
          : Promise.resolve(null),
      ])

    const skills: SkillResults = {
      hookHunter: hookResult.status === 'fulfilled' ? hookResult.value : null,
      retentionEditor: retentionResult.status === 'fulfilled' ? retentionResult.value : null,
      copywriterSeo: copywriterResult.status === 'fulfilled' ? copywriterResult.value : null,
      creditManager: creditResult.status === 'fulfilled' ? creditResult.value : null,
    }

    // Determine clip segments from Retention Editor, fallback to full video
    const MIN_CLIP_DURATION = 15 // seconds — clips shorter than this are dropped
    const rawSegments =
      skills.retentionEditor?.segments_to_keep && skills.retentionEditor.segments_to_keep.length > 0
        ? skills.retentionEditor.segments_to_keep
        : [{ start: 0, end: Math.min(videoDuration, 60), reason: 'Clip complet' }]

    // Filter out segments shorter than minimum duration
    const segments = rawSegments.filter((seg) => (seg.end - seg.start) >= MIN_CLIP_DURATION)

    // If all segments were filtered out, use fallback
    if (segments.length === 0) {
      segments.push({ start: 0, end: Math.min(videoDuration, 60), reason: 'Clip complet (fallback)' })
    }

    const hooks = skills.hookHunter?.hooks ?? []
    const bestHook = hooks[0] ?? null
    const globalRetentionScore = skills.retentionEditor?.estimated_retention_score ?? 70

    // Create clip records — each clip gets its own title from Retention Editor
    const clipsToInsert = segments.map((seg, idx) => {
      // Use segment-specific title if available, fallback to hooks, then video title
      const segTitle = ('title' in seg && typeof (seg as Record<string, unknown>).title === 'string')
        ? (seg as Record<string, unknown>).title as string
        : null
      const clipTitle = segTitle ?? hooks[idx % hooks.length]?.text ?? video.title ?? `Clip ${idx + 1}`

      return {
        video_id,
        user_id: user.id,
        title: clipTitle,
        start_time: seg.start,
        end_time: seg.end,
        duration_seconds: seg.end - seg.start,
        transcript_segment: seg.reason,
        aspect_ratio: '9:16',
        status: 'pending' as const,
        is_remake: isRemake,
      }
    })

    const { data: insertedClips, error: clipsError } = await admin
      .from('clips')
      .insert(clipsToInsert)
      .select()

    if (clipsError || !insertedClips) {
      await admin
        .from('videos')
        .update({ status: 'error', error_message: clipsError?.message })
        .eq('id', video_id)
      return NextResponse.json(
        { data: null, error: clipsError?.message, message: 'Failed to save clips' },
        { status: 500 }
      )
    }

    // Create UNIQUE viral scores per clip — based on segment intensity + hook quality
    const viralScoresToInsert = insertedClips.map((clip, idx) => {
      const seg = segments[idx]
      // Get segment-specific retention score if available, fallback to global
      const segRetention = ('retention_score' in seg && typeof (seg as Record<string, unknown>).retention_score === 'number')
        ? (seg as Record<string, unknown>).retention_score as number
        : globalRetentionScore
      const segIntensity = ('intensity' in seg && typeof (seg as Record<string, unknown>).intensity === 'number')
        ? (seg as Record<string, unknown>).intensity as number
        : 5

      // Assign different hooks to different clips for variety
      const hookForClip = hooks[idx % Math.max(hooks.length, 1)] ?? bestHook
      const hookStrength = hookForClip?.score ?? 60
      const hookType = hookForClip?.type ?? null
      const hookExplanation = hookForClip?.explanation ?? seg.reason

      // Intensity (1-10) maps to perceived value (30-95)
      const perceivedValue = Math.min(95, Math.max(30, Math.round(segIntensity * 10 + 5)))
      // Clip duration sweet spot: 30-60s is best
      const durationBonus = (clip.duration_seconds ?? 0) >= 30 && (clip.duration_seconds ?? 0) <= 60 ? 10 : 0
      const trendAlignment = Math.min(100, 50 + durationBonus + Math.round(segIntensity * 2))

      const overallScore = Math.round(
        hookStrength * 0.3 + segRetention * 0.3 + perceivedValue * 0.2 + trendAlignment * 0.2
      )

      return {
        clip_id: clip.id,
        score: Math.min(100, overallScore),
        hook_strength: hookStrength,
        emotional_flow: segRetention,
        perceived_value: perceivedValue,
        trend_alignment: trendAlignment,
        hook_type: hookType,
        explanation: hookExplanation,
        suggested_hooks: (hooks) as unknown as Json,
      }
    })

    await admin.from('viral_scores').insert(viralScoresToInsert)

    // Update video status to clipping
    await admin.from('videos').update({ status: 'clipping' }).eq('id', video_id)

    return NextResponse.json({
      data: {
        clips: insertedClips,
        skills_used: {
          hook_hunter: skills.hookHunter !== null,
          retention_editor: skills.retentionEditor !== null,
          copywriter_seo: skills.copywriterSeo !== null,
          credit_manager: skills.creditManager !== null,
        },
        captions: skills.copywriterSeo,
        credit: skills.creditManager,
      },
      error: null,
      message: `${insertedClips.length} clip(s) generated successfully`,
    })
  } catch (error) {
    console.error('[analyze] Error:', error)
    return NextResponse.json(
      { data: null, error: 'Internal server error', message: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
