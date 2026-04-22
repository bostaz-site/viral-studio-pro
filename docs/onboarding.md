# Onboarding

## Description

Two onboarding components guide new users through initial setup: a WelcomeModal (3-step carousel shown once) and a SetupProgress checklist (3 tasks shown until completed or dismissed).

## Components

### `WelcomeModal` (`components/onboarding/welcome-modal.tsx`)

Full-screen modal carousel shown on first dashboard visit.

**Behavior**:
- Checks `localStorage` key `vsp.onboarding.welcome.v1`
- If not set, shows the modal
- On close (skip, X, or "Get started"), sets the key to `'1'`
- Never shown again after dismissal

**Steps**:

| Step | Icon | Title | Description |
|------|------|-------|-------------|
| 1 | Wand2 (blue) | Pick a clip | Browse the trending Twitch clip library or upload your own. Filter by niche (IRL, FPS, MOBA, etc.) to find the right content. |
| 2 | Zap (orange) | Click "Make Viral" | One click applies the best settings: karaoke captions, AI hook, smart zoom, audio enhance, and streamer tag. Rendered in under 90 seconds. |
| 3 | Download (green) | Download and post | Your 9:16 video is ready to post on TikTok, Reels, or Shorts. No watermark on paid plans. |

**UI**:
- "Welcome to Viral Animal" badge on step 1
- Step icon with gradient background
- Step dots indicator
- Back/Next/Skip navigation
- "Get started" CTA on final step
- Backdrop blur overlay

**Props**: None

### `SetupProgress` (`components/onboarding/setup-progress.tsx`)

Checklist card shown on the dashboard until all steps are completed or the user dismisses it.

**Behavior**:
- Checks `localStorage` key `vsp.setup.dismissed`
- If not set, renders the checklist
- Queries Supabase to check completion of each step
- Auto-dismisses if all 3 steps are done
- User can manually dismiss

**Steps**:

| Step | Icon | Label | Check Logic | Link |
|------|------|-------|-------------|------|
| social | Link2 | Connect a social account | `social_accounts` has at least 1 row | `/dashboard/distribution` |
| enhance | Wand2 | Enhance your first clip | `render_jobs` has at least 1 row for user | `/dashboard` |
| publish | Share2 | Schedule or publish a clip | `scheduled_publications` has at least 1 row for user | `/dashboard/distribution` |

**UI**:
- Progress bar (0-100%)
- Completed count (X/3 steps done)
- Each step: checkbox icon (green when done, gray when pending), label, description, arrow link
- "Dismiss" text button

**Props**: None

### `ReferralBonusBanner` (`components/onboarding/referral-bonus-banner.tsx`)

Banner shown on dashboard for users who signed up via a referral link.

## Key Files

| File | Role |
|------|------|
| `components/onboarding/welcome-modal.tsx` | 3-step carousel modal |
| `components/onboarding/setup-progress.tsx` | 3-step checklist card |
| `components/onboarding/referral-bonus-banner.tsx` | Referral bonus banner |

## Integration

- `WelcomeModal` is rendered inside `app/(dashboard)/dashboard/page.tsx` (the Browse Clips page)
- `SetupProgress` can be rendered on any dashboard page
- Both use `localStorage` for dismissal state (no database writes)

## User Flow

1. New user logs in and lands on `/dashboard`
2. `WelcomeModal` appears (3-step carousel)
3. User reads through steps or skips
4. Modal closes, `localStorage` key set -- never shown again
5. `SetupProgress` card appears on dashboard
6. User completes steps: connect account, enhance clip, schedule/publish
7. Progress bar fills as steps complete
8. Once all 3 done (or manually dismissed), checklist disappears

## Technical Notes

- Both components rely on `localStorage` -- no server-side onboarding state
- `SetupProgress` makes 3 Supabase queries on mount (one per step check)
- Completed steps are shown with strikethrough text and green checkmark
- If `localStorage` is unavailable (e.g. incognito), modal is skipped silently
