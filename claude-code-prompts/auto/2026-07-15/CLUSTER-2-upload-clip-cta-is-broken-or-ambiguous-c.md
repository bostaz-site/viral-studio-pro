# Fix: Upload Clip CTA — Wire to Working Upload Flow

## Context
The `Upload clip` button in the top-right of the Browse/dashboard page is the primary CTA for the core user action. Clicking it produces no observable state change — no modal opens, no page navigation occurs, no loading state appears. In some cases it may be silently failing or depending on the clip grid being populated first. This blocks the entire activation funnel.

## Requirements
1. Find the `Upload clip` button component on the dashboard page and trace its `onClick` handler.
2. Ensure the button opens a self-contained upload modal (file picker dialog) OR navigates to `/upload` — regardless of the Browse grid state. The upload flow must be fully decoupled from whether clips have loaded.
3. Add an immediate visual response on click: the button should show a loading/spinner state within 100ms of click to confirm the action registered.
4. Add a tooltip on hover: `Upload your own video clip to enhance and publish`.
5. If the upload flow is on a separate page (`/upload`), ensure navigation occurs reliably. Check for any `e.preventDefault()` or conditional guards that might silently block navigation.
6. Instrument click-to-modal-open (or click-to-navigation) latency. Log an error if > 500ms.
7. Add an E2E test: click Upload clip → verify modal/page appears → verify file picker is accessible.

## Files to Investigate
- Dashboard page component — find the `Upload clip` button
- Upload modal component (if it exists)
- `/upload` page component
- Any click handlers, state guards, or conditional rendering around the upload trigger