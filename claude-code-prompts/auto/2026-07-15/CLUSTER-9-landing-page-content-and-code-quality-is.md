# Fix: Landing Page Content Quality, OAuth Signup, and Navigation Consistency

## Context
This cluster covers several distinct but individually moderate issues on the landing page and signup flow: (1) YouTube/Instagram shown as available when they're 'soon', (2) FAQ text has raw `&apos;` HTML entities rendering as literal text, (3) signup has no Google/Discord OAuth causing mobile conversion loss, (4) the /upload page drops sidebar navigation, and (5) render job metrics may be broken. Each is a paper cut; together they compound into a perception of an unfinished product.

## Requirements

### 1. 'Soon' Platform Logos (findings 88, 99)
- In the 'Post To' section, either:
  - **Option A (preferred):** Remove YouTube and Instagram logos entirely until those integrations ship.
  - **Option B:** Move them to a clearly separated 'Coming Soon' subsection below the active platforms, with prominent 'Coming Soon' badges (larger font, different color).
- Do not mix shipped and unshipped features in the same visual row.

### 2. FAQ HTML Entities (finding 96)
- In `components/landing/faq-section.tsx`, find and replace all `&apos;` literal strings with proper apostrophe characters (`'` or `{"'"}` in JSX).
- Run a project-wide search for `&apos;`, `&amp;`, `&quot;`, `&lt;`, `&gt;` in `.tsx` files to catch any other instances.
- These are JSX string literals, not HTML — HTML entities don't auto-decode in JSX.

### 3. OAuth Signup (finding 65)
- Add Supabase OAuth providers for Google and Discord.
- On the signup page, add two buttons above the email form:
  - `Continue with Google` (Google icon)
  - `Continue with Discord` (Discord icon)
  - Horizontal divider with 'or' text
  - Existing email/password form below
- Discord is especially important for the gaming/streamer ICP.
- Twitch OAuth is a nice-to-have for later.

### 4. /upload Page Navigation (findings 86, 95)
- Keep the sidebar navigation (or at minimum a slim top bar with plan status and upgrade CTA) on the `/upload` page.
- Users should never lose their account context (plan, clip count, navigation) when moving between dashboard pages.
- If the upload page uses a different layout, extend it to include the shared sidebar component.

### 5. Render Job Metrics (finding 90)
- Verify the query behind `total_render_jobs_7d`. Run a direct database query: `SELECT COUNT(*) FROM render_jobs WHERE created_at > NOW() - INTERVAL '7 days'`.
- If the count is genuinely 0, that's a product problem (no users rendering). If the metric is broken, fix the aggregation.
- Add an alert: if 24h render job count drops to 0, send a Slack/email notification.

### 6. eslint-config-next Vulnerability (finding 91)
- Run `npm install eslint-config-next@latest` (or `@16.2.10`).
- Verify lint rules still pass in CI after the upgrade.
- Run `npm audit` and resolve any remaining high-severity vulnerabilities.

## Files to Investigate
- `components/landing/faq-section.tsx`
- `components/landing/features-section.tsx` (Post To section)
- Signup page component (likely `app/(auth)/signup/page.tsx`)
- Supabase auth configuration
- `/upload` page layout
- `app/dashboard/layout.tsx` (shared sidebar)
- `package.json` and `package-lock.json`
- Render job metrics query/dashboard