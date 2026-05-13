# 🚀 ADMIN HUB — Claude Code Prompts V4 (Vague 2 Finale)

> 3 prompts à lancer en parallèle dans Claude Code.
> Pré-requis : K + L + M déjà buildés localement (Mailbox Health + AI Triage + Partner Portal).
> Tout est encore sur branche `feature/admin-mailbox-health` — pas encore push.
>
> **Ordre de merge final** : N → O → P (après que tout soit testé local)
>
> Chaque prompt est self-contained.

---

## 🌅 PROMPT N — Daily Ops / Morning Dashboard (LA page principale)

```
CONTEXTE
========
Tu travailles sur l'Admin Hub de Viral Animal (https://viralanimal.com).
Build LA page principale du matin — celle que Samy ouvre chaque matin avec son café.
Doit montrer "Pendant que tu dormais : X" + Hot leads + Payouts + Watchdog alerts + Insights AI.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/admin-mailbox-health (continuer dessus, tout local pas encore push)

DOCS À LIRE EN PREMIER
=======================
1. ADMIN-MEGA-PLAN.md v2.1 — Module 6 (Daily Operations Dashboard)
2. SYSTEM-REFERENCE-ADMIN-WATCHDOG.md — pour les alerts
3. SYSTEM-REFERENCE-ADMIN-AI-TRIAGE.md — pour les hot leads
4. SYSTEM-REFERENCE-ADMIN-AFFILIATES.md — pour les payouts dus
5. SYSTEM-REFERENCE-BROWSE.md — pour format référence

TÂCHE
=====
Build LA page principale /dashboard/admin (replace le placeholder existant).
C'est la page que Samy ouvre EN PREMIER chaque matin.
Doit donner un overview complet en 10-15 secondes.

LAYOUT DE LA PAGE
=================
Vue desktop (Mobile responsive plus tard) :

```
┌────────────────────────────────────────────────────────────────────┐
│ ☀️ Bonjour Samy — [Mercredi 14 mai 2026, 8h32]                    │
│ 📊 MRR : $X (+Y% vs hier)  ·  Active affiliates: X  ·  [Refresh]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌─ PENDANT QUE TU DORMAIS (16h écoulées) ───────────────────┐    │
│ │ • 247 emails envoyés                                       │    │
│ │ • 18 replies reçus (12 positifs, 4 neutres, 2 négatifs)   │    │
│ │ • 4 nouveaux signups via affiliés                          │    │
│ │ • 1 nouveau paying customer 🎉 ($X)                        │    │
│ │ • Watchdog status : ✅ All systems healthy                 │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ┌─ 🔥 HOT LEADS À TRAITER (12 nouveaux) ────────────────────┐    │
│ │ Sortés par lead_score DESC + last_reply_at DESC           │    │
│ │ • @mskingdom — "When can we start?" — score 92 — 23min   │    │
│ │ • @gamefuryz — "Tell me more" — score 78 — 1h ago         │    │
│ │ • ... [Voir 9 autres] [Open Inbox]                         │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ┌─ ⚠️ STUCK / FOLLOW-UP NEEDED (8 leads) ───────────────────┐    │
│ │ • @clipmaster — onboarded 5d ago, no activation            │    │
│ │ • @viralvinny — demo_sent 7d, no reply                     │    │
│ │ [Voir tous + Send follow-up]                               │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ┌─ 💰 PAYOUTS DUE NEXT WEEK ─┐  ┌─ 🚨 WATCHDOG ALERTS ──┐       │
│ │ $1,840 to 21 affiliates    │  │ 2 critical, 5 important│       │
│ │ Auto-distributed Stripe    │  │ [Open Watchdog]        │       │
│ │ Connect on Thursday        │  │                        │       │
│ └────────────────────────────┘  └────────────────────────┘       │
│                                                                    │
│ ┌─ 📈 INSIGHTS (Claude AI) ──────────────────────────────────┐    │
│ │ "Tes emails 9am ET ont 2.3× plus de replies que 14h.       │    │
│ │  Considère shifter tes batches."                           │    │
│ │ "Niche gaming 3x better que fitness cette semaine."        │    │
│ │ [Refresh insights]                                         │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ┌─ 🎯 OBJECTIF SEMAINE ──────────────────────────────────────┐    │
│ │ Convertir 3 demo_sent → onboarded                          │    │
│ │ Progress: 1/3 ████░░░░░░░ 33%                              │    │
│ └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

FICHIERS À CRÉER
================
- app/(dashboard)/admin/page.tsx (REPLACE le placeholder existant)
- app/(dashboard)/admin/_components/morning-greeting.tsx
- app/(dashboard)/admin/_components/while-you-slept.tsx
- app/(dashboard)/admin/_components/hot-leads-section.tsx
- app/(dashboard)/admin/_components/stuck-followups.tsx
- app/(dashboard)/admin/_components/payouts-due-card.tsx
- app/(dashboard)/admin/_components/watchdog-alerts-card.tsx
- app/(dashboard)/admin/_components/ai-insights-card.tsx
- app/(dashboard)/admin/_components/weekly-goal.tsx
- app/(dashboard)/admin/_components/mrr-snapshot.tsx
- app/api/admin/dashboard/overview/route.ts (toutes les data en 1 call)
- app/api/admin/dashboard/insights/route.ts (Claude AI insights)
- lib/admin/dashboard/aggregator.ts (compute all metrics)
- SYSTEM-REFERENCE-ADMIN-MORNING-DASHBOARD.md

DATA À AGRÉGER (overview/route.ts)
===================================
1. **MRR snapshot** : last 7 days revenue + comparison
2. **Pendant que tu dormais** (since last login OR last 16h) :
   - emails sent count
   - replies count + breakdown sentiment (via email_events + AI classification metadata)
   - signups via affiliés (product_activation_events)
   - new paying customers (Stripe webhook events)
   - watchdog status (count active alerts)
3. **Hot leads** : top 10 influencers with lead_score > 70 + status='replied' + last_reply_at < 24h
4. **Stuck leads** : influencers with status in ('onboarded', 'demo_sent', 'evaluating') + no activity > 5 days
5. **Payouts due** : sum balance affiliés + count + next payout date
6. **Watchdog alerts** : count active alerts par severity
7. **Weekly goal** : configurable (table `weekly_goals` à créer si besoin OU hardcoded au début)

REAL-TIME UPDATES (Supabase Realtime)
======================================
- Hot leads → subscribe à email_messages INSERT (filter direction='inbound')
- Watchdog alerts → subscribe à agent_alerts INSERT
- MRR → subscribe à affiliate_commission_ledger INSERT (filter event_type='payment_earned')

CLAUDE INSIGHTS
===============
GET /api/admin/dashboard/insights
Génère 2-3 insights AI via Claude Haiku basé sur :
- Stats des derniers 7 jours
- Comparison avec semaine précédente
- Anomalies détectées

Prompt :
"""
Voici les stats Viral Animal des 7 derniers jours et leur comparaison avec la semaine d'avant.
Génère 2-3 insights actionnables courts pour le founder.
Format : 1 phrase par insight. Pas de markdown.

Data: {...}

Examples:
- "Tes emails 9am ET ont 2.3x plus de replies que 14h. Shift les batches."
- "Niche gaming 3x better que fitness cette semaine."
- "Reply rate baisse sur campagne X. Test new subject lines."
"""

Cache 1h dans Redis ou direct DB.

MOBILE RESPONSIVE
=================
- Mobile breakpoint : single column stack
- Cards prennent toute la largeur
- Hot leads list scrollable
- Buttons size up (44px tap target)

DEFINITION OF DONE
==================
- [ ] /dashboard/admin charge la nouvelle page (replace placeholder)
- [ ] Toutes les 7 sections affichent données réelles
- [ ] Real-time updates fonctionnent (hot leads + alerts)
- [ ] Claude insights génèrent 2-3 insights pertinents
- [ ] Mobile responsive
- [ ] Click sur chaque section → navigate vers la page complète (inbox, watchdog, affiliates)
- [ ] SYSTEM-REFERENCE-ADMIN-MORNING-DASHBOARD.md créé

ANTI-PATTERNS
=============
❌ Ne pas faire 7 API calls séparés (use 1 aggregator endpoint)
❌ Ne pas re-fetch toutes les 5 sec (use Supabase Realtime)
❌ Ne pas charger trop de data (limite 10 items par section)
❌ Ne pas oublier loading states + error fallback
❌ Ne pas spam Claude API pour les insights (cache 1h)

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-MORNING-DASHBOARD.md suivant format SYSTEM-REFERENCE-BROWSE.md.
```

---

## 💼 PROMPT O — Stripe Connect Express + Affiliate Payouts

```
CONTEXTE
========
Build le système de payouts automatiques pour les affiliés via Stripe Connect Express.
Affiliés s'onboardent eux-mêmes via partner portal, KYC géré par Stripe, payouts auto mensuels.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/admin-mailbox-health (continuer)

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md v2.1 — Module 3 (Affiliate Management)
2. SYSTEM-REFERENCE-ADMIN-AFFILIATES.md
3. SYSTEM-REFERENCE-PARTNER-PORTAL.md
4. Stripe Connect docs : https://docs.stripe.com/connect/express-accounts

TÂCHE
=====
1. Stripe Connect Express onboarding pour affiliés via portail
2. Webhook handler pour KYC status updates
3. Auto-création Connect account quand influencer.status → 'onboarded'
4. Cron mensuel pour payouts (1er du mois)
5. Fraud checks + manual review premier payout
6. Update partner portal avec statut payouts + KYC

ENV VARS REQUISES
=================
- STRIPE_SECRET_KEY ✅ déjà en prod
- STRIPE_WEBHOOK_SECRET ✅ déjà en prod
- STRIPE_CONNECT_CLIENT_ID (à ajouter)
- STRIPE_PLATFORM_ACCOUNT_ID (auto via Stripe)

FICHIERS À CRÉER
================
- lib/admin/stripe/connect-onboarding.ts (create Express account + onboarding link)
- lib/admin/stripe/payouts.ts (Stripe Transfer + Payout management)
- lib/admin/stripe/connect-webhooks.ts (KYC status updates)
- app/api/admin/affiliates/[id]/onboard/route.ts (initiate Connect onboarding)
- app/api/admin/affiliates/[id]/payout/route.ts (trigger manual payout)
- app/api/admin/payouts/route.ts (list all pending/paid payouts)
- app/api/cron/monthly-payouts/route.ts (cron 1st of month)
- app/(dashboard)/admin/payouts/page.tsx (admin payouts UI)
- app/(dashboard)/admin/payouts/_components/payouts-table.tsx
- app/(dashboard)/admin/payouts/_components/manual-review-dialog.tsx
- app/partner/onboarding/page.tsx (côté affilié — KYC flow)
- app/partner/payouts/page.tsx (affilié voit ses payouts)
- supabase/migrations/20260514_stripe_connect_columns.sql

MIGRATION SUPABASE
==================
ALTER TABLE influencers
ADD COLUMN stripe_connect_onboarded_at TIMESTAMPTZ,
ADD COLUMN stripe_connect_charges_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN stripe_connect_payouts_enabled BOOLEAN DEFAULT FALSE;

(stripe_connect_account_id + stripe_connect_status déjà existants)

FLOW ONBOARDING AFFILIÉ
========================
1. Admin marque influencer status='onboarded'
2. System auto-creates Stripe Connect Express account (Stripe.accounts.create)
3. Stripe returns account_id + account_link (onboarding URL)
4. Magic link email envoyé à influencer avec link Stripe onboarding
5. Influencer click → Stripe-hosted onboarding (KYC, bank info, ID upload)
6. Stripe webhook account.updated → update influencer.stripe_connect_*
7. Partner portal montre status "KYC complete ✅"

WEBHOOK HANDLERS
================
- account.updated → update charges_enabled, payouts_enabled, status
- account.application.deauthorized → revoke connection
- transfer.created → log dans affiliate_payouts
- transfer.failed → alert watchdog + flag

CRON MONTHLY PAYOUTS
====================
netlify.toml :
[[scheduled.functions]]
  path = "/api/cron/monthly-payouts"
  schedule = "0 9 1 * *"  # 1er du mois 9am

Process :
1. Find all affiliés avec balance >= $50 + payouts_enabled = true
2. Pour chaque, check fraud_flags (skip si critical flag actif)
3. Pour les premiers payouts : ne pas process (manual review required)
4. Pour les payouts récurrents : Stripe Transfer (platform → connected account)
5. INSERT INTO affiliate_payouts avec status='processing'
6. Mark commission_ledger entries comme 'payout_deduction'
7. Webhook transfer.created → mark payout 'completed'
8. Email confirmation à l'affilié

FRAUD CHECKS (avant payout)
============================
Skip payout SI :
- fraud_flags WHERE severity IN ('critical', 'high') AND status='open'
- chargeback récent (last 30 days)
- self-referral détecté
- < 2 paid cycles complets

Flag pour manual review SI :
- premier payout (toujours)
- balance > $500
- nouveau pattern d'IP/device

UI ADMIN /dashboard/admin/payouts
==================================
- Table : affilié, balance, KYC status, last payout, next payout
- Filter : Pending review / Approved / Sent / Failed
- Actions par row :
  - "Review and approve" pour first-time payouts
  - "Force payout now" (urgence)
  - "Hold payout" + reason
- Bulk : process all approved

UI PARTNER /partner/onboarding
===============================
- Si status = pending KYC → bouton "Complete Stripe onboarding" → redirect Stripe-hosted
- Si status = active → "KYC complete ✅"
- Banking info display (last 4 digits)
- Update banking link

UI PARTNER /partner/payouts
============================
- Liste payouts historiques (date, amount, status)
- Next payout : "Scheduled June 1, 2026 — estimated $X"
- T4A annual download (Stripe auto-génère)

DEFINITION OF DONE
==================
- [ ] Migration apply en prod (Supabase MCP)
- [ ] Admin marks influencer 'onboarded' → Stripe Connect account créé auto
- [ ] Magic link onboarding envoyé à l'affilié
- [ ] Stripe webhook account.updated → influencer table updated
- [ ] Cron mensuel trigger + premier payout flag pour manual review
- [ ] Admin peut approve manuellement le premier payout
- [ ] Stripe Transfer execute + webhook confirms
- [ ] Email confirmation envoyé à l'affilié
- [ ] Partner portal montre KYC status + payouts history
- [ ] SYSTEM-REFERENCE-ADMIN-PAYOUTS.md créé

ANTI-PATTERNS
=============
❌ Ne JAMAIS auto-payout sans fraud check
❌ Ne pas process le premier payout sans manual review
❌ Ne pas oublier de mark commission_ledger 'payout_deduction'
❌ Ne pas exposer stripe_connect_account_id côté client
❌ Ne pas re-process un payout déjà sent (idempotency via affiliate_payouts.id)

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-PAYOUTS.md suivant format SYSTEM-REFERENCE-BROWSE.md.
```

---

## 📊 PROMPT P — Pipeline Analytics + Cost Tracker

```
CONTEXTE
========
Build la suite analytics complète : Funnel, Revenue, Affiliate Leaderboard,
Campaign Performance, Cohorts, et Cost Tracker mensuel.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/admin-mailbox-health (continuer)

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md v2.1 — Module 4 (Pipeline Analytics) + Module 8 (Financial Ops)
2. SYSTEM-REFERENCE-ANALYTICS.md — pour pattern Recharts existant
3. SYSTEM-REFERENCE-ADMIN-AFFILIATES.md — pour data ledger

TÂCHE
=====
1. Funnel Acquisition (emails → replies → onboarded → paying → MRR)
2. Revenue Dashboard (MRR live, NRR, breakdown plans)
3. Affiliate Leaderboard avec tier system (Bronze/Silver/Gold)
4. Campaign Performance (par campagne + comparison)
5. Cohort Analysis (retention par mois)
6. Cost Tracker mensuel (infra + commissions + opex)
7. P&L view simple

FICHIERS À CRÉER
================
- app/(dashboard)/admin/analytics/page.tsx (overview avec tabs)
- app/(dashboard)/admin/analytics/funnel/page.tsx
- app/(dashboard)/admin/analytics/revenue/page.tsx
- app/(dashboard)/admin/analytics/affiliates/page.tsx (leaderboard)
- app/(dashboard)/admin/analytics/campaigns/page.tsx
- app/(dashboard)/admin/analytics/cohorts/page.tsx
- app/(dashboard)/admin/costs/page.tsx (Cost Tracker)
- app/(dashboard)/admin/_components/analytics/* (8-10 components)
- app/api/admin/analytics/funnel/route.ts
- app/api/admin/analytics/revenue/route.ts
- app/api/admin/analytics/affiliates/route.ts
- app/api/admin/analytics/campaigns/route.ts
- app/api/admin/analytics/cohorts/route.ts
- app/api/admin/costs/route.ts
- lib/admin/analytics/aggregators.ts (SQL queries optimisées)
- lib/admin/costs/calculator.ts (auto-compute costs from ai_calls + Stripe + manual entries)
- supabase/migrations/20260514_costs_tracking.sql

MIGRATION — Table costs_manual
================================
CREATE TABLE public.costs_manual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'infra', 'cold_email', 'tools', 'vas', 'legal',
    'banking', 'taxes', 'misc'
  )),
  vendor TEXT NOT NULL,  -- 'Netlify', 'Supabase', 'Anthropic', etc.
  description TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT DEFAULT 'usd',
  billing_period_start DATE,
  billing_period_end DATE,
  invoice_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID REFERENCES auth.users(id)
);
CREATE INDEX idx_costs_period ON costs_manual(billing_period_start DESC);
CREATE INDEX idx_costs_category ON costs_manual(category, billing_period_start DESC);

FUNNEL VISUALIZATION
====================
Visual funnel avec Recharts (FunnelChart) :
- Emails sent (total all-time + this month)
- Emails opened (% drop-off)
- Replies (% drop-off)
- Interested (positive sentiment)
- Demo sent
- Onboarded affiliates
- Active promoters
- Paying users brought
- MRR generated

Compute via SQL queries sur email_events + influencers + affiliate_commission_ledger.

Breakdown par : campagne, niche, platform, time period.

REVENUE DASHBOARD
=================
- MRR live (Stripe Customer subscriptions)
- ARR projection
- Breakdown : Starter $29 / Creator $49 / Pro $99 / Studio $199
- New MRR / Expansion / Contraction / Churn (last 30 days)
- Affiliate-attributed revenue vs organic
- LTV par segment
- Graphique line 90 jours

AFFILIATE LEADERBOARD
=====================
Top 20 affiliés ranked par revenue brought (this month + all time).

Tier system (computed) :
- 🥉 Bronze : 1-5 paying users
- 🥈 Silver : 6-20 paying users
- 🥇 Gold : 21+ paying users

Affichage :
- Avatar/initials + name + platform
- Revenue brought (this month)
- Conversion rate (clicks → paying)
- Recent activity (posts last 7 days — via affiliate_clicks)
- Tier badge

Actions admin :
- Promote to next tier manually
- Send personalized thank-you
- Disable affiliate

CAMPAIGN PERFORMANCE
====================
Par campagne :
- Volume sent
- Open rate / Reply rate / Conversion rate
- CPA (cost per acquisition) = opex / paying users brought
- Best/worst performing subject lines (from email_templates A/B results)
- ROI computed

Comparison view : Campagne A vs B vs C side-by-side.

COHORT ANALYSIS
===============
Cohorts par mois de prospection (cohort = mois où influenceur a été contacté pour la 1ère fois).

Table :
- Cohort | Influencers contacted | Onboarded | Active | Paying | Revenue retained
- Mois 1 : 100 contacted → 5 active → $400 MRR
- Mois 2 : 250 contacted → 15 active → $1,200 MRR
- ...

Retention curves : % d'affiliés encore actifs après X mois.

COST TRACKER
============
Page /dashboard/admin/costs

Sections :
1. **This month total** : $X
2. **Breakdown auto-computed** :
   - Anthropic API ($X — from ai_calls table)
   - Stripe fees ($X — 2.9% × MRR)
   - Affiliate commissions ($X — from affiliate_commission_ledger)
3. **Breakdown manual** (entries from costs_manual table) :
   - Netlify, Supabase, Sentry, etc.
4. **Add cost** button → modal form
5. **Monthly trends** : Recharts line chart

P&L View :
Revenue $X
- Stripe fees $X
- Affiliate commissions $X
- Infra costs $X
- Tools $X
- Other $X
─────────
NET PROFIT $X (margin %)

DEFINITION OF DONE
==================
- [ ] Page /dashboard/admin/analytics avec 5 sub-pages (funnel, revenue, affiliates, campaigns, cohorts)
- [ ] Funnel visualization avec Recharts
- [ ] Revenue dashboard MRR live
- [ ] Affiliate leaderboard avec tier badges
- [ ] Campaign comparison view
- [ ] Cohort table avec retention
- [ ] /dashboard/admin/costs avec auto-compute + manual entries
- [ ] P&L view simple
- [ ] Migration costs_manual apply
- [ ] SYSTEM-REFERENCE-ADMIN-ANALYTICS.md créé

ANTI-PATTERNS
=============
❌ Ne pas faire des queries N+1 (use SQL aggregations efficaces)
❌ Ne pas re-compute MRR à chaque page load (cache 5 min)
❌ Ne pas exposer all customer data dans leaderboard (anonymize "User #1234")
❌ Ne pas oublier index sur les colonnes triées
❌ Ne pas faire de SELECT * sur tables volumineuses

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-ANALYTICS.md suivant format SYSTEM-REFERENCE-BROWSE.md.
```

---

## 📋 Ordre d'exécution

### Phase 1 — Lance les 3 sessions en parallèle (2-3h)
- 🌅 **Prompt N** — Morning Dashboard (la plus importante)
- 💼 **Prompt O** — Stripe Connect + Payouts
- 📊 **Prompt P** — Analytics + Cost Tracker

### Phase 2 — Merge ordre (quand tu reviens)
1. **P** (Analytics — autonome, pas de conflit)
2. **N** (Morning Dashboard — utilise des données déjà existantes)
3. **O** (Stripe Connect — modifie le partner portal de Prompt M)

### Phase 3 — Push + Test
Après que tu aies récupéré ta clé Anthropic, tu push tout d'un coup et tu test live.

---

*Document créé : 2026-05-13*
*Pré-requis : K+L+M déjà buildés localement*
*Output attendu : Vague 2 100% complete + Cost Tracker bonus*
