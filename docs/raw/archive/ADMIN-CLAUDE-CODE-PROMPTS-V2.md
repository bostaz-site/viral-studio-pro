# 🚀 ADMIN HUB — Claude Code Prompts V2 (Vague 1 Semaine 2 + Vague 2 Watchdog)

> 3 prompts à lancer en parallèle dans Claude Code.
> Pré-requis : Vague 1 Semaine 1 mergée et déployée (admin_users, suppression_list, webhook_events, etc.).
>
> **Ordre de merge final** : H → I → J

---

## 🔴 PROMPT H — Attribution + Commission Ledger + Stripe Webhook

```
CONTEXTE
========
Tu travailles sur Viral Animal (https://viralanimal.com), une SaaS Next.js 14 + Supabase + Stripe.
La Vague 1 Semaine 1 de l'Admin Hub est LIVE (CRM, inbox, campaigns, compliance, Instantly sync).
Maintenant on attaque Vague 1 Semaine 2 : Attribution affiliée + Commission Ledger automatique.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/admin-attribution

DOCS À LIRE EN PREMIER
=======================
1. ADMIN-MEGA-PLAN.md — Module 3 (Affiliate Management)
2. ADMIN-DATABASE-SCHEMA.md — Tables affiliate_clicks, affiliate_commission_ledger, fraud_flags
3. ADMIN-NEXT-7-DAYS.md — Semaine 2 preview
4. SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md — pour unsubscribe-token pattern
5. SYSTEM-REFERENCE-BROWSE.md — format de documentation à suivre

TÂCHE
=====
1. Affiliate code generation auto sur status='onboarded'
2. /r/[code] public redirect avec affiliate_clicks logging + cookie + fingerprint
3. Signup attribution (cookie/fingerprint → profile.referred_by_influencer_id)
4. Stripe webhook handler avec idempotency
5. Commission ledger INSERT automatique sur payment_succeeded
6. Refund/chargeback clawback automatique
7. Page admin /dashboard/admin/affiliates avec dashboard simple

FICHIERS À CRÉER
================
- app/r/[code]/route.ts (public redirect)
- lib/admin/affiliate-code.ts (generation + uniqueness)
- lib/admin/affiliate-attribution.ts (cookie + fingerprint helpers)
- lib/admin/ip-hash.ts (sha256 avec AFFILIATE_IP_PEPPER)
- app/api/admin/webhooks/stripe/route.ts (avec webhook_events idempotency)
- lib/admin/webhooks/stripe-processor.ts (event handlers)
- app/(dashboard)/admin/affiliates/page.tsx (liste affiliés)
- app/(dashboard)/admin/affiliates/[id]/page.tsx (détail affilié)
- app/(dashboard)/admin/affiliates/_components/affiliate-table.tsx
- app/(dashboard)/admin/affiliates/_components/commission-ledger-view.tsx
- app/api/admin/affiliates/route.ts
- app/api/admin/affiliates/[id]/route.ts

ENV VARS À AJOUTER
==================
- AFFILIATE_IP_PEPPER (random 32-char string, pour hash IP)
- STRIPE_WEBHOOK_SECRET (déjà existant probablement)
- STRIPE_SECRET_KEY (déjà existant probablement)

FLOWS À IMPLÉMENTER

A. Attribution flow
-------------------
1. Influencer status → 'onboarded' déclenche generation auto d'un affiliate_code unique
2. Format : 'va-' + 6 chars alphanumeric, ou 'va-' + handle si dispo
3. Update influencer.affiliate_code

B. Click tracking
-----------------
1. URL publique : /r/[code]
2. Read cookie va_ref existing
3. INSERT affiliate_clicks avec :
   - ip_hash = sha256(ip + AFFILIATE_IP_PEPPER)
   - ip_country (via Netlify edge header ou geoip)
   - user_agent, fingerprint_hash, referrer_url
   - utm_source, utm_medium, utm_campaign (from query params)
4. Set cookie va_ref = code, maxAge 60 jours, sameSite lax, secure
5. Redirect vers landing (query param ?landing=... ou /)

C. Signup attribution
---------------------
Modifier le signup flow existant pour :
1. Read cookie va_ref OR check fingerprint_hash dans affiliate_clicks dernières 60 jours
2. Match avec influencers.affiliate_code
3. Set profile.referred_by_influencer_id

D. Stripe webhook handler
-------------------------
POST /api/admin/webhooks/stripe

Logic :
1. Verify Stripe signature with STRIPE_WEBHOOK_SECRET
2. INSERT INTO webhook_events (provider='stripe', event_id=event.id, etc.)
   avec ON CONFLICT DO NOTHING
3. Si insert réussit, process l'event :
   - customer.subscription.created → log activation event
   - invoice.payment_succeeded → INSERT commission_ledger (event_type='payment_earned', amount=30% du payment)
   - charge.refunded → INSERT commission_ledger (event_type='refund_clawback', amount=-30% du refund)
   - charge.dispute.created → INSERT fraud_flags + freeze commissions
4. Toujours mark webhook_events status='completed' ou 'failed'

E. Commission calculation
-------------------------
Pour chaque payment :
1. Find user_id from Stripe customer
2. Read profile.referred_by_influencer_id
3. Si NOT NULL :
   - amount_cents_commission = round(payment_amount_cents * 0.30)
   - INSERT INTO affiliate_commission_ledger via service_role
4. Si NULL : pas de commission

F. Refund clawback
------------------
Pour chaque refund :
1. Find original payment in ledger
2. Si payment a généré une commission → INSERT clawback row (negative amount)

DEFINITION OF DONE
==================
- [ ] Crée un influencer fictif avec status='onboarded' → affiliate_code généré auto
- [ ] Visite /r/<code> → cookie set, affiliate_clicks row inséré, redirect /
- [ ] Signup avec cookie → profile.referred_by_influencer_id = influencer_id
- [ ] Trigger Stripe test webhook payment_succeeded → commission_ledger row créée (30%)
- [ ] Trigger Stripe test webhook charge.refunded → clawback row (-30%)
- [ ] Webhook dupliqué → 2e ignoré (webhook_events idempotency)
- [ ] Page /dashboard/admin/affiliates liste les affiliés avec balance
- [ ] SYSTEM-REFERENCE-ADMIN-AFFILIATES.md créé suivant format BROWSE.md

ANTI-PATTERNS
=============
❌ Ne JAMAIS INSERT commission_ledger depuis le client — service_role uniquement
❌ Ne pas stocker l'IP raw dans affiliate_clicks — hash avec pepper
❌ Ne pas oublier ON CONFLICT (provider, event_id) DO NOTHING dans webhook_events
❌ Ne pas calculer la commission côté client — toujours côté webhook
❌ Ne pas auto-payout sans review premier payout

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-AFFILIATES.md avec :
- Tous les fichiers créés
- Flow attribution complet (cookie + fingerprint backup)
- Format de la commission ledger
- Cas d'usage : payment, refund, chargeback
- Tests recommandés
```

---

## 🟣 PROMPT I — Reply Composer + Resend Integration

```
CONTEXTE
========
Vague 1 Semaine 1 inbox est en read-only. On ajoute le composer pour envoyer les réponses.
Branch: feature/admin-reply-composer

DOCS À LIRE
===========
1. SYSTEM-REFERENCE-ADMIN-INBOX.md
2. ADMIN-MEGA-PLAN.md — Module 1.1 (Inbox)
3. ADMIN-DATABASE-SCHEMA.md — Table email_messages

TÂCHE
=====
1. Composer dans inbox detail (textarea + send button)
2. Envoi via Resend (transactional) OU Instantly API (selon ce qui marche mieux)
3. Tracking dans email_messages avec direction='outbound'
4. Template variables ({{first_name}}, {{handle}}, etc.)
5. Suggested templates rapides (1-click reply)

FICHIERS À CRÉER
================
- app/(dashboard)/admin/inbox/_components/reply-composer.tsx
- app/(dashboard)/admin/inbox/_components/quick-reply-templates.tsx
- app/api/admin/inbox/reply/route.ts
- lib/admin/email/resend-client.ts (OR lib/admin/email/instantly-send.ts)
- lib/admin/email/template-vars.ts (variable interpolation)

ENV VARS
========
- RESEND_API_KEY (si on utilise Resend, $20/mo pour 50k emails)
OU
- INSTANTLY_API_KEY (déjà set, on utilise leur API send)

DÉCIDE : Resend ou Instantly Send ?
- Resend = plus propre pour transactional, dev-friendly
- Instantly = on utilise déjà leur infra, pas besoin de nouvelle clé

Je recommande Instantly d'abord (zéro nouvelle dépendance), Resend si besoin plus tard.

FEATURES COMPOSER
=================
- Textarea avec markdown support (use @uiw/react-md-editor ou textarea simple)
- Template variables auto-substituées avec influencer data
- "Send" button → POST /api/admin/inbox/reply
- Loading state pendant l'envoi
- Success toast → thread updated avec nouveau message
- Error handling (mailbox down, etc.)

QUICK REPLY TEMPLATES (preset)
===============================
- "Quick yes" : "Awesome, here's the link to get started: {{signup_link}}. Let me know if you have questions!"
- "Schedule a call" : "Sounds good! Can you grab a slot here: {{calendly}}"
- "Soft pitch" : "No worries, no pressure. If you change your mind, here's our link: {{link}}"
- "Decline politely" : "All good, thanks for the response! Wishing you the best."

Tous éditables via /dashboard/admin/templates (Vague 2 future)

API ROUTE
=========
POST /api/admin/inbox/reply
Body: { influencer_id, in_reply_to_message_id, subject, body, mailbox_id }

Logic:
1. Auth check (requireAdminRole('view_inbox'))
2. Apply template variables (substitute {{first_name}}, etc.)
3. Send via Instantly API (or Resend)
4. INSERT INTO email_messages (direction='outbound', sent_at=now)
5. Return success + message_id

DEFINITION OF DONE
==================
- [ ] Je peux compose une réponse dans un thread inbox
- [ ] Click "Send" → email envoyé via Instantly
- [ ] Le thread se met à jour avec le nouveau message
- [ ] Template variables sont substituées correctement
- [ ] Quick templates fonctionnent (1-click)
- [ ] Tracking dans email_messages (direction='outbound')
- [ ] Update SYSTEM-REFERENCE-ADMIN-INBOX.md avec section "Reply Composer"

ANTI-PATTERNS
=============
❌ Ne pas envoyer sans confirmer la mailbox source
❌ Ne pas oublier d'INSERT le message envoyé dans email_messages
❌ Ne pas appliquer les template vars côté client (server-side seulement, sinon ils sont visibles dans le HTML)
❌ Ne pas exposer la clé Instantly côté client

OUTPUT
======
Section "Reply Composer" dans SYSTEM-REFERENCE-ADMIN-INBOX.md.
```

---

## 🤖 PROMPT J — Watchdog Agent (Health Monitor 24/7)

```
CONTEXTE
========
Samy veut un agent qui tourne en boucle 24/7 sur l'admin pour s'assurer que tout est healthy
et l'alerter de tout problème : webhook down, mailbox bounce spike, KYC pending, etc.
Branch: feature/admin-watchdog

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md — Watchdog Agent concept (Module 11)
2. ADMIN-DATABASE-SCHEMA.md — Tables ai_calls, mailbox_daily_stats, webhook_events
3. SYSTEM-REFERENCE-ADMIN-CAMPAIGNS.md — Instantly Sync pattern (similar cron logic)

TÂCHE
=====
1. Cron toutes les 15 min qui check des métriques de santé
2. Détection d'anomalies avec Claude Haiku
3. Création d'alertes dans table agent_alerts
4. UI dashboard pour voir/dismiss les alertes
5. Webhook Resend ou simple email pour alertes critiques

FICHIERS À CRÉER
================
- supabase/migrations/20260513_agent_alerts.sql (nouvelle table)
- supabase/migrations/20260513_watchdog_health_checks.sql (config table)
- lib/admin/watchdog/checks.ts (les fonctions de check)
- lib/admin/watchdog/anomaly-detector.ts (Claude Haiku)
- lib/admin/watchdog/notifier.ts (email + push)
- app/api/cron/watchdog/route.ts (cron endpoint Netlify)
- app/(dashboard)/admin/watchdog/page.tsx (alerts dashboard)
- app/(dashboard)/admin/watchdog/_components/alerts-table.tsx
- app/(dashboard)/admin/watchdog/_components/health-overview.tsx
- app/api/admin/watchdog/dismiss/[id]/route.ts

TABLE agent_alerts
==================
CREATE TABLE public.agent_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'important', 'info')),
  category TEXT NOT NULL,  -- 'webhook', 'mailbox', 'affiliate', 'stripe', 'app', 'compliance'
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  notified BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_alerts_active ON agent_alerts(severity, detected_at DESC)
  WHERE dismissed_at IS NULL AND resolved_at IS NULL;

CHECKS À IMPLÉMENTER

CRITICAL (alerte immédiate par email)
======================================
1. Webhook Instantly down > 30 min
   - Last webhook received > 30 min ago alors qu'on est en business hours
   - Action : email + tag critical

2. Stripe webhook fail
   - webhook_events provider='stripe' status='failed' dans dernières 60 min
   - Action : email + tag critical

3. Mailbox bounce rate > 5%
   - mailbox_daily_stats : bounces / sent > 0.05 sur 24h
   - Action : email + tag critical

4. App down (Sentry error spike)
   - Optionnel si Sentry est connecté
   - Skip si pas Sentry, on fera plus tard

5. Compte Stripe Connect rejeté
   - affiliate_referrals avec stripe_connect_status='rejected'
   - Action : email + tag critical

IMPORTANT (alerte daily digest)
================================
1. Hot lead pas répondu > 4h
   - influencers.status IN ('interested', 'replied') ET last_reply_at < now - 4h
   - Action : add to daily digest

2. Affilié onboardé sans activation
   - influencers.status='onboarded' ET pas de affiliate_clicks dernière 5 jours
   - Action : add to daily digest

3. Domain approche limite quotidienne
   - mailbox_daily_stats.emails_sent > 0.9 * daily_send_limit
   - Action : add to daily digest

4. Reply rate chute > 50%
   - Comparison cette semaine vs précédente
   - Action : add to daily digest

5. KYC pending > 7 jours
   - affiliates avec stripe_connect_status='pending_kyc' > 7 jours
   - Action : add to daily digest

INSIGHTS (rapport hebdo)
========================
- Niche performant cette semaine
- Subject line top performer
- Affiliés top 5 en croissance
- Affiliés dormants à re-engager

CRON CONFIG
===========
netlify.toml ajout :
[[scheduled.functions]]
  path = "/api/cron/watchdog"
  schedule = "*/15 * * * *"  # toutes les 15 min

CLAUDE HAIKU USAGE
==================
Pour les anomalies "complexes" (pattern detection) :
- Compare metrics this week vs last week
- Use Claude Haiku to generate insight summary
- Coût estimé : <$5/mois total

Exemple prompt Haiku :
"Voici les stats de cette semaine vs précédente : {...}.
Y a-t-il une anomalie notable ? Si oui, quelle action recommander ?
Réponds en JSON : { hasAnomaly: bool, severity: 'critical'|'important'|'info', title: string, description: string }"

PAGE /dashboard/admin/watchdog
==============================
- Header : "Watchdog Status" + nombre d'alertes actives
- Tabs : Critical / Important / Info / Dismissed
- Each alert : severity badge, title, description, detected_at, dismiss button
- Sidebar : Health overview cards (Webhooks 🟢, Mailboxes 🟢, Affiliates 🟡)
- Real-time refresh via Supabase Realtime

NOTIFIER
========
Pour les CRITICAL :
- Email à samycloutier30@gmail.com via Resend (ou Instantly transactional)
- Subject : "🚨 [Watchdog] {title}"
- Body : description + link vers /dashboard/admin/watchdog

DEFINITION OF DONE
==================
- [ ] Cron tourne toutes les 15 min
- [ ] Migration agent_alerts apply en prod
- [ ] Les 5 checks CRITICAL sont fonctionnels
- [ ] Les 5 checks IMPORTANT sont fonctionnels
- [ ] Email d'alerte arrive si critical détecté
- [ ] Page /dashboard/admin/watchdog charge avec liste des alertes
- [ ] Dismiss button fonctionne
- [ ] SYSTEM-REFERENCE-ADMIN-WATCHDOG.md créé

ANTI-PATTERNS
=============
❌ Ne pas envoyer 100 emails si tout pète d'un coup (rate limit alertes)
❌ Ne pas créer 50 alertes identiques (dedupe par titre dans dernières 24h)
❌ Ne pas dépendre de Claude pour les checks critical (rule-based d'abord, Claude pour insights)
❌ Ne pas oublier de mark notified=true après l'email

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-WATCHDOG.md avec :
- Architecture complète
- Liste des checks
- Cron schedule
- Configuration Claude Haiku
- Notification flow
```

---

## 📋 Ordre d'exécution

### Étape 1 — Toi (en parallèle pendant Claude Code) :
- ⏰ **5 min** : Configure webhook Instantly → URL `https://viralanimal.com/api/admin/webhooks/instantly`
- ⏰ **15 min** : Update Stripe Dashboard avec Corporation + NEQ 1182138983

### Étape 2 — Claude Code (en parallèle, 2-3h) :
- 🔴 **Prompt H** — Attribution + Commission Ledger (le plus gros)
- 🟣 **Prompt I** — Reply Composer
- 🤖 **Prompt J** — Watchdog Agent

### Étape 3 — Merge order :
1. H (Attribution — base pour les autres)
2. I (Reply Composer — autonome)
3. J (Watchdog — peut être mergé last)

### Étape 4 — Test end-to-end (30 min) :
- Crée un influencer fictif → onboard → code généré
- Visite /r/<code> → click logged
- Signup test → attribution OK
- Stripe test payment → commission ledger row
- Reply test depuis admin inbox
- Force watchdog cron → check alertes

---

*Prompts créés : 2026-05-13*
*Pré-requis : Vague 1 Semaine 1 LIVE en prod*
*Output attendu : Vague 1 Semaine 2 complète + Watchdog Vague 2 partiel*
