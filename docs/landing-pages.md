# Landing Pages

## Description

Three public-facing landing pages: the main marketing page (`/`), the cold email invite page (`/invite`), and the affiliate redirect page (`/ref/[handle]`).

## Pages

### `/` -- Main Landing Page

**File**: `app/page.tsx` (renders `components/landing/landing-page.tsx`)

Full marketing page with:
- Hero section with CTA
- How it works section (3 steps)
- Pricing section (3 tiers)
- FAQ section
- Footer

Components used:
- `LandingPage` (`components/landing/landing-page.tsx`)
- `HowItWorksSection` (`components/landing/how-it-works-section.tsx`)
- `PricingSection` (`components/landing/pricing-section.tsx`)
- `FaqSection` (`components/landing/faq-section.tsx`)

### `/invite` -- Cold Email Landing Page

**File**: `app/invite/page.tsx` (renders `components/landing/invite-page.tsx`)

Simplified landing page designed for cold outreach. Features:
- "100% Free to Start" badge
- Hero: "Turn Your Streams Into Viral Clips"
- 3 feature cards: Auto Captions, Split-Screen, Multi-Platform
- Social proof line: "Join 500+ creators"
- CTA: "Start Free" -> `/signup`
- Secondary CTA: "Create Free Account" + "Learn more" link

**Metadata**: `title: "Start Free -- Viral Animal"`

### `/ref/[handle]` -- Affiliate Redirect Page

**File**: `app/ref/[handle]/page.tsx`

Client-side redirect page for affiliate referral links. On mount:
1. Sets `ref` cookie with the affiliate handle (30-day expiry)
2. Sets UTM cookies if present (`ref_utm_source`, `ref_utm_medium`, `ref_utm_campaign`)
3. POST `/api/referral/track` to record the click
4. Redirects to `/invite`

Shows a loading spinner during redirect.

**URL format**: `viralanimal.com/ref/samy?utm_source=twitter&utm_medium=social`

## Key Files

| File | Role |
|------|------|
| `app/page.tsx` | Main landing page |
| `app/invite/page.tsx` | Invite page wrapper |
| `app/ref/[handle]/page.tsx` | Affiliate redirect |
| `components/landing/landing-page.tsx` | Main landing layout |
| `components/landing/invite-page.tsx` | Invite page layout |
| `components/landing/how-it-works-section.tsx` | How it works section |
| `components/landing/pricing-section.tsx` | Pricing section |
| `components/landing/faq-section.tsx` | FAQ section |

## Technical Notes

- Main landing is a server component wrapping client sections
- Invite page is a minimal client component for cold email conversions
- Affiliate redirect is fully client-side (sets cookies, fires API call, redirects)
- Referral cookie `ref` is checked during signup to attribute the user to an affiliate
- All CTAs track analytics events (`cta_hero_click`, `cta_pricing_click`, `cta_signup_click`)
