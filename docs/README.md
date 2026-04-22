# Viral Animal -- Module Documentation

Technical documentation for each major feature module.

## Modules

| Module | Description |
|--------|-------------|
| [auth-oauth.md](auth-oauth.md) | Supabase Auth + OAuth social (TikTok, YouTube, Instagram) |
| [enhance-render.md](enhance-render.md) | Enhance page + FFmpeg rendering + AI mood detection + 6 mood presets |
| [distribution-hub.md](distribution-hub.md) | Distribution Hub: scheduling, queue, calendar, anti-shadowban |
| [analytics.md](analytics.md) | Analytics dashboard + Viral Score |
| [browse-clips.md](browse-clips.md) | Browse Clips V2: Kick, 5-factor scoring, smart feeds, favorites, admin streamers |
| [upload.md](upload.md) | Upload clips |
| [billing-stripe.md](billing-stripe.md) | Plans + Stripe checkout + webhooks |
| [affiliate-system.md](affiliate-system.md) | Full affiliate/referral system |
| [admin-dashboard.md](admin-dashboard.md) | Admin pages: growth, analytics, affiliates |
| [landing-pages.md](landing-pages.md) | Landing pages: main, invite, affiliate redirect |
| [onboarding.md](onboarding.md) | Onboarding: welcome modal + setup progress |
| [smart-publishing.md](smart-publishing.md) | Smart Publishing: adaptive posting, performance tracking, account intelligence |

## Architecture Overview

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Zustand
- **Backend**: Supabase (PostgreSQL + Storage + Auth), FFmpeg on Railway VPS
- **Deployment**: Frontend on Netlify, VPS on Railway
- **Payments**: Stripe (subscriptions + webhooks)
- **OAuth**: TikTok, YouTube (Google), Instagram (Meta/Facebook)
