/**
 * Output Quality Agent — runs DAILY
 *
 * Reads the 5 most recent rendered clips from the past 24h.
 * Asks Claude to score them on caption sync, hook timing, visual quality,
 * audio quality, and overall viral potential.
 * Generates findings for any score below 70.
 * Tracks daily average via insertMetricSnapshot.
 *
 * Run: npx tsx scripts/audits/output-quality.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { claude } from '../../lib/audit/agent-runner'
import { insertFinding } from '../../lib/audit/insert-finding'
import { insertMetricSnapshot } from '../../lib/audit/insert-metric'
import { execSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

interface ClipScores {
  caption_sync: number
  hook_timing: number
  visual_quality: number
  audio_quality: number
  viral_potential: number
}

interface ClipAnalysis {
  scores: ClipScores
  findings: Array<{
    severity: 'critical' | 'high' | 'normal' | 'low'
    title: string
    description: string
    location: string
    suggested_fix: string
  }>
}

function getFfmpegPath(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('ffmpeg-static') as string
  } catch {
    // Fallback: check if ffmpeg is on PATH
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' })
      return 'ffmpeg'
    } catch {
      return null
    }
  }
}

function extractFrames(
  videoPath: string,
  outputDir: string,
  ffmpegPath: string,
  count: number = 4
): string[] {
  // Get video duration first
  const durationOutput = execSync(
    `"${ffmpegPath}" -i "${videoPath}" 2>&1 || true`,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  ).toString()

  const durationMatch = durationOutput.match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/)
  const totalSeconds = durationMatch
    ? parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseInt(durationMatch[3])
    : 30

  const frames: string[] = []
  for (let i = 0; i < count; i++) {
    const timestamp = Math.floor((totalSeconds / (count + 1)) * (i + 1))
    const outFile = join(outputDir, `frame_${i}.jpg`)
    try {
      execSync(
        `"${ffmpegPath}" -ss ${timestamp} -i "${videoPath}" -frames:v 1 -q:v 2 "${outFile}" -y 2>/dev/null`,
        { stdio: 'ignore' }
      )
      frames.push(outFile)
    } catch {
      // Frame extraction failed for this timestamp, skip
    }
  }
  return frames
}

export async function runOutputQualityAudit() {
  console.log('[output-quality] Starting audit...')
  const admin = createAdminClient()

  // 1. Get 5 most recent rendered clips from last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: jobs } = await admin
    .from('render_jobs')
    .select('id, clip_id, source, storage_path, clip_url, created_at')
    .eq('status', 'done')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!jobs || jobs.length === 0) {
    console.log('[output-quality] No rendered clips in the last 24h, skipping.')
    await insertMetricSnapshot({
      metric_name: 'output_quality_clips_analyzed',
      metric_value: 0,
      metric_unit: 'count',
    })
    return
  }

  console.log(`[output-quality] Found ${jobs.length} clips to analyze`)

  const ffmpegPath = getFfmpegPath()
  const allScores: ClipScores[] = []

  for (const job of jobs) {
    try {
      const analysis = await analyzeClip(admin, job, ffmpegPath)
      if (analysis) {
        allScores.push(analysis.scores)
        // Insert findings for low scores
        for (const finding of analysis.findings) {
          await insertFinding({
            agent_type: 'output',
            severity: finding.severity,
            title: finding.title,
            description: finding.description,
            location: finding.location,
            suggested_fix: finding.suggested_fix,
          })
        }
      }
    } catch (err) {
      console.error(`[output-quality] Failed to analyze clip ${job.id}:`, err)
    }
  }

  // 2. Calculate and store average scores
  if (allScores.length > 0) {
    const avg = (key: keyof ClipScores) =>
      allScores.reduce((sum, s) => sum + s[key], 0) / allScores.length

    const overallAvg = avg('viral_potential')

    await insertMetricSnapshot({
      metric_name: 'output_quality_avg',
      metric_value: Math.round(overallAvg * 10) / 10,
      metric_unit: 'percentage',
      regression_threshold_percent: 10,
    })
    await insertMetricSnapshot({
      metric_name: 'output_caption_sync_avg',
      metric_value: Math.round(avg('caption_sync') * 10) / 10,
      metric_unit: 'percentage',
    })
    await insertMetricSnapshot({
      metric_name: 'output_hook_timing_avg',
      metric_value: Math.round(avg('hook_timing') * 10) / 10,
      metric_unit: 'percentage',
    })
    await insertMetricSnapshot({
      metric_name: 'output_clips_analyzed',
      metric_value: allScores.length,
      metric_unit: 'count',
    })

    console.log(`[output-quality] Analyzed ${allScores.length} clips, avg quality: ${overallAvg.toFixed(1)}`)
  }
}

async function analyzeClip(
  admin: ReturnType<typeof createAdminClient>,
  job: { id: string; clip_id: string; source: string; storage_path: string | null; clip_url: string | null; created_at: string | null },
  ffmpegPath: string | null
): Promise<ClipAnalysis | null> {
  // Try to get transcription for this clip
  let transcript = ''
  const { data: transcription } = await admin
    .from('transcriptions')
    .select('full_text')
    .eq('video_id', job.clip_id)
    .maybeSingle()

  if (transcription?.full_text) {
    transcript = transcription.full_text
  }

  // Build content blocks for Claude
  const contentBlocks: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } }> = []

  // Try to extract frames if ffmpeg is available and we have a storage path
  let tmpDir: string | null = null
  if (ffmpegPath && job.storage_path) {
    tmpDir = mkdtempSync(join(tmpdir(), 'audit-'))
    try {
      // Download clip from Supabase Storage
      const bucket = job.source === 'trending' ? 'clips' : 'clips'
      const { data: signedUrl } = await admin.storage
        .from(bucket)
        .createSignedUrl(job.storage_path, 300)

      if (signedUrl?.signedUrl) {
        const videoPath = join(tmpDir, 'clip.mp4')
        execSync(`curl -sL -o "${videoPath}" "${signedUrl.signedUrl}"`, { stdio: 'ignore' })

        const frames = extractFrames(videoPath, tmpDir, ffmpegPath)
        for (const framePath of frames) {
          const frameData = readFileSync(framePath).toString('base64')
          contentBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: frameData },
          })
        }
      }
    } catch (err) {
      console.warn(`[output-quality] Frame extraction failed for ${job.id}:`, err)
    }
  }

  // Add text prompt
  contentBlocks.push({
    type: 'text',
    text: `Analyze this rendered clip (ID: ${job.id}).

${transcript ? `Transcript: "${transcript}"` : 'No transcript available.'}

Clip metadata:
- Source: ${job.source}
- Rendered at: ${job.created_at}
${contentBlocks.length > 0 ? `- ${contentBlocks.filter(b => b.type === 'image').length} key frames attached` : '- No frames available (text-only analysis)'}

Score this clip on these dimensions (0-100 each):
- caption_sync: How well do captions sync with speech timing?
- hook_timing: Is the most engaging moment near the start?
- visual_quality: Composition, zoom quality, B-roll relevance
- audio_quality: Clarity, levels, music balance
- viral_potential: Overall likelihood of performing well on TikTok/Reels

For each score below 70, generate a finding with:
- severity (critical if <50, high if <60, normal if <70)
- title, description, location (reference the render pipeline), suggested_fix

Return JSON only:
{
  "scores": { "caption_sync": N, "hook_timing": N, "visual_quality": N, "audio_quality": N, "viral_potential": N },
  "findings": [{ "severity": "...", "title": "...", "description": "...", "location": "...", "suggested_fix": "..." }]
}`,
  })

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: 'You are a senior video editor at MrBeast Studios. You obsess over every detail of short-form viral content. Score honestly — most clips should be 60-80, only exceptional ones above 90. Output JSON only.',
    messages: [{ role: 'user', content: contentBlocks }],
  })

  // Cleanup temp files
  if (tmpDir) {
    try { rmSync(tmpDir, { recursive: true }) } catch { /* ignore */ }
  }

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  return JSON.parse(jsonMatch[0]) as ClipAnalysis
}

// Allow standalone execution
if (require.main === module) {
  runOutputQualityAudit()
    .then(() => { console.log('[output-quality] Done.'); process.exit(0) })
    .catch((err) => { console.error('[output-quality] Fatal:', err); process.exit(1) })
}
