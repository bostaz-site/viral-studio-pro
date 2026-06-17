import { runPersona, TraceStep } from '../../lib/audit/persona-runner'

export async function runScepticalPersona() {
  return runPersona({
    persona_key: 'sceptical',
    persona_prompt:
      "a sceptical first-time visitor (35 years old, time-poor, has been disappointed by AI tools before, gives products 10 seconds to prove they're useful)",
    goal: 'Understand what Viral Animal does and decide if it\'s worth trying within 10 seconds',
    scenario: async (page) => {
      const trace: TraceStep[] = []

      // Landing
      await page.goto('https://viralanimal.com')
      await page.waitForLoadState('domcontentloaded')
      trace.push({ url: page.url(), action: 'Landed on homepage', screenshot: await page.screenshot() })

      // Scroll halfway
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(2000)
      trace.push({ url: page.url(), action: 'Scrolled halfway', screenshot: await page.screenshot() })

      // Continue scrolling to features
      await page.mouse.wheel(0, 1000)
      await page.waitForTimeout(2000)
      trace.push({ url: page.url(), action: 'Scrolled to features', screenshot: await page.screenshot() })

      // Look for pricing
      const pricingLink = await page.$('a[href*="pricing"]')
      if (pricingLink) {
        await pricingLink.click()
        await page.waitForLoadState('domcontentloaded')
        trace.push({ url: page.url(), action: 'Clicked pricing', screenshot: await page.screenshot() })
      }

      return trace
    },
  })
}

// Standalone execution
runScepticalPersona().catch(console.error)
