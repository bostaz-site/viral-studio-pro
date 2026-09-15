# 🚀 ADMIN HUB — Claude Code Prompts V3 (Phase 2 + 3 + 4)

> 3 prompts à lancer en parallèle dans Claude Code.
> Pré-requis : Vague 1 Semaine 1 + Semaine 2 mergées et déployées (Verification Report v2 = OUI).
>
> **Ordre de merge final** : K → L → M
>
> Chaque prompt est self-contained.

---

## 🟢 PROMPT K — Mailbox Health Monitoring (Phase 2)

```
CONTEXTE
========
Tu travailles sur l'Admin Hub de Viral Animal (https://viralanimal.com).
Vague 1 Semaine 1+2 sont LIVE. Maintenant on finit Vague 1 Semaine 3 :
Mailbox Health Monitoring complet — surveiller deliverability + reputation + bounce rates.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/admin-mailbox-health

DOCS À LIRE EN PREMIER
=======================
1. ADMIN-MEGA-PLAN.md v2.1 — Module 1.4 (Mailbox Health)
2. ADMIN-DATABASE-SCHEMA.md — Tables mailboxes, mailbox_daily_stats, domains
3. SYSTEM-REFERENCE-ADMIN-CAMPAIGNS.md — section Instantly Sync existante
4. SYSTEM-REFERENCE-ADMIN-WATCHDOG.md — pour pattern checks

TÂCHE
=====
Build le système de monitoring mailbox health complet :
1. Page /dashboard/admin/mailboxes avec dashboard détaillé
2. Graphiques tendances (reputation, bounce rate, sent volume) via Recharts
3. Alertes auto-créées dans agent_alerts si problèmes
4. Vue domains (SPF/DKIM/DMARC status)
5. Force re-sync individuel par mailbox
6. Pause/resume mailbox via Instantly API
7. Historical data via mailbox_daily_stats

FICHIERS À CRÉER
================
- app/(dashboard)/admin/mailboxes/page.tsx (liste)
- app/(dashboard)/admin/mailboxes/[id]/page.tsx (détail)
- app/(dashboard)/admin/mailboxes/_components/mailbox-table.tsx
- app/(dashboard)/admin/mailboxes/_components/health-chart.tsx (Recharts)
- app/(dashboard)/admin/mailboxes/_components/reputation-gauge.tsx
- app/(dashboard)/admin/mailboxes/_components/mailbox-actions.tsx (pause/resume)
- app/(dashboard)/admin/domains/page.tsx
- app/(dashboard)/admin/domains/_components/domain-status-card.tsx
- app/api/admin/mailboxes/route.ts
- app/api/admin/mailboxes/[id]/route.ts
- app/api/admin/mailboxes/[id]/sync/route.ts
- app/api/admin/mailboxes/[id]/pause/route.ts
- app/api/admin/mailboxes/[id]/resume/route.ts
- lib/admin/mailbox/health-checker.ts
- lib/admin/mailbox/instantly-actions.ts (pause/resume API)
- SYSTEM-REFERENCE-ADMIN-MAILBOX-HEALTH.md

FEATURES PAGE LISTE
====================
- Table de toutes les mailboxes avec :
  - Email address
  - Provider (Instantly/Resend/etc.)
  - Status (active/warming/paused/blocked) avec badge couleur
  - Reputation score (0-100) avec gauge visuelle
  - Today : X/30 emails sent (progress bar)
  - 7-day bounce rate %
  - 7-day reply rate %
  - Last sync (X min ago)
- Filter par status, provider, domain
- Sort par chaque colonne
- Quick actions par row : Pause, Resume, Force sync, View details

FEATURES PAGE DÉTAIL MAILBOX
=============================
- Header : email + status + reputation score + last sync
- Tabs:
  - **Overview** : KPIs (sent, opened, replied, bounced) + last 30 jours
  - **Health** : graphiques line chart reputation score + bounce rate sur 30 jours
  - **Daily Stats** : table mailbox_daily_stats sortable
  - **Domain** : SPF/DKIM/DMARC status + warmup status
  - **Actions** : pause/resume, force sync, send test email
- Sidebar : alertes actives liées à ce mailbox

WATCHDOG INTEGRATION
====================
Ajoute des checks au watchdog (lib/admin/watchdog/checks.ts existant) :
1. Reputation score < 70 → alert 'important'
2. Reputation score < 50 → alert 'critical'
3. 7-day bounce rate > 5% → alert 'critical'
4. 7-day bounce rate > 3% → alert 'important'
5. Mailbox sent_count > 0.9 × daily_limit → alert 'important' (proche limite)
6. Mailbox no sync depuis > 6h → alert 'critical' (sync failed)
7. Reputation drop > 15 points en 24h → alert 'critical'

INSTANTLY ACTIONS API
======================
Wrapper pour les actions Instantly :
- pauseEmailAccount(id) → POST /accounts/{id}/pause
- resumeEmailAccount(id) → POST /accounts/{id}/resume
- getAccountWarmupStatus(id) → GET /accounts/{id}/warmup

DOMAINS PAGE
============
Vue simple de tous les domains :
- Domain name + registrar + expires_at
- SPF/DKIM/DMARC checks (status badges)
- Warmup status si applicable
- Mailboxes liées au domain
- Last check timestamp
- Action : Re-check now

DEFINITION OF DONE
==================
- [ ] Page /dashboard/admin/mailboxes liste tous les mailboxes Instantly
- [ ] Click une mailbox → page détail avec graphiques Recharts
- [ ] Pause/Resume action fonctionne via Instantly API
- [ ] Force sync individuel marche
- [ ] Watchdog crée des alerts sur les 7 conditions
- [ ] Domain status page créée
- [ ] SYSTEM-REFERENCE-ADMIN-MAILBOX-HEALTH.md créé
- [ ] Sidebar admin updated avec lien Mailboxes + Domains

ANTI-PATTERNS
=============
❌ Ne pas spammer l'API Instantly (cache les responses 5 min minimum)
❌ Ne pas créer 50 alertes identiques (dedupe par mailbox_id + check type dans dernières 24h)
❌ Ne pas exposer credentials côté client
❌ Ne pas oublier d'updater le sidebar (app/(dashboard)/layout.tsx)

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-MAILBOX-HEALTH.md suivant format SYSTEM-REFERENCE-BROWSE.md.
```

---

## 🟣 PROMPT L — AI Triage Layer (Phase 3)

```
CONTEXTE
========
Vague 2 démarre. Build l'AI Triage Layer : Claude Haiku classifie automatiquement
les replies cold email pour faire gagner du temps à Samy.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/admin-ai-triage

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md v2.1 — Module 5 (AI Automation Layer)
2. ADMIN-DATABASE-SCHEMA.md — Tables ai_calls, email_messages, influencers
3. SYSTEM-REFERENCE-ADMIN-INBOX.md — pour intégrer dans l'inbox existant
4. SYSTEM-REFERENCE-AI.md — pour pattern Claude API existant

TÂCHE
=====
1. Auto-classification des replies (positive/neutral/negative/spam/hostile)
2. Lead scoring engine (0-100) basé sur règles + Claude reasoning
3. Suggested reply drafts (3 variantes par reply)
4. Thread summary pour conversations longues (> 5 messages)
5. Hot lead priority queue
6. Tracking via ai_calls table existante

FICHIERS À CRÉER
================
- lib/admin/ai/reply-classifier.ts (Claude Haiku)
- lib/admin/ai/lead-scorer.ts (rule-based + Haiku reasoning)
- lib/admin/ai/reply-drafter.ts (3 variantes)
- lib/admin/ai/thread-summarizer.ts
- lib/admin/ai/prompts.ts (tous les prompts Claude centralisés)
- lib/admin/ai/log-call.ts (insert dans ai_calls)
- app/api/admin/inbox/[messageId]/classify/route.ts
- app/api/admin/inbox/[messageId]/drafts/route.ts
- app/api/admin/inbox/[messageId]/summarize/route.ts
- app/api/admin/influencers/[id]/score/route.ts
- app/api/cron/ai-triage/route.ts (process new replies en batch)
- app/(dashboard)/admin/inbox/_components/sentiment-badge.tsx
- app/(dashboard)/admin/inbox/_components/suggested-drafts.tsx
- app/(dashboard)/admin/inbox/_components/lead-score-card.tsx
- app/(dashboard)/admin/inbox/_components/thread-summary.tsx

UPDATES AUX FICHIERS EXISTANTS
================================
- app/(dashboard)/admin/inbox/_components/thread-list.tsx
  → Ajouter badge sentiment + lead score sur chaque thread item
- app/(dashboard)/admin/inbox/_components/thread-detail.tsx
  → Intégrer SuggestedDrafts + ThreadSummary + LeadScoreCard
- app/(dashboard)/admin/inbox/page.tsx
  → Ajouter filter "Hot leads only" (score > 70 + sentiment positive)

CLASSIFICATION REPLY
=====================
Prompt Claude Haiku :
```
Analyze this email reply and classify sentiment. Influencer was offered:
"Free Viral Animal access + 30% recurring affiliate commission for users they refer".

Reply: "{{body}}"

Return JSON:
{
  "sentiment": "positive" | "neutral_question" | "negative" | "spam" | "hostile",
  "confidence": 0.0-1.0,
  "key_phrases": ["..."],
  "suggested_action": "send_drafts" | "manual_response" | "archive" | "block"
}
```

LEAD SCORING
============
Score 0-100 calculé via :
- 25% niche_fit (gaming=100, business=60, fitness=40, etc. — mapping configurable)
- 20% audience_size_normalized (log scale, 1k=20, 10k=50, 100k=80, 1M=100)
- 15% engagement_rate (si dispo via lead_enrichment_snapshots)
- 15% sponsorship_likelihood (Claude reasoning : a-t-il déjà accepté des sponsos ?)
- 15% reply_sentiment_history (moyenne des classifications passées)
- 10% geo_lang_fit (English+US/CA/UK=100, French+QC=90, autres=50)

Computed à :
- Création influencer (basic via rules)
- Reply reçu (recalcul avec Haiku reasoning)
- Demande manuelle via "Re-score" button

REPLY DRAFTS
============
Pour chaque reply positive ou neutral_question, génère 3 variantes :
1. **Quick yes** (court, redirige vers la démo/onboarding)
2. **Long-form** (adresse les questions précises)
3. **Soft pitch** (si lead tiède, low-pressure)

UI dans inbox : 3 boutons "Use this draft" → fill composer + edit before send

HOT LEAD QUEUE
==============
Page /dashboard/admin/hot-leads OU section dans /dashboard/admin/inbox
- Filter automatique : lead_score > 70 + last_reply_at < 24h
- Sort by score DESC then recency
- Action one-click : "Reply now" → ouvre composer avec best draft pré-rempli

THREAD SUMMARIZER
=================
Pour conversations > 5 messages, génère summary avec Haiku :
- Key points discutés
- Status actuel (engaged/hesitant/declined)
- Next best action

Affiché en haut du thread detail.

CRON AI TRIAGE
==============
netlify.toml :
[[scheduled.functions]]
  path = "/api/cron/ai-triage"
  schedule = "*/10 * * * *"  # toutes les 10 min

Process :
1. Find new replies non-classifiées (last 24h, processing_status NULL)
2. Batch classify via Claude Haiku (max 50 par run)
3. Update email_messages.metadata avec sentiment + score
4. Generate drafts pour positives/neutral_questions
5. Update influencer.lead_score si needed
6. Log dans ai_calls

COÛT CLAUDE ESTIMÉ
==================
À 300 replies/mois (3% reply rate sur 10k emails) :
- Classification : ~$2/mois
- Drafts : ~$10/mois
- Scoring : ~$5/mois
- Summary : ~$3/mois
TOTAL : ~$20/mois — négligeable

DEFINITION OF DONE
==================
- [ ] Chaque nouveau reply est auto-classifié (sentiment badge visible)
- [ ] Lead score calculé et affiché sur chaque influencer
- [ ] 3 suggested drafts visibles dans le composer
- [ ] Hot leads queue / filter fonctionnel
- [ ] Thread summary affiché si > 5 messages
- [ ] Cron tourne toutes les 10 min sans erreur
- [ ] ai_calls table populée avec cost tracking
- [ ] SYSTEM-REFERENCE-ADMIN-AI-TRIAGE.md créé

ANTI-PATTERNS
=============
❌ Ne JAMAIS auto-send les drafts (toujours human-in-the-loop)
❌ Ne pas re-classifier le même reply 2x (idempotency par message_id)
❌ Ne pas appeler Claude pour chaque reply en realtime (use cron + cache)
❌ Ne pas faire crash le cron si Claude API timeout (try/catch + retry)
❌ Ne pas oublier de logger dans ai_calls (track les coûts)

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-AI-TRIAGE.md suivant format SYSTEM-REFERENCE-BROWSE.md.
```

---

## 🔵 PROMPT M — Affiliate Dashboard côté affilié (Phase 4)

```
CONTEXTE
========
Les affiliés (influenceurs onboardés) doivent pouvoir se connecter et voir leurs gains.
Build le portail affilié avec magic link auth.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/affiliate-portal

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md v2.1 — Module 3.5 (Affiliate Dashboard)
2. ADMIN-DATABASE-SCHEMA.md — Tables affiliate_clicks, affiliate_commission_ledger, influencers
3. SYSTEM-REFERENCE-ADMIN-AFFILIATES.md — pour comprendre ledger pattern

TÂCHE
=====
1. Portail séparé /partner/* avec magic link auth (pas Supabase auth standard)
2. Dashboard avec stats live : clicks, signups, paying users, earnings
3. Code/lien affilié + copy button + QR code
4. Historique des commissions avec breakdown
5. Promo kit téléchargeable (templates, brand assets)
6. Settings : update info bancaire (à venir avec Stripe Connect)

ARCHITECTURE
============
Le portail vit à /partner/* (pas /dashboard/admin/).
Auth séparée : magic link envoyé à influencer.email → token unique → session 30 jours.
Pas de Supabase Auth standard parce qu'on ne veut pas créer des users dans auth.users pour chaque affilié.

FICHIERS À CRÉER
================

Auth + Layout :
- app/partner/layout.tsx (with influencer context)
- app/partner/login/page.tsx (form pour magic link request)
- app/partner/login/verify/page.tsx (verify token + redirect)
- app/api/partner/auth/request/route.ts (envoyer magic link)
- app/api/partner/auth/verify/route.ts (verify token + set cookie)
- app/api/partner/auth/logout/route.ts
- lib/partner/auth.ts (cookie helpers)
- lib/partner/magic-link.ts (génération token signé)

Dashboard :
- app/partner/page.tsx (dashboard principal)
- app/partner/_components/stats-cards.tsx (clicks/signups/paying/earnings)
- app/partner/_components/earnings-chart.tsx (Recharts line)
- app/partner/_components/code-card.tsx (affiliate code + copy + QR)
- app/partner/_components/recent-referrals.tsx (anonymized)
- app/partner/_components/payout-schedule.tsx
- app/api/partner/stats/route.ts
- app/api/partner/ledger/route.ts

Promo Kit :
- app/partner/promo-kit/page.tsx
- public/promo-kit/ (assets — logos, banners, email templates)

Migration nouvelle table :
- supabase/migrations/20260514_partner_sessions.sql

TABLE partner_sessions
======================
CREATE TABLE public.partner_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,  -- sha256 du session token
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  ip_address_hash TEXT,
  user_agent TEXT
);

CREATE INDEX idx_partner_sessions_active
  ON partner_sessions(token_hash) WHERE expires_at > now();
CREATE INDEX idx_partner_sessions_influencer
  ON partner_sessions(influencer_id, expires_at DESC);

MAGIC LINK FLOW
================
1. Influencer entre son email sur /partner/login
2. POST /api/partner/auth/request :
   - Find influencer WHERE email = ? AND status IN ('onboarded', 'active', 'paying')
   - Si trouvé : generate magic_link_token (32 bytes random)
   - INSERT INTO unsubscribe_tokens (réutilise table existante) ou créer un autre similaire
   - Send email avec link /partner/login/verify?t={{token}}
   - Return success message (don't reveal si email existe pour éviter enumeration)
3. Influencer click email link
4. GET /partner/login/verify?t={{token}} :
   - Lookup token, verify pas expiré
   - Create partner_session row + set cookie va_partner_session = session_token
   - Redirect /partner
5. Session valide 30 jours

UI DASHBOARD (/partner)
========================
Header : "Hi {{first_name}} 👋"

4 cards stats (avec sparklines mini) :
- 🔗 Total Clicks : X (this month: Y, +Z% vs last)
- 📝 Signups : X
- 💰 Paying Customers : X
- 💵 Total Earned : $X (this month: $Y)

Section : Your affiliate link
- Code : VA-ABC123
- Link : https://viralanimal.com/r/abc123 (copy button)
- QR code (pour TikTok bio link, etc.)

Section : Earnings chart (last 90 days)
- Line chart : earnings cumulés
- Toggle : daily / weekly / monthly

Section : Recent referrals (anonymized)
- User #1234 — paying since Mar 12 — $99/mo
- User #5678 — trial since Mar 18
- ...

Section : Next payout
- Status : Pending review / Approved / Sent
- Amount : $XXX.XX
- Date : 1er du mois prochain
- Threshold : "$50 minimum atteint ✓"

API ROUTES (toutes protected via auth)
======================================
- GET /api/partner/stats → returns: { clicks, signups, paying, total_earned, this_month_earned }
- GET /api/partner/ledger → returns: [{ event_type, amount, occurred_at, user_anonymized }]
- GET /api/partner/referrals → anonymized list of referred users
- GET /api/partner/payouts → past + scheduled payouts

PROMO KIT PAGE
==============
- Brand assets (logos viral animal, palettes couleurs)
- Email templates (3-4 templates pour inviter audience)
- Tweet/X post templates
- TikTok/IG caption templates
- Banner images pour stream (Twitch overlays)
- Best practices guide ("How to maximize your earnings")

Tous downloadable en ZIP via /partner/promo-kit/download

DEFINITION OF DONE
==================
- [ ] Magic link envoyé fonctionne (via Resend ou Instantly)
- [ ] /partner/login + verify flow complet
- [ ] Session cookie 30 jours
- [ ] Dashboard charge avec stats live
- [ ] Affiliate code + link + QR code affichés
- [ ] Earnings chart fonctionnel
- [ ] Recent referrals anonymisés
- [ ] Promo kit downloadable
- [ ] RLS : un affilié ne peut voir QUE ses propres stats
- [ ] SYSTEM-REFERENCE-PARTNER-PORTAL.md créé

ANTI-PATTERNS
=============
❌ Ne PAS exposer real user emails dans referrals (anonymize: "User #1234")
❌ Ne pas utiliser Supabase Auth standard (créerait des users.auth rows non désirés)
❌ Ne pas oublier RLS sur partner_sessions
❌ Ne pas envoyer le token magic link via SMS/notification — email only
❌ Ne pas faire de leak d'info "email exists/doesn't exist" sur login

OUTPUT
======
SYSTEM-REFERENCE-PARTNER-PORTAL.md suivant format SYSTEM-REFERENCE-BROWSE.md.
```

---

## 📋 Ordre d'exécution

### Phase 1 — Parallèle (lance les 3 sessions Claude Code en même temps)
- 🟢 **Prompt K** — Mailbox Health (Vague 1 Semaine 3 — finit Vague 1)
- 🟣 **Prompt L** — AI Triage Layer (Vague 2 démarre)
- 🔵 **Prompt M** — Affiliate Dashboard côté affilié (Vague 2 partie 2)

### Phase 2 — Merge order
1. **K** (Mailbox Health — affecte le watchdog mais autonome)
2. **L** (AI Triage — modifie inbox UI mais pas de conflit avec K)
3. **M** (Affiliate Portal — nouveau routing /partner/*, zéro conflit)

### Phase 3 — Test end-to-end après merge
- Mailbox Health : vérifier graphiques + Watchdog crée alerts
- AI Triage : envoyer un reply test → vérifier classification + drafts générés
- Affiliate Portal : créer un influencer test "onboarded" + login magic link

---

*Document créé : 2026-05-13*
*Pré-requis : Vague 1 Semaine 1 + 2 LIVE en prod*
*Output attendu : Vague 1 Semaine 3 complete + Vague 2 Semaines 4 + 5 partiellement done*
