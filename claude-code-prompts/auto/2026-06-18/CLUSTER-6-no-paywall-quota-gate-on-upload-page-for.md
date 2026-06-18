# Fix: Add paywall gate and quota indicator on /upload for free-tier users

## Context
Free-tier users who have used all 3 monthly clips land on /upload and see a fully functional upload UI. There is no quota indicator, no paywall modal, no disabled state, and no upgrade CTA. They can click 'Select file', choose a video, and then hit a silent failure. This wastes the single highest purchase-intent moment in the funnel.

## Files to modify
- `src/pages/upload.tsx` (or `app/upload/page.tsx`) — the upload page component
- `src/components/UploadDropzone.tsx` — the drop zone component
- `src/components/PaywallModal.tsx` — create this component
- `src/components/QuotaBadge.tsx` — create this component
- `src/hooks/useUserQuota.ts` or `src/api/quota.ts` — quota check logic
- `src/app/api/quota/route.ts` (or equivalent server endpoint) — server-side quota check

## Steps
1. **Server-side quota check**: On /upload page load, fetch the user's current month clip count and plan limit. API: `GET /api/quota` → `{ used: 3, limit: 3, plan: 'free' }`.
2. **Quota badge**: Add a persistent `<QuotaBadge />` component near the upload dropzone showing `"3 / 3 free clips used this month"`. Style it green when under 50%, amber at 66%+, red at 100%. Include a small 'Upgrade' link.
3. **Paywall gate**: If `used >= limit`, render a `<PaywallModal />` that:
   - Overlays or replaces the dropzone
   - Shows: "You've used 3/3 free clips this month"
   - Lists Pro benefits: unlimited clips, priority rendering, no watermark, clips up to 5 min
   - Has a prominent 'Upgrade to Pro' CTA button linking to `/pricing` or triggering Stripe checkout
   - Disables the dropzone and 'Select file' button (greyed out, `pointer-events: none`)
4. **Nav upgrade CTA**: For free-tier users, add an 'Upgrade to Pro' button in the top-right nav bar (accent color, e.g., orange). Always visible, not just at quota.
5. **Test**: Mock a user with `{ used: 3, limit: 3, plan: 'free' }` and assert: dropzone is disabled, PaywallModal is visible, QuotaBadge shows red '3/3'. Mock a user with `{ used: 1, limit: 3 }` and assert: dropzone is enabled, no paywall, QuotaBadge shows green '1/3'.

## Definition of Done
- Free users at limit see a blocking paywall modal with upgrade CTA on /upload
- Dropzone and file picker are disabled for over-quota users
- Quota badge visible on /upload for all free users at all times
- 'Upgrade to Pro' button in nav for all free-tier users
- Server-side quota check prevents upload initiation (defense in depth)
- Component tests for PaywallModal and QuotaBadge

## Commit message
```
feat(upload): add paywall gate, quota badge, and upgrade CTA for free-tier users at limit
```