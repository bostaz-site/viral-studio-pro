# Fix: Clip Quota Widget Lacks Urgency Thresholds

## Context
Findings 113 and 136 describe the same sidebar widget ('Clips this month: 16/120') that shows flat progress with no color change, warning threshold, projected usage, or contextual action. Power users get surprised by hard stops.

## Requirements
1. Find the clips quota widget in the sidebar (search for 'clips this month', 'usage', '120' in `components/dashboard/` or `components/sidebar/`).
2. Add color-coded states to the progress bar:
   - 0–79%: default/green
   - 80–94%: yellow/amber (`bg-yellow-500`)
   - 95–100%: red (`bg-red-500`)
3. Add a tooltip or subtitle text that shows:
   - Days remaining in the billing cycle (calculate from subscription start date or first of month)
   - Projected end-of-month usage: `(current_usage / days_elapsed) * total_days_in_month`
   - E.g., 'At this pace, you'll use ~95 of 120 clips by month-end'
4. When usage ≥ 80%, show an inline 'Upgrade or add clips' link below the progress bar.
5. When usage = 100%, replace the progress bar label with 'Limit reached — Upgrade to continue' in red.

## Files to Modify
- Sidebar quota widget component (search for clip count display)
- May need to add billing cycle date to the user/subscription data model if not present (add TODO if not available)

## Acceptance Criteria
- Progress bar color changes at 80% and 95% thresholds.
- A projected usage tooltip or subtitle is visible.
- An upgrade link appears at ≥80% usage.
- At 100%, the widget clearly communicates the block state.