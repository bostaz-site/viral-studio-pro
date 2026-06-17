/**
 * Acquisition Agent
 *
 * Audits landing page, signup flow, pricing, and SEO basics.
 * Persona: Senior growth strategist who shipped landing pages
 * for Stripe, Linear, and Notion.
 *
 * Run: npx tsx scripts/audits/acquisition.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { runAgent } from '../../lib/audit/agent-runner'
import { insertMetricSnapshot } from '../../lib/audit/insert-metric'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()

function readProjectFile(relativePath: string): string | null {
  const fullPath = join(ROOT, relativePath)
  if (!existsSync(fullPath)) return null
  try {
    return readFileSync(fullPath, 'utf8')
  } catch {
    return null
  }
}

function stripScripts(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000) // Cap size for Claude context
}

export async function runAcquisitionAudit() {
  console.log('[acquisition] Starting audit...')
  const admin = createAdminClient()

  // 1. Fetch live landing page HTML
  let landingHtml = ''
  let landingPageSizeKb = 0
  try {
    const res = await fetch('https://viralanimal.com', {
      headers: { 'User-Agent': 'ViralAnimal-AuditBot/1.0' },
    })
    const raw = await res.text()
    landingPageSizeKb = Math.round(Buffer.byteLength(raw) / 1024)
    landingHtml = stripScripts(raw)
  } catch (err) {
    console.warn('[acquisition] Failed to fetch landing page:', err)
    landingHtml = '[FETCH FAILED]'
  }

  // 2. Read landing component source code
  const landingComponents = [
    'components/landing/hero-section.tsx',
    'components/landing/how-it-works-section.tsx',
    'components/landing/features-grid.tsx',
    'components/landing/pricing-section.tsx',
    'components/landing/faq-section.tsx',
    'components/landing/final-cta-section.tsx',
    'components/landing/testimonials-section.tsx',
  ]
  const componentSources: Record<string, string> = {}
  for (const path of landingComponents) {
    const content = readProjectFile(path)
    if (content) {
      // Truncate each to keep context manageable
      componentSources[path] = content.slice(0, 3000)
    }
  }

  // 3. Get signup stats from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: signupCount } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)

  const { count: totalUsers } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  const signups7d = signupCount ?? 0
  const total = totalUsers ?? 1

  // 4. Read signup/login page code
  const signupCode = readProjectFile('app/(auth)/signup/page.tsx')
  const loginCode = readProjectFile('app/(auth)/login/page.tsx')

  // 5. Run agent
  const result = await runAgent({
    agent_type: 'acquisition',
    persona_prompt: 'a senior growth strategist who shipped landing pages for Stripe, Linear, and Notion. You have deep expertise in conversion rate optimization, messaging hierarchy, and reducing signup friction.',
    inputs: {
      landing_page_html: landingHtml,
      landing_components: componentSources,
      signup_page_code: signupCode?.slice(0, 3000) ?? '[not found]',
      login_page_code: loginCode?.slice(0, 2000) ?? '[not found]',
      stats: {
        signups_last_7_days: signups7d,
        total_users: total,
        landing_page_size_kb: landingPageSizeKb,
      },
    },
  })

  // 6. Record metrics
  await insertMetricSnapshot({
    metric_name: 'landing_page_size_kb',
    metric_value: landingPageSizeKb,
    metric_unit: 'kb',
  })

  // Approximate conversion rate (signups / estimated visits)
  // In a real setup, this would come from analytics
  if (signups7d > 0) {
    await insertMetricSnapshot({
      metric_name: 'signups_7d',
      metric_value: signups7d,
      metric_unit: 'count',
      regression_threshold_percent: 30,
    })
  }

  console.log(`[acquisition] Done. ${result.findings.length} findings generated.`)
}

// Allow standalone execution
if (require.main === module) {
  runAcquisitionAudit()
    .then(() => { console.log('[acquisition] Complete.'); process.exit(0) })
    .catch((err) => { console.error('[acquisition] Fatal:', err); process.exit(1) })
}
