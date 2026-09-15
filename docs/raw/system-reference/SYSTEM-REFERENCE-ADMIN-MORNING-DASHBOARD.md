# SYSTEM REFERENCE — Admin Morning Dashboard (v1)

> Source de verite pour la page principale admin — celle que Samy ouvre chaque matin.
> Derniere mise a jour : 2026-05-13.

---

## Architecture

| Fichier | Role |
|---|---|
| `app/(dashboard)/admin/page.tsx` | Page principale — greeting, 7 sections, Realtime subscriptions |
| `app/(dashboard)/admin/_components/while-you-slept.tsx` | 5 KPIs des 16 dernieres heures |
| `app/(dashboard)/admin/_components/hot-leads-section.tsx` | Top 10 leads par score + reply < 24h |
| `app/(dashboard)/admin/_components/stuck-followups.tsx` | Leads in onboarded/demo_sent/evaluating + inactive > 5j |
| `app/(dashboard)/admin/_components/payouts-due-card.tsx` | Total commissions dues + top 5 affilies |
| `app/(dashboard)/admin/_components/watchdog-alerts-card.tsx` | Active alerts (critical en rouge, important en amber) |
| `app/(dashboard)/admin/_components/ai-insights-card.tsx` | 2-3 insights Claude Haiku (cache 1h) |
| `app/(dashboard)/admin/_components/weekly-goal.tsx` | Progress bar signups semaine vs objectif |
| `app/api/admin/dashboard/overview/route.ts` | GET — 1 seul call agrege toutes les data |
| `app/api/admin/dashboard/insights/route.ts` | GET — Claude Haiku insights (cache 1h) |
| `lib/admin/dashboard/aggregator.ts` | 12 queries paralleles → DashboardOverview |

---

## Layout (top to bottom)

```
1. Header — "Bonjour Samy" + date FR-CA + MRR snapshot + Refresh button
2. While You Slept — 5 cards: emails sent, replies, signups, paying, alerts (16h window)
3. Hot Leads + Stuck (2 columns)
   ├── Hot Leads — top 10 by lead_score, replied < 24h, click → inbox
   └── Stuck Followups — onboarded/demo_sent/evaluating + no activity > 5d
4. Payouts + Watchdog (2 columns)
   ├── Payouts Due — total $, affiliate count, top 5 by amount
   └── Watchdog — active alerts, color by severity, link to /admin/watchdog
5. AI Insights — Claude Haiku, 2-3 phrases, cached 1h, purple gradient card
6. Weekly Goal — progress bar, signups this week vs target (50)
```

---

## API: GET /api/admin/dashboard/overview

Single aggregated call returning `DashboardOverview`:
- greeting (name, date fr-CA)
- whileYouSlept (6 counts from last 16h)
- hotLeads (10 items: influencers with high score + recent reply)
- stuckFollowups (10 items: inactive > 5 days)
- payoutsDue (total, count, top 5)
- alerts (10 active, sorted by detected_at desc)
- weeklyGoal (target, current, label)
- mrr (current, prevWeek, changePct)

12 queries run in parallel via `Promise.all`.

---

## API: GET /api/admin/dashboard/insights

Claude Haiku generates 2-3 actionable insights from weekly stats.
- Compares: emails sent, replies, signups, bounces (this week vs prev)
- Model: `claude-haiku-4-5-20251001`
- Max tokens: 300
- Cache: in-memory, 1 hour TTL
- Returns JSON array of strings

---

## Supabase Realtime

Two subscriptions on the admin dashboard:
1. `email_messages` INSERT where `direction=inbound` → new reply, refetch
2. `agent_alerts` INSERT → new alert, refetch

Channel name: `admin-dashboard`. Cleanup on unmount.

---

## Mobile Responsive

- Grid sections collapse to single column on mobile
- While You Slept: 2 columns on mobile, 5 on desktop
- Hot Leads + Stuck: stacked on mobile, side-by-side on md+
- Cards full-width on mobile

---

## Anti-Patterns (DO NOT)

- Make 7 separate API calls (use 1 aggregator endpoint)
- Re-fetch every 5 sec (use Supabase Realtime)
- Show more than 10 items per section
- Call Claude insights without caching (1h minimum)
