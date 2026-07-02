/**
 * Validation script for peak detection.
 * Usage: npx tsx scripts/test-peak-detection.ts <clip_id_1> [clip_id_2] ...
 *
 * Reads trending_clips from Supabase, runs detectPeakMoment,
 * and prints a table with results.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Import the detection function dynamically (it's an ES module in VPS)
// We reimplement a minimal version here since the VPS module uses import syntax
// that tsx handles differently

const VIRAL_KEYWORDS_HIGH = [
  'no way', 'what the', 'oh my god', 'omg', 'holy', 'insane', 'crazy',
  'bro', 'bruh', 'dude', 'yo', 'wait', 'noooo', 'lets go', "let's go",
  'are you serious', 'seriously', 'impossible', 'clutch',
  'oh shit', 'what', 'how', 'why', 'nah', 'sheesh', 'goated',
]

function detectPeakSimple(wordTimestamps: { word: string; start: number; end: number }[], duration: number, isViewerClip: boolean) {
  const windowSize = 0.5
  const numWindows = Math.ceil(duration / windowSize)
  const scores = new Array(numWindows).fill(0)

  for (const wt of wordTimestamps) {
    const word = (wt.word || '').toLowerCase().trim()
    const t = wt.start || 0
    const idx = Math.min(Math.floor(t / windowSize), numWindows - 1)

    for (const kw of VIRAL_KEYWORDS_HIGH) {
      if (word.includes(kw) || kw.includes(word)) {
        scores[idx] += 3
        break
      }
    }
    if (wt.word === wt.word?.toUpperCase() && wt.word?.length > 2) {
      scores[idx] += 2
    }
  }

  // Smooth
  const smoothed = scores.map((_: number, i: number) => {
    const start = Math.max(0, i - 1)
    const end = Math.min(numWindows, i + 2)
    let sum = 0
    for (let j = start; j < end; j++) sum += scores[j]
    return sum / (end - start)
  })

  // Positional prior for viewer clips
  if (isViewerClip) {
    const oneThird = Math.floor(numWindows / 3)
    for (let i = 0; i < numWindows; i++) {
      if (i < oneThird) smoothed[i] *= 0.8
      else if (i >= oneThird * 2) smoothed[i] *= 1.3
    }
  }

  // Anti-edge
  const biasWindows = Math.ceil(1.0 / windowSize)
  for (let i = 0; i < biasWindows && i < smoothed.length; i++) smoothed[i] *= 0.3
  for (let i = smoothed.length - biasWindows; i < smoothed.length; i++) {
    if (i >= 0) smoothed[i] *= 0.5
  }

  let peakIdx = 0, peakScore = 0
  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i] > peakScore) { peakScore = smoothed[i]; peakIdx = i }
  }

  const peakTime = peakIdx * windowSize

  // Extract transcript around peak
  const halfWindow = 2.5
  const peakWords = wordTimestamps
    .filter(w => w.start >= peakTime - halfWindow && w.start <= peakTime + halfWindow)
    .map(w => w.word)
    .join(' ')

  return { peakTime: Math.round(peakTime * 100) / 100, peakScore: Math.round(peakScore * 100) / 100, peakTranscript: peakWords }
}

async function main() {
  const ids = process.argv.slice(2)
  if (ids.length === 0) {
    console.log('Usage: npx tsx scripts/test-peak-detection.ts <clip_id_1> [clip_id_2] ...')
    console.log('       npx tsx scripts/test-peak-detection.ts --recent 10')

    // Default: pick 5 recent clips with transcriptions
    const { data } = await supabase
      .from('trending_clips')
      .select('id, title, platform, duration_seconds, external_url')
      .not('title', 'is', null)
      .gt('duration_seconds', 10)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!data || data.length === 0) {
      console.log('No trending clips found.')
      return
    }

    ids.push(...data.map(c => c.id))
  }

  if (ids[0] === '--recent') {
    const limit = parseInt(ids[1] || '10')
    const { data } = await supabase
      .from('trending_clips')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (data) ids.splice(0, ids.length, ...data.map(c => c.id))
  }

  console.log(`\nTesting peak detection on ${ids.length} clips...\n`)
  console.log('| Clip ID | Title | Platform | Duration | Peak Time | Score | Transcript (5s around peak) |')
  console.log('|---------|-------|----------|----------|-----------|-------|-----------------------------|')

  for (const id of ids) {
    const { data: clip } = await supabase
      .from('trending_clips')
      .select('id, title, platform, duration_seconds, external_url')
      .eq('id', id)
      .single()

    if (!clip) {
      console.log(`| ${id.slice(0, 8)}... | NOT FOUND | - | - | - | - | - |`)
      continue
    }

    // Try to find transcription
    const { data: transcription } = await supabase
      .from('transcriptions')
      .select('word_timestamps')
      .eq('video_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const wordTimestamps = (transcription?.word_timestamps as { word: string; start: number; end: number }[]) || []
    const isViewerClip = clip.platform === 'twitch' || clip.platform === 'kick'
    const duration = clip.duration_seconds || 30

    const result = detectPeakSimple(wordTimestamps, duration, isViewerClip)

    const title = (clip.title || '').slice(0, 40).padEnd(40)
    const transcript = (result.peakTranscript || '(no transcript)').slice(0, 60)

    console.log(`| ${id.slice(0, 8)}... | ${title} | ${clip.platform?.padEnd(6) || '?     '} | ${duration.toFixed(0).padStart(4)}s | ${result.peakTime.toFixed(1).padStart(6)}s | ${result.peakScore.toFixed(1).padStart(5)} | ${transcript} |`)
  }

  console.log('\nDone.')
}

main().catch(console.error)
