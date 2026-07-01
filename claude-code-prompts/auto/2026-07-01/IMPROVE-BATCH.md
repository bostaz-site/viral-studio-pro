# Weekly Improvement Batch: Hero Broadening, Social Proof & Pricing Clarity

## Context

You are working on **viralanimal.com**, a video editing SaaS that helps gaming creators turn stream clips into viral short-form content. The stack is a standard Next.js project. The main marketing page is the homepage (`app/page.tsx` or `pages/index.tsx` — check which exists). There may be a dedicated pricing section component and a hero component. Locate the relevant files before making changes.

The site currently:
- Has a hero headline: `"Your Twitch Clip, Made Viral"`
- Has a sub-badge: `"Built by streamers, for streamers"`
- Shows no social proof above the fold
- Has a Free plan card listing `"Clips up to 60s"` and `"3 videos/month"` with no format output info
- Shows export formats (9:16 + 1:1 + 16:9) only in the Pro plan description

All 5 improvements below must be implemented in this single session. Group your edits file by file to keep the diff clean.

---

## Improvement 1 — Broaden the Hero Headline

**File(s):** Hero component or homepage hero section (likely `components/Hero.tsx`, `components/HeroSection.tsx`, or inline in `pages/index.tsx` / `app/page.tsx`)

**What to change:**

1. Find the `<h1>` containing `"Your Twitch Clip, Made Viral"` and replace it with:
   ```
   Your Gaming Clip, Made Viral
   ```
2. Find the sub-badge or subtitle containing `"Built by streamers, for streamers"` and replace it with:
   ```
   Built for Twitch, YouTube Gaming, TikTok & Instagram
   ```
   Keep the same styling/element type as the original badge — do not change layout or CSS classes, only the text content.

---

## Improvement 2 — Add Platform-Inclusive Sub-line Under Headline

**File(s):** Same hero component as Improvement 1

**What to change:**

Directly below the `<h1>` (after it, before the CTA button), ensure there is a short sub-line element. If one already exists, update its text. If none exists, insert a `<p>` with a muted/secondary text class consistent with the existing design system:

```
Works with Twitch, YouTube Gaming & more — one click to shareable.
```

This line should sit between the headline and the primary CTA button. Do not add new Tailwind classes that conflict with the existing palette — reuse whatever secondary text class is already used on the page (e.g., `text-muted-foreground`, `text-gray-400`, or equivalent).

---

## Improvement 3 — Add Social Proof Block Below CTA

**File(s):** Same hero component as Improvements 1 & 2

**What to change:**

Directly below the primary CTA button(s) in the hero, add a social proof block. Use this exact structure and content, styled to fit the existing design (dark background assumed — adjust text colors accordingly):

```tsx
{/* Social proof */}
<div className="mt-6 flex flex-col items-center gap-3">
  {/* Numerical trust stat */}
  <p className="text-sm font-medium text-muted-foreground">
    🎬 <span className="text-foreground font-semibold">47,000+</span> clips exported by creators worldwide
  </p>

  {/* Creator testimonial */}
  <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm max-w-sm w-full">
    <img
      src="/testimonials/avatar-xtreamerx.png"
      alt="@xStreamerX avatar"
      width={40}
      height={40}
      className="rounded-full object-cover shrink-0"
    />
    <div>
      <p className="text-sm text-foreground font-medium">
        "First clip I exported hit 2.1M views. Insane."
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        @xStreamerX · Twitch Partner
      </p>
    </div>
  </div>
</div>
```

**Also:**
- Create a placeholder image at `public/testimonials/avatar-xtreamerx.png`. If you cannot generate a binary image, add a code comment `// TODO: replace with real creator avatar` and use a fallback:
  ```tsx
  src="https://api.dicebear.com/7.x/avataaars/svg?seed=xStreamerX"
  ```
  so it renders visually without a missing image.
- If the project uses Next.js `<Image>` component, replace the `<img>` tag with `<Image>` and add the appropriate `width`/`height` props.

---

## Improvement 4 — Clarify the "60s" Clip Limit on Free Plan

**File(s):** Pricing component (likely `components/Pricing.tsx`, `components/PricingSection.tsx`, `components/PricingCard.tsx`, or inline in the homepage)

**What to change:**

1. Locate the Free plan feature list item that reads `"Clips up to 60s"` (or similar).
2. Replace it with the following, keeping the same list item element and icon/checkmark style:
   ```
   Clips up to 60s input length
   ```
   And add an inline helper text immediately after (inside the same `<li>` or as a sibling `<span>`/`<p>`):
   ```
   AI selects the best moment automatically
   ```
   Style the helper text smaller and muted, e.g., `text-xs text-muted-foreground` or equivalent. It should appear on a new line below the feature label, indented to align with the text (not the icon).

**Example output for that list item:**
```
✓ Clips up to 60s input length
  AI selects the best moment automatically
```

Do not change the Pro plan's `"Clips up to 2 min"` line — leave it as-is.

---

## Improvement 5 — Show Export Format in Free Plan Feature List

**File(s):** Same pricing component as Improvement 4

**What to change:**

1. Locate the Free plan feature checklist.
2. Add a new feature line item (with the same checkmark/icon style as other items) at a logical position in the list (after the clip limit line is a good place):
   ```
   9:16 vertical export included
   ```
3. If the Pro plan already lists all three formats (`9:16 + 1:1 + 16:9`), update the Pro plan's corresponding item to read:
   ```
   9:16, 1:1 & 16:9 exports included
   ```
   so the distinction between tiers is clear at a glance.

Do not remove any existing items from either plan. Only add/update as described.

---

## Notes for Implementation

- **Do not change any routing, API logic, authentication, or backend code.**
- **Do not introduce new dependencies** — use only what is already in `package.json`.
- **Preserve all existing Tailwind classes** on elements you modify; only change text content and add the new social proof block.
- If you are uncertain which file contains a component, use `grep -r "Your Twitch Clip" .` or `grep -r "Clips up to" .` to locate the exact file before editing.
- After all edits, do a final check: `grep -r "Twitch Clip" .` should return zero results (the old headline must be fully replaced).

---

## Definition of Done

- [ ] **Improvement 1:** `<h1>` reads `"Your Gaming Clip, Made Viral"` and sub-badge reads `"Built for Twitch, YouTube Gaming, TikTok & Instagram"` — old Twitch-only copy is gone
- [ ] **Improvement 2:** A sub-line `"Works with Twitch, YouTube Gaming & more — one click to shareable."` appears between the `<h1>` and the primary CTA button in the hero section
- [ ] **Improvement 3:** A social proof block containing the `"47,000+ clips exported"` stat and the `@xStreamerX` testimonial card renders directly below the hero CTA button(s), with a working avatar image or dicebear fallback
- [ ] **Improvement 4:** The Free plan's `"Clips up to 60s"` item now reads `"Clips up to 60s input length"` with an indented muted sub-line `"AI selects the best moment automatically"` below it
- [ ] **Improvement 5:** The Free plan checklist explicitly includes a `"9:16 vertical export included"` line item, and the Pro plan's export line reads `"9:16, 1:1 & 16:9 exports included"`

---

## Commit message

```
improve: weekly batch — broaden hero to all gaming platforms, add social proof above fold, clarify free plan clip limit and export format
```