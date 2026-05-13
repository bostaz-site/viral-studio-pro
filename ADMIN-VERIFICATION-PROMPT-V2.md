# 🔍 ADMIN VERIFICATION PROMPT V2 — Vague 1 Semaine 2

> Lance ce prompt dans une session Claude Code dédiée APRÈS avoir push toutes les features Vague 1 Semaine 2 (Attribution + Composer + Watchdog).
>
> Durée estimée : 30-45 min.

---

## 🚀 PROMPT À COPIER-COLLER

```
CONTEXTE
========
Tu es l'auditeur final de l'Admin Hub de Viral Animal.
Vague 1 Semaine 1 + Vague 1 Semaine 2 sont LIVE en production.
Stripe LIVE keys sont configurées dans Netlify env vars.
Webhook Stripe LIVE est créé (viral-animal-admin-webhook, ID we_1TWOFlCW4SxEupAC0UM7InyR).
Toutes les migrations Supabase sont apply.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: master (juste après push de Vague 1 Semaine 2)
Site live: https://viralanimal.com

DOCS DE RÉFÉRENCE
=================
1. ADMIN-MEGA-PLAN.md v2.1
2. ADMIN-DATABASE-SCHEMA.md v2.1
3. ADMIN-CLAUDE-CODE-PROMPTS-V2.md (Prompts H/I/J)
4. SYSTEM-REFERENCE-ADMIN-AFFILIATES.md (créé par Prompt H)
5. SYSTEM-REFERENCE-ADMIN-INBOX.md (mis à jour par Prompt I)
6. SYSTEM-REFERENCE-ADMIN-WATCHDOG.md (créé par Prompt J)

MISSION EN 8 PHASES
====================

PHASE 1 — VÉRIFICATION SCHEMA SUPABASE PROD
============================================
Run sur Supabase prod (via MCP):

A) Tables Vague 1 Semaine 1 + Semaine 2 :
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN (
       'admin_users', 'suppression_list', 'webhook_events',
       'campaign_recipients', 'email_events', 'affiliate_clicks',
       'affiliate_commission_ledger', 'fraud_flags', 'payout_holds',
       'ai_calls', 'import_batches', 'domains', 'mailbox_daily_stats',
       'lead_enrichment_snapshots', 'unsubscribe_tokens',
       'product_activation_events', 'agent_alerts'
     );
   → DOIT retourner 17 rows

B) Nouvelles RPC functions (Prompt H + J):
   SELECT proname FROM pg_proc WHERE proname IN (
     'generate_affiliate_code',
     'log_affiliate_click',
     'create_commission_entry',
     'create_clawback_entry',
     'dismiss_agent_alert'
   );
   → DOIT retourner 5 rows (ou plus si autres helpers créés)

C) Index critiques sur affiliate_commission_ledger :
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'affiliate_commission_ledger';
   → Au moins 3 indexes

PHASE 2 — VÉRIFICATION FICHIERS CRÉÉS
======================================
Vérifie que ces fichiers existent localement :

Attribution + Stripe (Prompt H):
- app/r/[code]/route.ts (public redirect)
- app/api/admin/webhooks/stripe/route.ts
- lib/admin/webhooks/stripe-processor.ts
- lib/admin/affiliate-code.ts
- lib/admin/affiliate-attribution.ts
- lib/admin/ip-hash.ts
- app/(dashboard)/admin/affiliates/page.tsx
- app/(dashboard)/admin/affiliates/[id]/page.tsx
- SYSTEM-REFERENCE-ADMIN-AFFILIATES.md

Reply Composer (Prompt I):
- app/(dashboard)/admin/inbox/_components/reply-composer.tsx
- app/(dashboard)/admin/inbox/_components/quick-reply-templates.tsx
- app/api/admin/inbox/reply/route.ts
- app/api/admin/inbox/mailboxes/route.ts
- lib/admin/email/ (folder avec Instantly send wrapper)

Watchdog (Prompt J):
- app/(dashboard)/admin/watchdog/page.tsx
- app/api/admin/watchdog/route.ts
- app/api/cron/watchdog/route.ts
- lib/admin/watchdog/ (folder avec checks, anomaly-detector, notifier)
- SYSTEM-REFERENCE-ADMIN-WATCHDOG.md

Si UN fichier manque → flag dans le rapport.

PHASE 3 — TYPECHECK + BUILD
============================
Run :
1. `npm run type-check` → 0 errors expected
2. `npm run lint` → 0 errors expected
3. `npm run build` → DOIT compiler

Si erreurs petites → fix automatiquement
Si erreurs grosses → report avec ligne exacte + suggestion

PHASE 4 — TESTS UNITAIRES ATTRIBUTION
======================================
Crée un script test temporaire (`tests/admin-verification-v2.test.ts`) qui:

A) Crée un influencer fictif "test-verification-h" avec status='onboarded'
B) Vérifie que un affiliate_code est généré automatiquement
C) Simule un click /r/<code> via fetch:
   - Verify affiliate_clicks row créée avec ip_hash (pas raw IP)
   - Verify cookie va_ref set dans response
D) Crée un user fictif test avec referred_by_influencer_id pointing au influencer
E) Insert manuellement un commission_ledger entry via la RPC `create_commission_entry`:
   - influencer_id = test-verification-h
   - amount_cents = 2970 (30% de $99)
   - event_type = 'payment_earned'
   - Verify la row existe
F) Insert clawback via `create_clawback_entry`:
   - amount_cents = -2970
   - event_type = 'refund_clawback'
   - Verify balance affilié = 0

Clean up après le test (DELETE le test influencer + entries).

PHASE 5 — TEST STRIPE WEBHOOK
==============================
Run un test du webhook handler :

A) Lis app/api/admin/webhooks/stripe/route.ts pour comprendre le format attendu
B) Crée un mock Stripe event JSON :
   ```json
   {
     "id": "evt_test_verification_xxx",
     "type": "invoice.payment_succeeded",
     "data": {...}
   }
   ```
C) POST manuel vers https://viralanimal.com/api/admin/webhooks/stripe avec signature mock
   (Le code va probablement reject car signature invalide — c'est NORMAL et c'est ce qu'on veut)
D) Verify webhook_events row insérée avec status='failed' (signature rejected = correct behavior)

OU mieux, utiliser Stripe CLI pour trigger un test event :
```bash
stripe trigger invoice.payment_succeeded
```
(Si stripe CLI pas installé, skip cette étape)

PHASE 6 — TEST WATCHDOG CRON
=============================
A) Hit manuellement le endpoint cron : POST /api/cron/watchdog avec CRON_SECRET header
B) Verify que les checks tournent (lis les logs)
C) Crée un faux problème pour tester un check :
   - Insert un fake bounce dans mailbox_daily_stats avec bounce_rate > 5%
   - Re-trigger le cron
   - Verify agent_alerts row créée avec severity='critical'
D) Test le dismiss via /api/admin/watchdog/dismiss/[id]

Clean up : DELETE le fake bounce + l'alert.

PHASE 7 — TEST INBOX REPLY COMPOSER
====================================
A) Lis app/api/admin/inbox/reply/route.ts pour le format
B) Vérifie que les Instantly send credentials sont disponibles (env var INSTANTLY_API_KEY)
C) Test si le code skip proprement si INSTANTLY_API_KEY missing
D) Verify que le composer UI charge sans erreur sur /dashboard/admin/inbox

PHASE 8 — GÉNÉRATION RAPPORT FINAL
====================================
Crée le fichier ADMIN-VERIFICATION-REPORT-V2.md avec cette structure :

# 🔍 Admin Hub V2 — Verification Report
Date : [aujourd'hui]
Status global : ✅ READY / ⚠️ ISSUES FOUND / 🔴 BLOCKED
Cumul Vague 1 (Semaine 1 + Semaine 2) : 100% complete / X% complete

## ✅ Ce qui marche parfaitement
- [Liste détaillée]

## ⚠️ Issues mineures (fixées auto)
- [Détail + fix]

## 🔴 Issues critiques (à fixer manuellement)
- [Détail + suggestion + estimation temps]

## 📊 Stats
- Tables DB : X / 17
- Fichiers créés : X / Y
- SYSTEM-REFERENCE docs : X / 9
- RPC functions : X / Y
- Tests passés : X / 10
- Build : ✅ / ❌

## 🎯 Pipeline end-to-end validée ?
- Cold email send (Instantly) → ✅/❌
- Webhook ingestion → ✅/❌
- CRM update on reply → ✅/❌
- Suppression on bounce → ✅/❌
- Affiliate code generation → ✅/❌
- /r/[code] redirect tracking → ✅/❌
- Stripe payment → commission ledger → ✅/❌
- Refund → clawback → ✅/❌
- Watchdog detection → alert → ✅/❌

## 🚀 Recommandations Vague 1 Semaine 3
- [À builder semaine prochaine]
- Mailbox health full monitoring
- Audit log UI polish
- Premier vrai send (100-500 leads test)

## ✅ Tu peux lancer cold email réel ?
- OUI / Pas encore — voici pourquoi : [...]

DEFINITION OF DONE
==================
- [ ] Toutes les 8 phases complétées
- [ ] ADMIN-VERIFICATION-REPORT-V2.md créé
- [ ] Tests cleanup faits (pas de données test laissées en DB)
- [ ] Issues mineures fixées automatiquement
- [ ] Issues critiques bien documentées

ANTI-PATTERNS
=============
❌ Ne pas dire "tout est OK" sans avoir vraiment vérifié
❌ Ne pas laisser de données test en DB (cleanup obligatoire)
❌ Ne pas modifier les SYSTEM-REFERENCE si juste cosmétique
❌ Ne pas push en prod si build échoue

OUTPUT FINAL
============
1. ADMIN-VERIFICATION-REPORT-V2.md (le rapport)
2. Liste claire des actions Samy doit faire avant de lancer cold email réel
3. Réponse : "Pipeline prête pour lancer 100 leads test ? OUI / NON parce que [...]"
```

---

## 📋 Comment l'utiliser

1. **Copie tout le bloc** entre les ``` ci-dessus
2. **Ouvre une nouvelle session Claude Code**
3. **Colle le prompt**
4. Laisse-le tourner 30-45 min
5. **Lis le rapport** `ADMIN-VERIFICATION-REPORT-V2.md` à la fin

---

*Document créé : 2026-05-13*
*Pré-requis : Vague 1 Semaine 1 + Semaine 2 mergées et déployées*
