# Fix: Technical Debt — npm Vuln, Missing Analytics, Hook Timing

## Context
3 findings cover distinct technical issues: a high-severity npm vulnerability, missing platform intent analytics, and a clip generation quality issue with hook timing. These are lower-impact individually but compound as technical debt.

## Requirements

### 1. Fix npm audit vulnerability (Finding 133)
- Run `npm install eslint-config-next@latest` (or `@16.2.10+`) to fix the glob ReDoS vulnerability.
- Run `npm audit` to verify no remaining high-severity issues.
- Pin the version in `package.json` to prevent regression.
- If other high/critical vulns surface, fix those too.

### 2. Add platform intent tracking (Finding 142)
- Find the project/clip creation flow (likely in the upload or clip editing component).
- Add a platform-intent selector: `TikTok | YouTube Shorts | Instagram Reels`
- Default to TikTok.
- Store the selection in the clip/project metadata and aggregate it in analytics/stats.
- Use the selection to auto-set export defaults (aspect ratio, duration limits, caption character limits) in the future.
- Update `stats.platform_breakdown` to populate from this data.

### 3. Improve hook timing in clip generation (Finding 126)
- This is an algorithmic/product improvement for the clip trimming logic.
- Find the clip trim/in-out point selection logic (likely in the AI clip detection or editing pipeline).
- Add a TODO or implement: when the detected 'peak reaction' moment is >2 seconds into the clip, consider:
  a. Trimming the start to begin at the peak moment, OR
  b. Adding a 0.5s flash-forward cold open showing the peak, then cutting back to build context.
- At minimum, log a warning when the emotional peak is detected beyond the 2-second mark so it can be reviewed.

## Files likely involved
- `package.json` and `package-lock.json` (npm vuln)
- Upload/clip creation components (platform selector)
- Analytics/stats module (platform_breakdown)
- Clip trimming/AI pipeline (hook timing)

## Acceptance Criteria
- `npm audit` returns 0 high-severity vulnerabilities.
- Platform intent selector exists in clip creation flow and data flows to stats.
- Hook timing improvement is either implemented or documented as a TODO with clear spec.