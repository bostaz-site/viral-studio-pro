# Discord Hub — Channel Setup Guide

All business notifications centralized in Discord for mobile management.

## Server Structure

Create these channels in your "Viral Animal Audits" Discord server:

```
BUSINESS
  #new-signups          ← new user registrations
  #new-paid             ← checkout completed (pro/studio)
  #churn-alerts         ← subscription cancelled
  #stripe-events        ← payment failures, refunds
  #weekly-stats         ← Monday digest (signups, renders, audit)

ACQUISITION
  #cold-email-replies   ← all Instantly replies
  #positive-replies     ← positive/interested replies (with action buttons)
  #promo-codes-sent     ← generated promo codes
  #conversions          ← affiliate conversions
  #influencer-status    ← outreach pipeline updates

PRODUIT (existing)
  #critical-alerts      ← audit findings + root cause clusters
  #morning-brief        ← daily audit summary
  #production-errors    ← Sentry/Railway errors
```

## Setup Steps

1. **Create channels** in Discord (manually)

2. **Enable Developer Mode** in Discord:
   Settings > App Settings > Advanced > Developer Mode = ON

3. **Copy Channel IDs**: Right-click each channel > "Copy Channel ID"

4. **Set env vars** in Netlify + Railway:
   ```
   DISCORD_NEW_SIGNUPS_CHANNEL_ID=123456789
   DISCORD_NEW_PAID_CHANNEL_ID=123456789
   DISCORD_CHURN_ALERTS_CHANNEL_ID=123456789
   DISCORD_STRIPE_EVENTS_CHANNEL_ID=123456789
   DISCORD_WEEKLY_STATS_CHANNEL_ID=123456789
   DISCORD_COLD_EMAIL_REPLIES_CHANNEL_ID=123456789
   DISCORD_POSITIVE_REPLIES_CHANNEL_ID=123456789
   DISCORD_PROMO_CODES_CHANNEL_ID=123456789
   DISCORD_CONVERSIONS_CHANNEL_ID=123456789
   DISCORD_INFLUENCER_STATUS_CHANNEL_ID=123456789
   ```

5. **Bot permissions**: Ensure the bot has "Send Messages" + "Embed Links" in each channel

6. **Instantly webhook**: In Instantly, set webhook URL to:
   ```
   https://viralanimal.com/api/webhooks/instantly
   ```
   Set the webhook secret in `INSTANTLY_WEBHOOK_SECRET` env var.

## What Posts Where

| Event | Channel | Source |
|-------|---------|--------|
| Checkout completed | #new-paid | Stripe webhook |
| Subscription cancelled | #churn-alerts | Stripe webhook |
| Payment failed | #stripe-events | Stripe webhook |
| Affiliate conversion | #conversions | Stripe webhook |
| Cold email reply (all) | #cold-email-replies | Instantly webhook |
| Positive reply | #positive-replies | Instantly webhook (with buttons) |
| Weekly stats | #weekly-stats | Monday 10am EST cron |
| Critical finding | #critical-alerts | Audit system |
| Morning brief | #morning-brief | Daily 3am EST |

## Interactive Buttons

### Positive Reply Buttons (#positive-replies)
- **Auto-generate promo code** → generates `USERNAME20` code
- **Suggest reply** → shows a draft reply template
- **Mark spam** → excludes from future campaigns

### Root Cause Cluster Buttons (#critical-alerts)
- **Accept** → triggers GitHub Actions auto-fix
- **Later** → parks for later
- **Discard** → marks as discarded

## Testing

```bash
# Post weekly stats manually
npx tsx scripts/business/weekly-stats-digest.ts

# Test Instantly webhook
curl -X POST http://localhost:3000/api/webhooks/instantly \
  -H "Content-Type: application/json" \
  -d '{"reply":{"from_email":"test@example.com","body":"I love this! Can I try it?","campaign_name":"Test"}}'
```
