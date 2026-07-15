# Weekly Improvement Batch — Conversion & Copy Fixes (viralanimal.com)

## Context

You are working on **viralanimal.com**, a video editing SaaS that helps streamers turn Twitch/Kick clips into TikTok-ready vertical videos. The stack is a Next.js app (App Router). Key pages and components involved in this batch:

- `app/page.tsx` — Marketing homepage (hero section, pricing section)
- `app/upload/page.tsx` — Upload page where blocked free users land
- `components/dashboard/Sidebar.tsx` — Left sidebar shown across the dashboard, contains the clips counter widget
- `components/dashboard/ClipsCounter.tsx` — The bottom-left widget showing `Clips this month: X/Y` with a progress bar
- `components/layout/Navbar.tsx` — Top nav (contains the `STUDIO` plan badge)

If any of these paths don't exist exactly, locate the closest matching file by inspecting the directory tree before editing. Do not guess — run `find . -type f -name "*.tsx" | head -60` first to confirm paths.

User plan data is available via a `useUser()` hook (or equivalent context) that exposes at minimum:
- `user.plan` — `"free"` | `"pro"` | `"studio"`
- `user.clipsUsed` — number
- `user.clipsLimit` — number

If the hook is named differently, grep for its usage: `grep -r "clipsUsed\|clipsLimit\|plan" --include="*.tsx" -l`.

---

## Changes Required

### 1. Homepage hero — fix subheadline copy + add CTA qualifier
**File:** `app/page.tsx`

**A — Subheadline rewrite (Improvement #4)**

Find the hero subheadline. It currently reads something like:
> "Browse Twitch & Kick clips, add karaoke captions + split-screen gameplay, and post straight to TikTok"

Replace it with:
> "Turn your best stream moments into TikTok-ready vertical clips in under 2 minutes — captions, split-screen, and posting included."

**B — CTA qualifier (Improvement #3)**

Find the primary hero CTA button (`Start Free` or `Start Free — No Card Required`). Directly below it, add a small qualifier line:

```tsx
<p className="mt-2 text-sm text-muted-foreground">
  3 clips/month free · No credit card needed
</p>
```

This must sit immediately under the button, not below any other element. If the button is inside a flex column, add it as the next sibling.

**C — Clip-length limit disclosure (Improvement #2)**

Locate the pricing section on the same page. Find the Pro plan card (`$19/mo`). In its feature list, ensure there is a line that explicitly states the clip-length cap. If it already lists clip length, verify it says **"Up to 2-min clips"** (not hidden or ambiguous). If it doesn't exist, add it as the **first** list item in the Pro plan feature list:

```tsx
<li className="flex items-center gap-2 text-sm">
  <CheckIcon className="h-4 w-4 text-primary" />
  Up to 2-min clips
</li>
```

Also add for the Free plan (if a free plan card exists in pricing):
```tsx
<li className="flex items-center gap-2 text-sm">
  <CheckIcon className="h-4 w-4 text-primary" />
  Up to 60-sec clips
</li>
```

Additionally, find the hero section's badge or secondary descriptor (the `clip-to-TikTok engine` jargon badge if present) and remove or replace it with a plain-text descriptor like `"No editing skills needed"` — do not let jargon dominate the above-the-fold area.

---

### 2. Clips counter widget — warning state + inline upgrade link
**File:** `components/dashboard/ClipsCounter.tsx`

This component renders the `Clips this month: X/Y` progress bar. Apply all of the following:

**A — Compute usage percentage:**
```tsx
const pct = Math.round((user.clipsUsed / user.clipsLimit) * 100);
const isAtLimit = user.clipsUsed >= user.clipsLimit;
const isNearLimit = pct >= 80 && !isAtLimit;
```

**B — Progress bar color:**
- Below 80%: keep existing color (e.g. `bg-primary`)
- 80–99%: `bg-amber-500`
- 100% (at limit): `bg-red-500`

Apply via a computed className string on the progress bar fill element.

**C — Label change at limit:**

Replace the static label with:
```tsx
<span className="text-sm font-medium">
  {isAtLimit ? "Limit reached" : `Clips this month: ${user.clipsUsed}/${user.clipsLimit}`}
</span>
```

**D — Inline upgrade link:**

When `isAtLimit` OR `isNearLimit` is true, render immediately after the label:
```tsx
{(isAtLimit || isNearLimit) && (
  <a
    href="/pricing"
    className="ml-2 text-xs font-semibold text-primary underline underline-offset-2 hover:opacity-80"
  >
    Upgrade ↗
  </a>
)}
```

Place the label and link in the same `<div className="flex items-center justify-between">` row as the counter text.

---

### 3. Sidebar — persistent upgrade CTA at limit
**File:** `components/dashboard/Sidebar.tsx`

**Improvement #1**

After the clips counter widget (wherever `<ClipsCounter />` is rendered in the sidebar), add a conditional upgrade banner that shows only when `isAtLimit` is true:

```tsx
{user.clipsUsed >= user.clipsLimit && (
  <div className="mx-3 mb-4 rounded-lg border border-primary/30 bg-primary/10 p-3">
    <p className="text-xs font-semibold text-primary">You've used all your clips</p>
    <p className="mt-0.5 text-xs text-muted-foreground">
      Upgrade to Pro for more clips and longer recordings.
    </p>
    <a
      href="/pricing"
      className="mt-2 inline-block w-full rounded-md bg-primary px-3 py-1.5 text-center text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
    >
      Upgrade to Pro →
    </a>
  </div>
)}
```

Import `useUser` (or whatever the user hook is) at the top of this file if not already imported. Do not duplicate — check existing imports first.

---

### 4. Upload page — upgrade banner for blocked users
**File:** `app/upload/page.tsx`

**Improvement #1 (continued)**

At the very top of the page's rendered output (above the upload form/dropzone, below the page `<header>` if one exists), add a conditional banner:

```tsx
{user.clipsUsed >= user.clipsLimit && (
  <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
    <div>
      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
        You've reached your {user.plan === "free" ? "free plan" : "plan"} clip limit
      </p>
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Upgrade to keep creating clips this month.
      </p>
    </div>
    <a
      href="/pricing"
      className="ml-4 shrink-0 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 transition-colors"
    >
      Upgrade to Pro
    </a>
  </div>
)}
```

If the upload action (button/dropzone) is conditionally disabled when the user is at their limit, ensure it remains disabled — don't change that logic. Only add the banner.

---

## Implementation Notes

- **Do not** install new dependencies. Use only what is already in `package.json`.
- **Do not** modify any API routes, database schema, or auth logic.
- All new UI text must respect existing dark mode support — use Tailwind semantic color classes (`text-muted-foreground`, `bg-primary`, etc.) wherever possible rather than hardcoded hex values.
- If `useUser()` is a server component pattern (no hook, data passed as props), adapt accordingly — pass `clipsUsed`, `clipsLimit`, and `plan` as props to the relevant components.
- After all edits, run `grep -n "TODO\|FIXME\|clipsLimit\|clipsUsed" --include="*.tsx" -r` to confirm no stray placeholders remain.

---

## Definition of Done

- [ ] **Improvement #1 (Upgrade CTA):** A persistent "Upgrade to Pro →" button appears in the sidebar below the clips counter when `clipsUsed >= clipsLimit`; an amber upgrade banner with "Upgrade to Pro" button appears at the top of `/upload` for users at their limit.
- [ ] **Improvement #2 (Clip-length disclosure):** The Pro plan card in the pricing section explicitly lists "Up to 2-min clips" as its first feature item; the Free plan card lists "Up to 60-sec clips"; no jargon badge dominates the hero area.
- [ ] **Improvement #3 (CTA qualifier):** The text "3 clips/month free · No credit card needed" appears directly beneath the hero CTA button on the homepage, visible without scrolling on a 1280px viewport.
- [ ] **Improvement #4 (Hero subheadline):** The hero subheadline reads "Turn your best stream moments into TikTok-ready vertical clips in under 2 minutes — captions, split-screen, and posting included." (or is functionally equivalent and outcome-led).
- [ ] **Improvement #5 (Counter warning state):** The clips counter progress bar turns amber at ≥80% usage and red at 100%; the label reads "Limit reached" at 100%; an "Upgrade ↗" hyperlink to `/pricing` appears inline at ≥80% usage.

---

## Commit message

```
improve: weekly batch — upgrade CTAs at limit, hero copy rewrite, free-tier transparency, clip-length disclosure, counter warning states
```