# Fix: Cold email workflow, hero copy broadening, and npm audit vuln

## Context
Three remaining findings that don't fit neatly into the product UI clusters: (1) no promo code or reply workflow is defined for the cold email outreach program, (2) the hero subheading excludes non-Twitch creators, and (3) an npm audit vulnerability in eslint-config-next. Grouped as operational/copy/tooling cleanup.

## Requirements

### 1. Hero copy broadening
Find the hero subtitle (likely in `components/landing/hero-section.tsx`):
- Change from 'Browse Twitch & Kick clips' to something like: 'Turn stream clips into viral TikToks — works with Twitch & Kick'.
- Lead with the creator benefit (viral TikToks), not the input source.

### 2. Cold email reply workflow (non-code, but document it)
- Create a `docs/cold-email-workflow.md` file with:
  - Promo code naming convention: `CREATOR_[NAME]_[DISCOUNT]` (e.g., `CREATOR_NINJA_20`)
  - Reply SLA: <4 hours for positive replies
  - Positive reply routing: Slack webhook or email alert from Instantly
  - Tracking: Airtable/Notion template columns: Creator Handle | Reply Date | Promo Code Sent | Trial Started | Converted
  - Assign a single owner to monitor replies daily

### 3. npm audit fix
- Run `npm install eslint-config-next@latest` (or `@16.2.10+`).
- Verify `npm audit` shows no high-severity vulnerabilities.
- Pin the version in `package.json`.

## Files likely involved
- `components/landing/hero-section.tsx`
- `docs/cold-email-workflow.md` (new file)
- `package.json` / `package-lock.json`

## Acceptance criteria
- Hero subtitle leads with the output benefit, not just 'Twitch & Kick'.
- `docs/cold-email-workflow.md` exists with all four sections above.
- `npm audit` returns 0 high-severity vulnerabilities.