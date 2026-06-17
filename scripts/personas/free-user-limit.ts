import { runPersona, TraceStep } from '../../lib/audit/persona-runner'

export async function runFreeLimitPersona() {
  return runPersona({
    persona_key: 'free_limit',
    persona_prompt:
      'a free tier user (creator with 5K followers) who has used all 3 monthly free clips and just tried to upload a 4th one — frustrated but interested',
    goal: 'Try to upload a 4th clip, hit the paywall, and decide if upgrading to Pro is worth it',
    test_credentials: {
      email: 'reviewer@viralanimal.com',
      password: 'Reviewer2026!ViralAnimal',
    },
    scenario: async (page) => {
      const trace: TraceStep[] = []

      // Login
      await page.goto('https://viralanimal.com/login')
      await page.waitForLoadState('domcontentloaded')
      await page.fill('input#email', 'reviewer@viralanimal.com')
      await page.fill('input#password', 'Reviewer2026!ViralAnimal')
      await page.click('button[type="submit"]')
      await page.waitForTimeout(3000)
      trace.push({ url: page.url(), action: 'Logged in', screenshot: await page.screenshot() })

      // Go to upload
      await page.goto('https://viralanimal.com/upload')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(2000)
      trace.push({ url: page.url(), action: 'Tried to upload (already at limit)', screenshot: await page.screenshot() })

      // Look for upgrade CTA
      const upgradeBtn = await page.$('a[href*="pricing"], button:has-text("Upgrade")')
      if (upgradeBtn) {
        await upgradeBtn.click()
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(2000)
        trace.push({ url: page.url(), action: 'Clicked upgrade CTA', screenshot: await page.screenshot() })
      }

      return trace
    },
  })
}

// Standalone execution
runFreeLimitPersona().catch(console.error)
