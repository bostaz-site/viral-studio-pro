# Fix: Activate Cold Email Infrastructure & Build Creator Outreach Workflow

## Context
13 mailboxes have been provisioned (likely on Instantly or similar) but are sitting completely idle. Mailbox reputation decays when idle — you're accumulating deliverability debt. Additionally, there is no influencer/creator outreach campaign defined: no promo codes, no tracking links, no email sequences, and no reply-handling workflow. For a SaaS targeting streamers, creator seeding is likely the highest-ROI acquisition channel.

## Requirements

### 1. Mailbox Warm-up (Immediate — do today)
- Enable warm-up on all 13 mailboxes in your email sending platform (Instantly, Smartlead, etc.).
- Set initial daily warm-up volume to 20-30 emails/mailbox.
- Ramp by 20% every 3 days.
- Target minimum 4 weeks of warm-up before any cold campaign volume.
- Monitor deliverability scores weekly — flag any mailbox with inbox placement < 80%.

### 2. Promo Code System
- Create a tiered promo code system in your billing tool (Stripe or equivalent):
  - `CREATOR20` — 20% off first 3 months
  - `CREATOR50` — 50% off first month (for higher-tier creators)
  - Unique per-creator codes for attribution tracking
- Build an internal admin page or spreadsheet to track: creator name, code issued, code redeemed, signups attributed.

### 3. Creator Outreach Campaign
- Build a shortlist of 50 mid-tier Twitch/YouTube creators (10K–500K followers) who actively clip their streams.
- Write a 3-step email sequence:
  - Email 1: Personalized intro + free Pro access offer
  - Email 2: Follow-up with a sample clip made from their content
  - Email 3: Social proof + last-chance offer
- Define SLA: any positive reply must receive a promo code within 4 hours.
- Have the campaign ready to launch the moment warm-up completes.

### 4. Tracking & Attribution
- Create UTM-tagged signup links per creator (e.g., `viralanimal.com/?ref=creatorname`).
- Ensure the `ref` param is captured at signup and stored on the user record for attribution.

## Files to Investigate
- Email platform dashboard (Instantly/Smartlead)
- Stripe/billing dashboard for coupon creation
- Signup flow code — add `ref` query param capture
- User database schema — add `referral_source` field if missing