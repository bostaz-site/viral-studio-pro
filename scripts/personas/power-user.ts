import { runPersona, TraceStep } from '../../lib/audit/persona-runner'

export async function runPowerUserPersona() {
  return runPersona({
    persona_key: 'power',
    persona_prompt:
      'a paying power user (Studio plan, $79/mo) who publishes 50+ clips per month — values efficiency, hates friction, will churn at first sign of degradation',
    goal: 'Upload, render, and publish a clip in under 5 minutes, then check analytics',
    test_credentials: {
      email: 'reviewer@viralanimal.com',
      password: 'Reviewer2026!ViralAnimal',
    },
    scenario: async (page) => {
      const trace: TraceStep[] = []

      // Login
      await page.goto('https://viralanimal.com/login')
      await page.waitForLoadState('domcontentloaded')
      await page.fill('input[name="email"]', 'reviewer@viralanimal.com')
      await page.fill('input[name="password"]', 'Reviewer2026!ViralAnimal')
      await page.click('button[type="submit"]')
      await page.waitForTimeout(3000)
      trace.push({ url: page.url(), action: 'Logged in', screenshot: await page.screenshot() })

      // Navigate to dashboard
      const myClipsLink = await page.$('a[href*="dashboard"]')
      if (myClipsLink) {
        await myClipsLink.click()
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(2000)
        trace.push({ url: page.url(), action: 'Opened dashboard', screenshot: await page.screenshot() })
      }

      // Check if there's a quick "new clip" CTA
      const newClipBtn = await page.$('button:has-text("Upload"), a[href*="upload"]')
      if (newClipBtn) {
        await newClipBtn.click()
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(2000)
        trace.push({ url: page.url(), action: 'Clicked upload CTA', screenshot: await page.screenshot() })
      }

      // Check settings/analytics area
      const settingsLink = await page.$('a[href*="settings"]')
      if (settingsLink) {
        await settingsLink.click()
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(2000)
        trace.push({ url: page.url(), action: 'Checked settings/analytics', screenshot: await page.screenshot() })
      }

      return trace
    },
  })
}

// Standalone execution
runPowerUserPersona().catch(console.error)
