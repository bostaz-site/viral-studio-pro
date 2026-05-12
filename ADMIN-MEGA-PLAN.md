# 🏗️ ADMIN MEGA PLAN v2.0 — Viral Animal Operations Hub

> Plan complet du côté admin/operations de Viral Animal pour soutenir le scaling progressif de **10k → 30k → 50k → 150k cold emails/mois**, gérer le CRM influenceurs, le programme affilié, et atteindre $30-50k MRR au mois 6-12.
>
> **Philosophie de build** : *Construire la meilleure base maintenant pour que les ops soient simples plus tard.* Pas un MVP duct-tapé — une fondation solide qui scale à $1M ARR sans rewrite.

---

## 📋 Sommaire

1. [Contexte & Objectifs](#contexte--objectifs)
2. [Personas & Use Cases](#personas--use-cases)
3. [Architecture Globale](#architecture-globale)
4. [Les 8 Modules](#les-8-modules)
5. [Tech Stack & Intégrations](#tech-stack--intégrations)
6. [Roadmap 12 Semaines — 3 Vagues](#roadmap-12-semaines--3-vagues)
7. [Framework de Validation (3 Signaux)](#framework-de-validation-3-signaux)
8. [Pricing & Commission Affiliés](#pricing--commission-affiliés)
9. [Anti-Fraude & Compliance](#anti-fraude--compliance)
10. [Risques & Mitigations](#risques--mitigations)

---

## Contexte & Objectifs

### Le Business
**Viral Animal** est une SaaS qui transforme les streams Twitch/Kick/YouTube en clips viraux pour TikTok, YouTube Shorts, Instagram. App live à viralanimal.com (Next.js + Supabase + Stripe + Claude).

### Le Modèle d'Acquisition (le core de ce plan)
- **Cold email aux influenceurs** (pas aux end users) avec offre irrésistible
- **30% commission récurrente à vie** sur les users qu'ils ramènent
- **Volume cible progressif** :
  - Mois 1-2 : 10k emails/mois (15-20 mailboxes)
  - Mois 3-4 : 30k emails/mois (45-60 mailboxes) — *si signaux validation OK*
  - Mois 5-6 : 50k emails/mois (75-100 mailboxes)
  - Mois 7+ : 150k emails/mois (180-230 mailboxes) — *objectif lointain*
- **Objectif financier** : $10k MRR à M3, $30k à M6, $50-80k à M12

### Le Founder (Samy)
- Solo founder, technical
- 8-10h/jour de hustle, 6 jours/semaine = 48-60h/semaine
- 12 semaines = ~576-720h de dev = assez pour construire une fondation propre
- Doit pouvoir tout gérer depuis 1 dashboard centralisé
- VA team prévue à partir de M3-M4 (~$4-6k/mois opex personnel)

### Le Problème à Résoudre
Le but n'est PAS d'atteindre 150k emails/mois D1. Le but est de construire **maintenant** la machine qui fait que :
- À 10k/mois, tu n'es pas noyé dans Gmail
- À 30k/mois, tu n'as pas à tout rewrite
- À 150k/mois, tu opères toujours seul (ou avec 1-2 VAs)

**Le côté admin doit transformer "chaos de replies + payouts + affiliés" en "pipeline propre et automatisé".**

### Objectifs du Système Admin

1. **Productivité founder** : Traiter 50 replies/jour en < 30 min, scalable à 500/jour en < 2h
2. **Conversion** : Améliorer reply→demo→paying via personnalisation + suivi automatisé
3. **Rétention affiliés** : 70%+ des affiliés actifs au mois 3 (vs 20-30% sans système)
4. **Confiance** : Payer les commissions à l'heure, ledger auditable, dashboard transparent
5. **Scalabilité** : Passer de solo à 5 VAs sans casser le système (admin_users + roles)
6. **Insights** : Savoir quelle niche/template/audience convertit le mieux
7. **Compliance** : CASL/CAN-SPAM/GDPR audit-ready dès le D1

---

## Personas & Use Cases

### Persona 1 — Samy (Owner / Founder)
**Rôle DB** : `owner` (accès total)
**Quotidien** : 8-10h, mix code/ops/stratégie
**Pain points actuels** : Replies éparpillées dans 7 mailboxes Zoho, aucune visibilité funnel
**Goals** : Dashboard matin (2 min), répondre hot leads (< 5 min), ROI par campagne

### Persona 2 — VA (Virtual Assistant) — *Vague 2-3*
**Rôle DB** : `va` (CRM + inbox + lead status + notes, PAS payouts/Stripe/credentials)
**Quotidien** : 4-6h, focus replies + qualification
**Goals** : Workflow simple, scope limité, pas de risque de casser le système

### Persona 3 — Ops Manager — *Plus tard*
**Rôle DB** : `ops` (CRM + inbox + campaigns, PAS finance)
**Goals** : Lancer/pauser des campagnes, gérer les séquences

### Persona 4 — Finance / Comptable — *Plus tard*
**Rôle DB** : `finance` (payouts + revenue + ledger, PAS inbox bodies)
**Goals** : Vérifier les commissions, exporter T4A, audit

### Persona 5 — Affilié (Influenceur)
**Auth séparée** : Magic link sur email (pas dans `admin_users`)
**Quotidien** : Visite 1-2x/semaine pour voir ses commissions
**Goals** : Voir ses earnings, son code, son rank, get payé à temps

### Persona 6 — End User (Creator payant)
N'a PAS accès à l'admin. Mais ses actions génèrent des events (signup → trial → paying → churn) qui populent le funnel et déclenchent les commissions.

---

## Architecture Globale

```
┌───────────────────────────────────────────────────────────────────────┐
│                       VIRAL ANIMAL ADMIN HUB                          │
│                       (/dashboard/admin/*)                            │
│                  Role-based: owner/ops/va/finance/readonly            │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  📥 INBOX    │  │  👥 CRM      │  │  📊 FUNNEL   │                │
│  │ Cold email   │  │ Influencers  │  │  Analytics   │                │
│  │   replies    │  │   pipeline   │  │  dashboards  │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  💰 AFFILIATE │  │  🎬 DEMOS    │  │  📅 TODAY    │                │
│  │   Stripe     │  │ Auto-gen     │  │  Daily ops   │                │
│  │   Connect    │  │  for outreach │  │   queue      │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  🎯 SEQUENCES │  │  🤖 AI       │  │  ⚙️  CONFIG   │                │
│  │ Email builds │  │  Lead scoring │  │  Templates,  │                │
│  │  + A/B test  │  │  + replies   │  │  domains, etc │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
            │                  │                    │
            ▼                  ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│   INSTANTLY    │  │   SUPABASE     │  │   STRIPE       │
│  (Cold email   │  │  (Database +   │  │  (Subscriptions│
│   sending +    │  │   Realtime +   │  │   + Connect    │
│   webhooks)    │  │   Storage)     │  │   Express)     │
└────────────────┘  └────────────────┘  └────────────────┘
            │                  │                    │
            ▼                  ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│   CLAUDE API   │  │  INNGEST jobs  │  │ webhook_events │
│  (Haiku for    │  │  (retries +    │  │  (idempotency  │
│   classif/     │  │  idempotency)  │  │  layer global) │
│   draft/score) │  │                │  │                │
└────────────────┘  └────────────────┘  └────────────────┘
```

### Principes Architecture

1. **Single source of truth** : Supabase Postgres centralise TOUT. Pas de "ma liste Excel à côté".

2. **Event-driven + idempotent** : `webhook_events` table empêche le double-comptage. Chaque event (email sent, reply, signup, payment) génère un event traçable.

3. **AI-augmented, NOT AI-replacing** : Claude propose, Samy/VA décide. Auto-classify, auto-draft, auto-score — mais l'humain garde le contrôle critique (envois, payouts, demos).

4. **Multi-step pipeline standardisé** : Tout influencer passe par les mêmes états (cold → contacted → ... → paying). Métriques cohérentes.

5. **Role-based access** : `admin_users` avec rôles (owner/ops/va/finance/readonly). RLS par rôle. Ajout VAs sans casser sécurité.

6. **Real-time** : Dashboard live via Supabase Realtime pour replies + hot leads.

7. **Mobile-friendly** (Vague 3) : Inbox + hot leads + notifs accessibles depuis téléphone.

8. **Audit-friendly** : `admin_audit_log` track qui fait quoi. `affiliate_commission_ledger` immuable pour audit financier.

9. **Compliance baked-in** : `suppression_list` globale enforce avant chaque envoi. Pas un patch — un layer de base.

10. **Permissions orthogonales, pas hiérarchiques** : `can_view_finance()`, `can_manage_crm()`, `can_view_inbox_bodies()` — chaque capability est explicite. Finance n'est pas "au-dessus" d'ops, c'est différent. Évite les fuites de permissions.

11. **Ledger service-only** : `affiliate_commission_ledger` est immuable et ne peut être écrit que par les webhook handlers + service_role. Pas même finance n'INSERT directement. Auditabilité béton.

12. **Updates via RPC pour les rôles non-owner** : VAs/ops ne font pas d'UPDATE direct sur les tables — ils passent par des RPC sécurisées qui contrôlent exactement les colonnes modifiables.

---

## Les 8 Modules

> **Note** : Tous les 8 modules sont dans le scope final. Ils sont juste rolled out en 3 vagues (voir [Roadmap](#roadmap-12-semaines--3-vagues)).

### Module 1 — Cold Email Engine

**Sub-modules :**

#### 1.1 Inbox unifié (Vague 1)
Tous les replies dans une seule vue Gmail-like avec auto-classification Claude, templates rapides, filters par campagne/sender/sentiment/date.

#### 1.2 Sequence Builder (Vague 3)
UI multi-step avec variables dynamiques, A/B testing, versioning. **Pas un clone d'Instantly** — un orchestrateur qui sync avec Instantly/Smartlead.

#### 1.3 List Management (Vague 1-2)
Import CSV, enrichment (Apify/Apollo), dedupe via `lower(email)`, segments, exclusion via `suppression_list` GLOBALE.

#### 1.4 Mailbox Health (Vague 2)
Status (active/paused/warming/blocked), reputation score, domain health, volume tracking via `mailbox_daily_stats`, alertes anti-Zoho-redux.

#### 1.5 Compliance Layer (Vague 1 — P0)
CASL/CAN-SPAM/GDPR/Loi 25. Auto-unsubscribe instant, suppression list enforcement, audit log, data retention, export RGPD 1-click.

---

### Module 2 — Influencer CRM

**Sub-modules :**

#### 2.1 Influencer Database (Vague 1)
Table `influencers` avec status pipeline (14 statuts), lead score, tags, notes, source, audit. Unique sur `lower(email)`.

#### 2.2 Influencer List Page (Vague 1)
Table filtrable/triable. Filters rapides : "Hot leads", "Active affiliates", "Dormant > 30d", "Top earners". Bulk actions.

#### 2.3 Influencer Detail Page (Vague 1)
Tabs : Overview, Conversation, Demos, Affiliate Perf, Notes, Audit log. Quick actions sidebar (send email, generate demo, mark VIP, etc.).

#### 2.4 Pipeline Kanban (Vague 2)
Vue Kanban où chaque colonne = un status. Drag & drop pour mouvements manuels.

---

### Module 3 — Affiliate Management

**Sub-modules :**

#### 3.1 Affiliate Onboarding (Vague 2)
Auto-generate code + Stripe Connect Express + welcome email + promo kit quand status → `onboarded`.

#### 3.2 Attribution Tracking (Vague 1)
- Cookie 60 jours + UTM persistence
- Server-side via `affiliate_clicks` (fingerprint backup pour Safari/iOS)
- `referred_by_influencer_id` sur user profile
- Stripe subscription metadata

#### 3.3 Commission Ledger (Vague 1-2)
**IMMUABLE** : `affiliate_commission_ledger` avec 1 ligne par event (payment/refund/chargeback/adjustment). Pas de totaux modifiables. Totaux = vues SQL agrégées.

#### 3.4 Payout Engine (Vague 2)
- Cron mensuel
- Threshold $50 minimum
- Net-30 hold (refund window)
- Manual review premier payout
- Stripe Connect Express transfer
- Email notification

#### 3.5 Affiliate Dashboard (côté affilié) (Vague 2)
Auth magic link. Voir earnings, code, clicks/signups/paying, prochaine date payout, T4A annuel.

---

### Module 4 — Pipeline Analytics

**Sub-modules :**

#### 4.1 Acquisition Funnel (Vague 2)
Visualisation funnel : Emails sent → Opened → Replies → Interested → Demo → Onboarded → Active → Paying → MRR.

Comparison vs mois précédent, breakdown par campagne/niche/platform.

#### 4.2 Revenue Dashboard (Vague 3)
MRR live, NRR, breakdown plans, geographic distribution, affiliate-attributed vs organic, LTV par segment.

#### 4.3 Affiliate Leaderboard (Vague 2)
Top 20 affiliés ranked par revenue/conversion/activity. Tier system (Bronze/Silver/Gold).

#### 4.4 Campaign Performance (Vague 2)
Par campagne : volume, open/reply/conversion rates, CPA, best/worst subject lines, A/B results.

#### 4.5 Cohort Analysis (Vague 3)
Quels mois génèrent le plus de revenue ? Retention curves.

---

### Module 5 — AI Automation Layer

**Sub-modules :**

#### 5.1 Auto-classify Replies (Vague 2)
Claude Haiku → sentiment (positive/neutral/negative/spam/hostile). Coût ~$10/mois à 4500 replies.

#### 5.2 Suggested Reply Drafts (Vague 2)
Claude propose 2-3 réponses contextualisées. **Toujours humain dans la loop** — Samy review/edit/send. Coût ~$22/mois.

#### 5.3 Lead Scoring (Vague 2)
Score 0-100 : 25% niche fit + 20% audience + 15% engagement + 15% sponsorship history + 15% reply sentiment + 10% geo/lang. Re-calculé après chaque event.

**Approche** : Rule-based + Haiku reasoning. ML maison plus tard.

#### 5.4 Smart Follow-up Scheduling (Vague 2-3)
Au lieu de "follow-up dans 3 jours fixe", Claude évalue sentiment + timezone + historique.

#### 5.5 Auto-generate Demo Packages (Vague 3)
Fetch 5-10 derniers clips → score → pick top 3 → render → landing page → email pre-drafted. **Quality gate manuel obligatoire** — un mauvais demo personnalisé est pire qu'aucun.

#### 5.6 Anomaly Detection (Vague 3)
Alertes auto : bounce rate spike, reply rate drop, affilié dormant, user churn pour win-back.

**Coût total Claude** : ~$50-100/mois à 50k emails/mois (négligeable).

---

### Module 6 — Daily Operations Dashboard

#### 6.1 Morning Dashboard (Vague 2)
```
☀️ Bonjour Samy — Vendredi 16 mai 2026
📊 MRR : $4,230 (+12% vs last week)   Active affiliates: 18

🔥 HOT LEADS (action required)            12 new
   @adriantv replied "Yes I'd love to try" — 23 min ago
   ...

⚠️ STUCK / FOLLOW-UP NEEDED               8 leads
   @clipmaster — accepted offer 5d ago, no activation
   ...

💰 PAYOUTS DUE NEXT WEEK                  $1,840
   21 affiliates · auto-distributed via Stripe Connect

📅 SCHEDULED FOR TODAY
   • Email batch #142 (500 emails) — sent 9:00 ✓
   • Reply review (12 hot)
   • Demo package generation queue (8 pending)

📈 INSIGHTS
   • Best subject line this week: "Quick clip from..." (12% reply)
   • Niche "gaming" 3x better than "fitness"
   • 2 new affiliate signups need KYC follow-up
```

#### 6.2 Notifications (Vague 2-3)
- Real-time toast (hot reply, high lead score)
- Email digest matinal
- Mobile push (PWA) — Vague 3

---

### Module 7 — Content Operations

#### 7.1 Demo Package Generator (Vague 3)
Auto-gen 3 vidéos personnalisées + landing page + email pre-drafted. Quality gate manuel D1.

#### 7.2 Demo Library (Vague 3)
Tous les demos générés, réutilisables.

#### 7.3 Quality Checks (Vague 3)
Auto-flag si render rate bas ou viral score < 30.

---

### Module 8 — Financial Operations

#### 8.1 Revenue Tracker (Vague 2-3)
MRR live (Stripe webhooks), ARR, plans breakdown, geographic, New/Expansion/Contraction/Churn MRR.

#### 8.2 Cost Tracker (Vague 3)
Infra mensuelle, cold email, API costs (auto-logged via `ai_calls`), VAs, autres.

#### 8.3 Affiliate Payouts (Vague 2)
Combien dû à chaque affilié, status, historical.

#### 8.4 Profit & Loss (Vague 3)
Vue simple Revenue - (Stripe fees + Commissions + Infra + Ops + VAs).

#### 8.5 Stripe Integration Health (Vague 1-2)
Webhook health, Connect onboarding completion, failed payments, disputes.

---

## Tech Stack & Intégrations

### Existant (déjà en place)
- **Frontend** : Next.js 14 + TypeScript + Tailwind + shadcn/ui
- **Backend** : Next.js API routes
- **DB** : Supabase Postgres + RLS + Storage
- **Auth** : Supabase Auth
- **Payments** : Stripe (test mode, LIVE en attente NEQ)
- **AI** : Claude API (Haiku for cheap stuff)
- **Render** : VPS Railway with FFmpeg
- **Logs/errors** : Sentry
- **Hosting** : Netlify

### À AJOUTER

#### Critical (Vague 1-2)
1. **Stripe Connect Express** — pour les affiliés
2. **Instantly API integration** — webhooks ingestion + envoi
3. **Resend** — emails transactionnels ($20/mo pour 50k emails)
4. **Inngest** — background jobs critiques avec retries + idempotency
5. **Webhook ingestion routes** : `/api/admin/webhooks/{instantly,stripe,...}` avec `webhook_events` table

#### Nice-to-have (Vague 2-3)
6. **Apify / Apollo.io** — scraping/enrichment influencers
7. **Trigger.dev** — alternative à Inngest si DX préféré
8. **Tinybird** — analytics queries fast (si Supabase trop slow à scale)
9. **PostHog** — product analytics côté user

### Cost estimate mensuel (à plein régime — M6+ à 50k/mois)

| Item | Coût |
|---|---|
| Instantly Hypergrowth | $97 |
| Resend (transactional) | $20 |
| Domains (60 × $12/yr) | $60 |
| Apify (enrichment) | $50 |
| Stripe fees (~3% de $30k MRR) | $900 |
| Netlify Pro | $20 |
| Supabase Pro | $25 |
| Sentry | $26 |
| Anthropic API (Claude Haiku) | $50-100 |
| Inngest | $0-20 |
| Misc tools | $50 |
| **Total infra** | **~$1,400** |
| Affiliate commissions (~25-30% de $30k) | $7,500 |
| **Total opex (sans VAs)** | **~$8,900** |

Avec VAs ($4-6k/mois) → **~$13-15k/mois**, soit ~45% margin à $30k MRR.

---

## Roadmap 12 Semaines — 3 Vagues

### 🌊 VAGUE 1 — Foundation (Semaines 1-3) — RÉVISÉE v2.1

**Objectif** : Envoyer 10k emails/mois proprement + recevoir replies + tracker conversions.

**Philosophie** : Boring & solide. Pas de UI fancy. Pas d'AI. Pas de polish. **Source de vérité + compliance + tracking.**

> **⚠️ v2.1 changements** : Permissions explicites (pas hiérarchie), ledger service-only, attribution déplacée en Semaine 2 pour réalisme, `campaign_recipients` + product activation events ajoutés en Semaine 1.

#### Semaine 1 — Data Foundation + CRM + Compliance + Inbox read-only
*(Voir `ADMIN-NEXT-7-DAYS.md` pour le détail J1-J7)*
- [ ] Migrations Supabase v2.0 + v2.1 (staging d'abord, prod J2 matin)
- [ ] Capability-based helpers (`can_view_crm`, `can_manage_payouts`, etc.) — pas hiérarchie
- [ ] `admin_users` + 5 rôles (owner/ops/va/finance/readonly)
- [ ] RPC functions pour VA updates (`update_influencer_status`, etc.)
- [ ] Influencer CRM : list + detail + RPC actions
- [ ] CSV import + `import_batches` + dedupe via CITEXT
- [ ] `suppression_list` global (CITEXT) + page admin
- [ ] Public unsubscribe avec token signé (PAS d'email dans URL)
- [ ] `webhook_events` idempotency layer
- [ ] Webhook Instantly handler (4 events: sent/replied/bounced/unsubscribed)
- [ ] Inbox read-only (body masqué pour VAs via view)
- [ ] Campaign basic + export CSV suppression-aware
- [ ] `campaign_recipients` tracking
- [ ] Product activation events instrumentés (signup, first_render, first_platform_connected)

#### Semaine 2 — Attribution + Reply Composer + Ledger Initial
- [ ] Affiliate code generation
- [ ] `/r/[code]` redirect + `affiliate_clicks` logging (IP hashed avec pepper)
- [ ] Cookie 60 jours + UTM persistence
- [ ] Server-side fingerprint backup (privacy hardened)
- [ ] `referred_by_influencer_id` sur user profile
- [ ] Stripe webhook handler (idempotent via `webhook_events`)
- [ ] `affiliate_commission_ledger` INSERT via service_role uniquement (sur payment)
- [ ] Refund/chargeback clawback auto
- [ ] Reply composer dans inbox (send via Resend ou Instantly API)
- [ ] Campaign push vers Instantly API (au lieu de CSV manuel)

#### Semaine 3 — Mailbox Health + Polish Vague 1
- [ ] `mailbox_daily_stats` ingestion
- [ ] Mailbox health dashboard
- [ ] Bounce/unsub auto-handling complet
- [ ] Hot replies filter polish
- [ ] Audit log UI
- [ ] Webhook health monitor UI
- [ ] Premier vrai send de 100-500 leads test
- [ ] Validation : tous les events product activation arrivent en DB

**Definition of Done Vague 1** :
- ✅ Tu peux importer 1k-3k leads via CSV (dedupe + suppression)
- ✅ Envoyer via Instantly et tracker les sends/opens/replies/bounces
- ✅ Recevoir les replies dans ton admin inbox unifié
- ✅ Voir les hot leads (filtre simple)
- ✅ Suppression list enforce → jamais recontacter unsub/bounce
- ✅ Tracker un signup + payment via ref code → ligne immuable dans commission_ledger
- ✅ Refund/chargeback → clawback automatique
- ✅ Product activation events captés pour Signal 3 validation
- ✅ Mesurer : reply rate, bounce rate, signup rate, activation rate par campagne

---

### 🌊 VAGUE 2 — Automation + Affiliate (Semaines 4-8)

**Objectif** : AI triage + affiliate dashboard complet + Stripe Connect + analytics + daily ops.

#### Semaine 4 — AI Triage
- [ ] `ai_calls` logging table (track tous les Claude API calls)
- [ ] Reply classification Claude Haiku (positive/neutral/negative/spam/hostile)
- [ ] Lead scoring engine (rule-based + Haiku reasoning)
- [ ] Suggested reply drafts (3 variantes)
- [ ] Thread summary pour conversations longues
- [ ] Hot lead priority queue (sorted by score × recency)

#### Semaine 5 — Affiliate Dashboard
- [ ] Magic link auth pour affiliés (séparé de admin)
- [ ] Affiliate dashboard UI (clicks/signups/paying stats)
- [ ] Commission balance display
- [ ] Terms acceptance flow (`affiliate_terms_accepted_at`)
- [ ] Code/lien display + copy button
- [ ] Promo kit download

#### Semaine 6 — Stripe Connect Express
- [ ] Connect Express onboarding flow
- [ ] KYC status sync via webhook
- [ ] Payout threshold logic ($50 minimum)
- [ ] `payout_holds` table (30-day refund window)
- [ ] Manual payout approval UI (review premier payout)
- [ ] `fraud_flags` table + checks (self-referral, IP/device clustering)
- [ ] Refund/chargeback clawback automation

#### Semaine 7 — Analytics
- [ ] Funnel dashboard avec breakdowns (campagne/niche/platform)
- [ ] Campaign performance metrics
- [ ] Mailbox health monitoring (`mailbox_daily_stats`)
- [ ] Reply rates by segment
- [ ] Template performance ranking
- [ ] Affiliate leaderboard avec tier system (Bronze/Silver/Gold)

#### Semaine 8 — Daily Ops
- [ ] Morning dashboard layout
- [ ] Hot leads section
- [ ] Follow-ups needed section
- [ ] Affiliate KYC issues
- [ ] Payouts due
- [ ] Mailbox warnings
- [ ] Daily digest email (cron 8am)

**Definition of Done Vague 2** :
- ✅ Tu peux gérer 10k-30k emails/mois
- ✅ 300-1000 replies/mois triées automatiquement
- ✅ 20-100 affiliés onboardés avec dashboard fonctionnel
- ✅ Payouts auto via Stripe Connect Express
- ✅ Daily ops dashboard utilisé chaque matin
- ✅ Tu sais quelle campagne/niche/template convertit le mieux

---

### 🌊 VAGUE 3 — Power Tools + Scale (Semaines 9-12)

**Objectif** : Sequence Builder custom + Demo Generator + Financial Ops avancée + Mobile/PWA.

#### Semaine 9 — Sequence Builder
- [ ] `email_sequences` + `sequence_steps` tables
- [ ] Template versioning (`email_templates` history)
- [ ] `campaign_recipients` (lie influencer ↔ campaign ↔ step ↔ mailbox)
- [ ] A/B variants config
- [ ] Provider sync push (Instantly/Smartlead API)
- [ ] **PAS** de sending engine custom — orchestrateur only

#### Semaine 10 — Demo Generator V1
- [ ] `demo_packages` table
- [ ] Fetch clips via yt-dlp/Apify
- [ ] Score/select top 3 clips
- [ ] Trigger VPS render avec optimal config par niche
- [ ] Landing page `/demo/[slug]`
- [ ] **Quality gate manuel** : bouton "Approve demo" obligatoire avant send
- [ ] Pre-drafted email avec demo links

#### Semaine 11 — Financial Ops Avancée
- [ ] MRR dashboard détaillé
- [ ] Affiliate cost breakdown
- [ ] Infra cost manual logging
- [ ] Gross margin computation
- [ ] Payout forecast (mois suivant)
- [ ] Refund/chargeback impact analysis
- [ ] P&L vue simple

#### Semaine 12 — Mobile/PWA + Polish
- [ ] Mobile responsive inbox + hot leads + payouts
- [ ] PWA install + push notifications (si worth it)
- [ ] VA permissions polish (test avec un VA test)
- [ ] Audit log UI polish
- [ ] Daily digest email content polish
- [ ] Documentation interne pour VAs

**Definition of Done Vague 3** :
- ✅ Custom sequences sans aller dans Instantly
- ✅ Demos personnalisés on-demand avec quality gate
- ✅ Payouts audités avec ledger immuable
- ✅ Daily ops mobile-friendly
- ✅ Financial visibility complète (MRR, margin, payouts)
- ✅ Prêt à scale à 50k+ emails/mois avec 1-2 VAs

---

## Framework de Validation (3 Signaux)

> **Règle d'or** : Ne PAS scaler le volume email tant que les 3 signaux ne sont pas verts. Sinon tu amplifies juste un mauvais canal.

### À 10k emails/mois (Mois 1-2), tu DOIS atteindre :

#### Signal 1 — Acquisition email propre
- Total reply rate : **≥ 2.5%** (cible : 4-6%)
- Positive reply rate : **≥ 0.5%** (cible : 1%+)
- Unsubscribe rate : **< 0.5%**
- Bounce rate : **< 3%**
- Hostile/spam complaints : **très bas** (< 0.1%)

→ Sur 10k emails : **≥ 250 replies, ≥ 50 positifs, ≥ 25 vraiment intéressés**

#### Signal 2 — Affiliate Activation
- **≥ 20 affiliés onboardés** (avec Stripe Connect KYC fait)
- **≥ 30% des affiliés** postent au moins une promo
- **≥ 10% des affiliés** génèrent au moins 1 signup

#### Signal 3 — Revenue Signal
- Affiliate-sourced users → activation produit **≥ 30%**
- Trial → paying conversion **≥ 5-10%**
- CAC payback projeté **< 3-4 mois**
- Month-1 churn **acceptable** (< 15%)

### Si les 3 signaux sont verts :
→ Scale à 30k/mois (Mois 3-4)
→ Puis 50k/mois (Mois 5-6)
→ Puis 150k/mois (Mois 7+)

### Si un signal est rouge :
→ **NE PAS scaler le volume.** Corrige d'abord :
- Signal 1 rouge → revoit l'offre, le copy, la liste, les mailboxes
- Signal 2 rouge → revoit l'onboarding, le promo kit, la fit influenceur
- Signal 3 rouge → revoit le produit, le pricing, l'activation flow

---

## Pricing & Commission Affiliés

### Pricing Ladder (révisé selon review)

| Plan | Prix | Cible | Features clés |
|---|---|---|---|
| **Starter** | $29/mois | Discovery / entry | Clips limités, watermark, 1 plateforme |
| **Creator** | $49/mois | Plan d'entrée réel | Core features, 3 plateformes, sans watermark |
| **Pro** ⭐ | $99/mois | **Plan à pousser** | Distribution auto, analytics, multi-accounts |
| **Studio/Agency** | $199-$299/mois | Agences / multi-brand | Team seats, white-label, priority render |

**Pourquoi $99 comme plan principal :**
- Ton produit combine clip discovery + enhance + render + distribution + analytics
- $29 attire le mauvais customer (creator qui churn)
- À ARPA $99, tu n'as besoin que de **505 clients pour $50k MRR** (vs 1,724 à $29)

### Annual Discount — Quand l'activer ?
**PAS avant** :
- $5-10k MRR
- 50+ clients payants
- 30-60 jours de retention/churn data
- Refund flows clean

**Discount** : 2 mois gratuits OU 15-20% off.

### Commission Affiliés

**Décision : 30% à vie, simple.**

| Plan | Prix | Commission affilié | Net (avant Stripe) |
|---|---|---|---|
| Starter $29 | $29 | $8.70 | $20.30 |
| Creator $49 | $49 | $14.70 | $34.30 |
| Pro $99 | $99 | $29.70 | $69.30 |
| Studio $199 | $199 | $59.70 | $139.30 |

**Pourquoi 30% à vie (vs tiered) :**
- Plus simple à vendre dans le cold email
- C'est notre **edge marketing** — ne dilue pas
- À ARPA $99, c'est largement soutenable
- Tu peux toujours grandfather plus tard si trop pince

**Garde-fous :**
- Net-30 hold (refund window)
- Threshold $50 minimum payout
- Manual review premier payout
- Clawback automatique sur refund/chargeback (via `affiliate_commission_ledger`)

---

## Anti-Fraude & Compliance

### Anti-Fraude Affiliés (Vague 2 — P0)

**Règles dans le code :**
- ❌ No self-referral (check email/IP/payment fingerprint match)
- 🕒 30-day payout hold (laisse refund window passer)
- 🔄 Clawback automatique sur refund/chargeback
- 🚩 `fraud_flags` table (track suspicious patterns)
- 🆔 Same IP/device cluster flagging
- 💳 Same payment card fingerprint flagging
- 👁️ Manual review premier payout (toujours)
- ⏸️ Minimum 2 paid billing cycles avant gros payout
- 📜 `affiliate_terms_accepted_at` requis avant payout

### Compliance Layer (Vague 1 — P0)

**Obligations légales (CASL + CAN-SPAM + GDPR + Loi 25 Québec) :**

1. **`suppression_list`** globale enforce AVANT chaque export campagne
2. **Unsubscribe link** dans chaque email (auto-injected)
3. **Honor instantané** des unsubs (< 10 jours requis par CAN-SPAM, on fait instant)
4. **Adresse business physique** dans chaque email
5. **Pas de subject deceptive** (review templates)
6. **Provenance trackée** : `influencers.source` enregistre d'où vient le lead
7. **Audit trail** : `admin_audit_log` track tout
8. **Export RGPD** : 1-click export user data
9. **Delete on request** : 30 jours max
10. **No deceptive headers/From** (review mailbox config)

### Webhook Idempotency (Vague 1 — P0)

**`webhook_events` table** : track `provider`, `event_id`, `payload_hash`, `processed_at`.
- Empêche double-comptage replies/opens/commissions/payouts
- Critical pour Stripe, Instantly, et tous les providers
- Insert FIRST, ignore si `(provider, event_id)` déjà existe

---

## Risques & Mitigations

### Risques Techniques

| Risque | Mitigation |
|---|---|
| Webhook reliability (Instantly down) | Polling backup toutes les 15 min + alerte si écart |
| Stripe Connect KYC complexity | Whitelist initial des pays supportés |
| Email deliverability spam triggers | Variabilité templates + A/B testing |
| RLS bugs pour multi-rôles | Tests RLS automatisés en CI |
| Cookie attribution Safari/iOS | Server-side fingerprint backup via `affiliate_clicks` |
| Double-comptage webhooks | `webhook_events` idempotency table |

### Risques Business

| Risque | Mitigation |
|---|---|
| Affiliate fraud | `fraud_flags`, clawback, 30-day hold, manual review premier payout |
| Compliance CASL/GDPR amendes | Audit trail, suppression list, instant unsub, source tracking |
| TAM exhaustion (brûler la liste) | Diversification niches + canaux organic |
| Sender domain reputation | Isolation domains par niche, monitoring continu |

### Risques Stratégiques

| Risque | Mitigation |
|---|---|
| Over-engineering avant validation | Framework 3 signaux : pas scaler tant que pas vert |
| Founder bottleneck | Délégation VAs dès Vague 2-3 avec scope clair (rôles) |
| 30% commission trop généreux | À $99 ARPA c'est soutenable ; monitor LTV/CAC mensuel |
| Demo Generator → mauvais demos | Quality gate manuel obligatoire D1 |

---

## Signaux de Pivot

**Tue ou pivote la stratégie cold email si APRÈS 20k emails propres :**
- Positive reply rate < 0.2%
- Affiliates actifs < 10%
- Conversion paid quasi nulle
- CAC payback > 6 mois
- Domain health se dégrade malgré low volume

→ Soit l'offre est mauvaise, soit la TAM est saturée, soit le canal ne marche pas. **Pivote vers content/SEO + ads + partnerships directs** au lieu d'amplifier le bruit.

---

## Conclusion & Next Steps

Ce plan v2.0 vise à construire **maintenant** la fondation qui rendra les ops simples pendant 12-24 mois. Pas un MVP duct-tapé. Pas du sur-engineering bête. Un système qui :
- Démarre solide à 10k/mois
- Scale à 50k/mois sans rewrite
- Tient jusqu'à 150k/mois avec 1-2 VAs

**Investissement** : ~576-720h de dev sur 12 semaines (8-10h/jour, 6 jours/semaine).

**ROI attendu** :
- Mois 3 : $10k MRR validé via signaux verts
- Mois 6 : $30k MRR avec 50k emails/mois
- Mois 12 : $50-80k MRR avec scale propre + organic en parallèle

**Prochaine étape immédiate** : Voir `ADMIN-NEXT-7-DAYS.md` pour le détail jour par jour de la Vague 1 Semaine 1.

---

*Document version 2.1 — Mai 2026*
*Auteur : Samy Cloutier + Claude*
*Status : Ready to build (Vague 1 commence lundi)*
*v2.1 fixes : permissions explicites (capability-based), ledger service-only, RPC pour VA updates, CITEXT email, unsubscribe signed token, IP hashed, product activation events, Vague 1 split en 2 semaines réalistes*
