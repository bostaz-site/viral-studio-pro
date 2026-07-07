# Fix: Enhance Clip Quota Widget with Warnings and Context

## Context
The dashboard sidebar shows a clip usage counter (e.g., '16/120 clips this month') but it's missing critical UX layers (findings 101, 104, 112): no definition of what counts as a clip, no color-coded warning thresholds, no projected usage alerts, and no upgrade path. This single widget needs enrichment.

## Task
1. Find the clip quota/usage widget component in the dashboard sidebar (likely in `components/dashboard/` — search for '120', 'clips this month', or usage-related state).
2. Add a **tooltip on hover** (or info icon with popover) explaining: 'A clip credit is used each time you render a final clip. Browsing and previewing don't count.'
3. Add **color-coded progress bar states**:
   - 0-69%: default/green
   - 70-89%: yellow/warning
   - 90-100%: red/critical
4. Add a **projected usage line**: calculate `(currentUsage / daysElapsedInMonth) * totalDaysInMonth` and display: 'At this pace, you'll use ~{projected} clips by month end'
5. When usage >= 70%, show an inline CTA: 'Upgrade for more clips →' linking to `/pricing`.
6. Add a **tooltip showing days remaining** in the billing cycle.
7. Ensure the progress bar color transitions are smooth (use CSS transitions or tailwind classes).

## Acceptance Criteria
- Tooltip explains what counts as a clip credit
- Progress bar changes color at 70% and 90% thresholds
- Projected usage is calculated and displayed
- Upgrade CTA appears at 70%+ usage
- Days remaining in billing cycle visible on hover