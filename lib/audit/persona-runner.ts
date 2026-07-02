import { config } from 'dotenv'
config({ path: '.env.local' })
import { chromium, Page } from 'playwright'
import Anthropic from '@anthropic-ai/sdk'
import { insertFinding } from './insert-finding'
import { createAdminClient } from '../supabase/admin'
import { logAiCall } from '../ai/call-logger'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface TraceStep {
  url: string
  action: string
  screenshot: Buffer
}

export interface PersonaConfig {
  persona_key: 'sceptical' | 'free_limit' | 'power'
  persona_prompt: string
  goal: string
  test_credentials?: { email: string; password: string }
  scenario: (page: Page) => Promise<TraceStep[]>
}

export async function runPersona(config: PersonaConfig) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

  const trace = await config.scenario(page)
  await browser.close()

  // Upload screenshots to Supabase Storage
  const admin = createAdminClient()
  const screenshotUrls: string[] = []

  for (let i = 0; i < trace.length; i++) {
    const filename = `${config.persona_key}/${Date.now()}-step${i}.png`
    await admin.storage.from('audit-screenshots').upload(filename, trace[i].screenshot, {
      contentType: 'image/png',
    })
    const { data: { publicUrl } } = admin.storage
      .from('audit-screenshots')
      .getPublicUrl(filename)
    screenshotUrls.push(publicUrl)
  }

  // Ask Claude to analyze the journey
  const systemPrompt = `You are ${config.persona_prompt}.

You just visited Viral Animal (https://viralanimal.com) with this goal: "${config.goal}".

Analyze your experience and report:
- Aha moments (what worked, what made sense)
- Frictions (what was confusing, slow, unclear)
- Bugs (anything broken)

Output JSON only:
{
  "verdict_summary": "1-line take",
  "session_score": 1-10,
  "findings": [
    {
      "severity": "critical" | "high" | "normal" | "low",
      "title": "Short title",
      "description": "What happened, why it matters as this persona",
      "location": "URL or step where it occurred",
      "suggested_fix": "Concrete fix",
      "screenshot_index": 0
    }
  ]
}

Rules:
- ALWAYS stay in character as ${config.persona_prompt}
- Max 5 findings
- ONLY actionable findings, not vague feels
- A friction that almost made you leave = critical`

  const userContent: Anthropic.MessageCreateParams['messages'][0]['content'] = [
    {
      type: 'text',
      text: `Interaction trace (${trace.length} steps):\n${trace.map((t, i) => `Step ${i}: ${t.action} on ${t.url}`).join('\n')}`,
    },
    ...trace.map((t, i) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/png' as const,
        data: t.screenshot.toString('base64'),
      },
    })),
  ]

  const startMs = Date.now()
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  })
  const latencyMs = Date.now() - startMs

  logAiCall({
    model: 'claude-sonnet-4-6',
    feature: 'audit_agent',
    tokensInput: response.usage?.input_tokens,
    tokensOutput: response.usage?.output_tokens,
    latencyMs,
    success: true,
    metadata: { agent_name: `persona_${config.persona_key}` },
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{"findings":[]}')

  // Determine agent_type based on persona
  const agentType = config.persona_key === 'sceptical' ? 'acquisition' : 'activation'

  for (const finding of json.findings ?? []) {
    const screenshot_url = typeof finding.screenshot_index === 'number'
      ? screenshotUrls[finding.screenshot_index]
      : undefined
    await insertFinding({
      agent_type: agentType,
      persona: config.persona_key,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      location: finding.location,
      suggested_fix: finding.suggested_fix,
      screenshot_url,
    })
  }

  console.log(`[${config.persona_key}] Done — ${json.findings?.length ?? 0} findings, score: ${json.session_score}/10`)
  console.log(`Verdict: ${json.verdict_summary}`)

  return json
}
