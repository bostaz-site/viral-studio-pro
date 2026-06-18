/**
 * The AI Scout — runs TUESDAY + SATURDAY
 *
 * Scans AI news sources for new capabilities that could integrate
 * with viralanimal.com. Proposes MAX 3 strategic moves with evidence.
 *
 * Run: npx tsx scripts/audits/ai-scout.ts
 */

import { runStrategicAgent } from '../../lib/audit/strategic-runner'

const AI_SOURCES = [
  { name: 'Anthropic Blog', url: 'https://www.anthropic.com/news' },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog' },
  { name: 'ElevenLabs Blog', url: 'https://elevenlabs.io/blog' },
  { name: 'Product Hunt AI', url: 'https://www.producthunt.com/topics/artificial-intelligence' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com' },
]

export async function runAIScout() {
  console.log('[ai-scout] Starting...')

  // Fetch content from AI sources
  const sourceResults: Array<{ source: string; content: string }> = []

  for (const source of AI_SOURCES) {
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'ViralAnimal-AuditBot/1.0' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        console.warn(`[ai-scout] ${source.name}: HTTP ${res.status}`)
        continue
      }
      const html = await res.text()
      // Extract text content (strip tags, keep first 3000 chars)
      const textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000)
      sourceResults.push({ source: source.name, content: textContent })
      console.log(`[ai-scout] ${source.name}: fetched ${textContent.length} chars`)
    } catch (err) {
      console.warn(`[ai-scout] ${source.name}: fetch failed`, err instanceof Error ? err.message : err)
    }
  }

  if (sourceResults.length === 0) {
    console.warn('[ai-scout] No sources fetched — skipping analysis')
    return
  }

  const result = await runStrategicAgent({
    agent_type: 'ai_scout',
    persona_prompt: 'an AI capabilities researcher who reads Anthropic, OpenAI, ElevenLabs, Product Hunt, and Hacker News every day. You map new AI capabilities to product opportunities for a video editing SaaS that targets content creators. You focus on capabilities that are AVAILABLE NOW (GA or beta), not vaporware.',
    inputs: {
      product_context: {
        name: 'Viral Animal',
        description: 'Video editing SaaS for creators — karaoke captions, split-screen, smart zoom, reordering, mood detection, multi-platform publishing',
        current_ai_stack: ['Claude Sonnet for mood detection', 'Whisper for transcription', 'FFmpeg for rendering'],
        competitors: ['Opus Clip', 'Submagic', 'Klap', 'Gling', 'Descript'],
      },
      ai_news_sources: sourceResults,
      instruction: 'For each new AI capability or product you find, evaluate: (1) Could this integrate with Viral Animal? (2) What specific use case? (3) How fast could competitors ship this? If a competitor already shipped it, mark as urgent.',
    },
  })

  console.log(`[ai-scout] Done. ${result.top_moves.length} moves proposed.`)
}

if (typeof require !== 'undefined' && require.main === module) {
  runAIScout()
    .then(() => process.exit(0))
    .catch((err) => { console.error('[ai-scout] Fatal:', err); process.exit(1) })
}
