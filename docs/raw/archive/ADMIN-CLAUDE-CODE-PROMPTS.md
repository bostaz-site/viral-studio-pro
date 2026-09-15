# 🚀 ADMIN HUB — Claude Code Prompts (Blitz Mode)

> 7 prompts prêts à copy-paste dans des sessions Claude Code parallèles.
>
> **Plan d'exécution** :
> 1. **Prompt #1** (SOLO, séquentiel) — Schema migrations
> 2. **Prompt #2** (SOLO, après #1) — Admin shell + auth
> 3. **Prompts A à F** (6 sessions PARALLÈLES après #2) — Features indépendantes
>
> **Ordre de merge final** : B → C → A → D → E → F
>
> Chaque prompt est self-contained.

---

## ⚡ PROMPT #1 — Schema Migrations (SÉQUENTIEL, EN PREMIER)

```
CONTEXTE
========
Tu travailles sur Viral Animal (https://viralanimal.com), une SaaS Next.js 14 + Supabase + Stripe.
On commence le build de l'Admin Hub. Avant tout, il faut créer toutes les tables Supabase.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/admin-schema

DOCS À LIRE EN PREMIER (mandatoire)
====================================
1. ADMIN-MEGA-PLAN.md — Vision globale
2. ADMIN-DATABASE-SCHEMA.md — SQL complet (sections v1, v2.0, v2.1)
3. ADMIN-NEXT-7-DAYS.md — Détail Jour 1

TÂCHE
=====
Créer toutes les migrations Supabase pour l'admin hub (v2.0 + v2.1).

Migrations à créer dans supabase/migrations/ DANS L'ORDRE :

1. 20260513_admin_users_roles.sql
2. 20260513_permission_helpers.sql (capability-based: can_view_crm, etc.)
3. 20260513_suppression_list.sql (avec CITEXT)
4. 20260514_webhook_events.sql
5. 20260514_campaign_recipients.sql
6. 20260515_email_events.sql
7. 20260515_affiliate_clicks.sql (ip_hash, pas ip raw)
8. 20260516_commission_ledger.sql (service_role only, immuable)
9. 20260516_fraud_flags.sql
10. 20260517_payout_holds.sql
11. 20260517_ai_calls.sql
12. 20260518_import_batches.sql
13. 20260518_domains_mailbox_stats.sql
14. 20260519_lead_enrichment.sql
15. 20260519_unsubscribe_tokens.sql
16. 20260519_product_activation_events.sql
17. 20260520_citext_email_migration.sql (TEXT → CITEXT)
18. 20260520_v2_indexes.sql
19. 20260521_rls_revised.sql (permissions + RPC functions)

PROCÉDURE
=========
1. Crée tous les fichiers .sql avec le SQL exact de ADMIN-DATABASE-SCHEMA.md
2. Apply EN STAGING D'ABORD (pas prod)
3. Run les smoke tests SQL (voir ADMIN-NEXT-7-DAYS.md Jour 1.3)
4. Si tout vert, apply en prod
5. Seed admin_users avec mon compte :
   INSERT INTO admin_users (user_id, role)
   SELECT id, 'owner' FROM auth.users WHERE email = 'samycloutier30@gmail.com';

DEFINITION OF DONE
==================
- [ ] 19 migrations créées et applied (staging + prod)
- [ ] Smoke tests passent (toutes les tables existent, RLS activé, helpers fonctionnent)
- [ ] Mon admin_user row existe avec role='owner'
- [ ] Pas d'erreur RLS dans Supabase advisor
- [ ] SYSTEM-REFERENCE-ADMIN-PERMISSIONS.md créé suivant le format de SYSTEM-REFERENCE-BROWSE.md

ANTI-PATTERNS
=============
❌ Ne push PAS en prod sans tester staging d'abord
❌ Ne saute PAS la création des RPC functions (update_influencer_status, etc.)
❌ Ne fais pas de UNIQUE INDEX sur lower(email) ET email — utilise CITEXT
❌ Le commission_ledger NE DOIT PAS avoir de policy UPDATE/DELETE

OUTPUT
======
Crée SYSTEM-REFERENCE-ADMIN-PERMISSIONS.md avec :
- Liste des 19 migrations + ce qu'elles font
- Capability helpers (can_view_crm, can_manage_payouts, etc.)
- RPC functions (update_influencer_status, etc.)
- Rôles admin et matrice de permissions
- Smoke tests SQL pour validation future
```

---

## ⚡ PROMPT #2 — Admin Shell + Auth (APRÈS #1)

```
CONTEXTE
========
Le schema admin est en place (voir SYSTEM-REFERENCE-ADMIN-PERMISSIONS.md).
Maintenant, on crée la coquille de l'admin : routes, sidebar, auth guard.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/admin-shell

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md — Architecture + Personas + Modules
2. ADMIN-NEXT-7-DAYS.md — Jour 2 détaillé
3. SYSTEM-REFERENCE-ADMIN-PERMISSIONS.md (créé par Prompt #1)
4. SYSTEM-REFERENCE-BROWSE.md — Format de référence à suivre

TÂCHE
=====
Créer la structure admin de base :

1. Route layout /dashboard/admin/* avec auth guard
2. Sidebar navigation avec affichage conditionnel par rôle
3. Helper côté serveur requireAdminRole(capability)
4. Helper côté client useAdminRole()
5. Audit log helper logAdminAction()
6. Page d'accueil admin /dashboard/admin (placeholder pour Morning Dashboard)

FICHIERS À CRÉER
================
- app/dashboard/admin/layout.tsx
- app/dashboard/admin/page.tsx (placeholder)
- app/dashboard/admin/_components/admin-sidebar.tsx
- app/dashboard/admin/_components/admin-header.tsx
- lib/admin/auth.ts (requireAdminRole)
- lib/admin/use-role.ts (client hook)
- lib/admin/audit.ts (logAdminAction)
- lib/admin/permissions.ts (constants des capabilities)

PERMISSIONS BY ROLE (hardcoder dans permissions.ts)
===================================================
const CAPABILITIES = {
  view_crm: ['owner', 'ops', 'va', 'readonly'],
  manage_crm: ['owner', 'ops', 'va'],
  view_inbox: ['owner', 'ops', 'va'],
  view_inbox_bodies: ['owner', 'ops'],
  manage_campaigns: ['owner', 'ops'],
  view_finance: ['owner', 'finance'],
  manage_payouts: ['owner', 'finance'],
  view_credentials: ['owner'],
  manage_admin_users: ['owner'],
}

SIDEBAR ITEMS (avec capability associée)
========================================
- Dashboard          → view_crm
- Influencers        → view_crm
- Inbox              → view_inbox
- Campaigns          → manage_campaigns
- Suppression        → manage_crm
- Affiliates         → view_finance
- Payouts            → manage_payouts
- Webhooks           → view_credentials
- Audit Log          → manage_admin_users

STYLE
=====
- Suivre le design system existant (Tailwind + shadcn/ui)
- Theme cyan/dark comme le reste de l'app
- Sidebar = 280px wide, sticky, dark bg
- Sections collapsibles si trop d'items

DEFINITION OF DONE
==================
- [ ] /dashboard/admin charge avec sidebar pour mon compte (owner)
- [ ] Un user non-admin est redirigé vers /dashboard
- [ ] Sidebar affiche seulement les sections autorisées par le rôle
- [ ] requireAdminRole('manage_payouts') throw pour un VA
- [ ] logAdminAction inserts dans admin_audit_log
- [ ] SYSTEM-REFERENCE-ADMIN.md créé (master, liste tous les modules à venir)

ANTI-PATTERNS
=============
❌ Ne pas mettre la logique permissions seulement côté client
❌ Ne pas appeler Supabase depuis le layout sans cache
❌ Ne pas oublier le redirect si pas authentifié

OUTPUT
======
- SYSTEM-REFERENCE-ADMIN.md (master overview, liste tous les futurs modules avec liens)
```

---

## 🔵 PROMPT A — CRM Influenceurs (PARALLÈLE)

```
CONTEXTE
========
L'admin shell est en place. On build le CRM Influenceurs.
Branch: feature/admin-crm

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md — Module 2 (Influencer CRM)
2. ADMIN-DATABASE-SCHEMA.md — Tables influencers, RPC functions
3. ADMIN-NEXT-7-DAYS.md — Jour 3
4. SYSTEM-REFERENCE-ADMIN-PERMISSIONS.md — RPC functions disponibles
5. SYSTEM-REFERENCE-BROWSE.md — Format référence à suivre

TÂCHE
=====
Build le CRM Influenceurs complet :
1. Page liste avec table filtrable/triable/paginée
2. Page détail avec tabs (Overview/Notes/Tags/Audit)
3. Actions via RPC (pas d'UPDATE direct)

FICHIERS À CRÉER
================
- app/dashboard/admin/influencers/page.tsx (liste)
- app/dashboard/admin/influencers/[id]/page.tsx (détail)
- app/dashboard/admin/influencers/_components/influencer-table.tsx
- app/dashboard/admin/influencers/_components/influencer-filters.tsx
- app/dashboard/admin/influencers/_components/influencer-detail-tabs.tsx
- app/dashboard/admin/influencers/_components/status-changer.tsx
- app/dashboard/admin/influencers/_components/notes-editor.tsx
- app/dashboard/admin/influencers/_components/tags-manager.tsx
- app/dashboard/admin/influencers/_components/audit-timeline.tsx
- lib/admin/influencer-actions.ts (RPC wrappers)
- lib/admin/influencer-types.ts

FEATURES LISTE
==============
- DataTable shadcn avec colonnes : Email, Display name, Platform, Status (badge coloré), Lead Score, Last contact, Tags
- Search debounced (email + name)
- Filter dropdowns : Status, Platform, Niche
- Filter rapides (chips) : "Hot leads", "Active affiliates", "Dormant > 30d", "Top earners"
- Sort par chaque colonne
- Pagination cursor-based (50/page)
- Click row → navigate /dashboard/admin/influencers/[id]

FEATURES DÉTAIL
===============
Tab "Overview" :
- Avatar (initials) + info perso
- Status (dropdown → appelle RPC update_influencer_status)
- Lead score avec breakdown
- Audience size, niche, language, country
- Metrics : emails sent, opened, replied, referrals, commissions earned

Tab "Notes" :
- Markdown editor (use @uiw/react-md-editor ou textarea simple)
- Save via RPC update_influencer_notes
- Auto-save debounced

Tab "Tags" :
- Chips display
- Add via input → RPC add_influencer_tag
- Remove via X → RPC remove_influencer_tag

Tab "Audit" :
- Timeline des actions depuis admin_audit_log
- Filter par action type

Sidebar actions :
- Change status (dropdown)
- Add to suppression → RPC add_to_suppression
- Block influencer
- Generate affiliate code (si status=onboarded)

DEFINITION OF DONE
==================
- [ ] Je peux voir la liste de 100+ influencers avec search/filter/sort
- [ ] Je peux ouvrir une fiche influenceur
- [ ] Je peux changer le status via dropdown (et c'est audit-loggé)
- [ ] Je peux ajouter/retirer des tags
- [ ] Je peux éditer les notes (markdown)
- [ ] Un VA peut faire pareil mais via RPC (pas direct UPDATE)
- [ ] SYSTEM-REFERENCE-ADMIN-CRM.md créé

ANTI-PATTERNS
=============
❌ Ne JAMAIS faire .from('influencers').update() depuis le client — toujours via RPC
❌ Ne pas charger 10k rows d'un coup — pagination
❌ Ne pas oublier les indexes (status, lead_score) pour les sorts
❌ Ne pas hardcoder les statuses — utilise les enums DB

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-CRM.md suivant exactement le format de SYSTEM-REFERENCE-BROWSE.md.
```

---

## 🟢 PROMPT B — Compliance + Unsubscribe (PARALLÈLE)

```
CONTEXTE
========
L'admin shell est en place. On build la compliance layer (CASL/CAN-SPAM/GDPR).
Branch: feature/admin-compliance

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md — Module 1.5 (Compliance Layer) + Anti-Fraude
2. ADMIN-DATABASE-SCHEMA.md — Tables suppression_list, unsubscribe_tokens
3. ADMIN-NEXT-7-DAYS.md — Jours 4 et 5

TÂCHE
=====
1. Page admin suppression list (CRUD)
2. Public route /unsubscribe avec token signé
3. Helper de génération de tokens
4. Function check_suppression à utiliser avant chaque export

FICHIERS À CRÉER
================
- app/dashboard/admin/suppression/page.tsx
- app/dashboard/admin/suppression/_components/suppression-table.tsx
- app/dashboard/admin/suppression/_components/bulk-add-dialog.tsx
- app/unsubscribe/page.tsx (PUBLIC, pas dans /admin)
- app/api/admin/suppression/route.ts (POST add, DELETE remove)
- lib/admin/unsubscribe-token.ts (génération + vérification)
- lib/admin/check-suppression.ts (filter helper)

FEATURES PAGE ADMIN
===================
- Table : email/domain, reason, source, added_at, added_by
- Filter par reason (unsubscribe / hard_bounce / complaint / manual / etc.)
- Search par email/domain
- Bulk add (textarea, 1 email per ligne)
- Remove from list (avec confirmation + audit log)
- Stats en haut : Total / This week / Top reasons

UNSUBSCRIBE PUBLIC FLOW
========================
1. URL : /unsubscribe?t=<token>
2. App lookup token_hash dans unsubscribe_tokens
3. Si valide & pas used & pas expiré :
   - INSERT INTO suppression_list
   - UPDATE influencers SET unsubscribed=true
   - Mark token used_at
4. Show page "Tu es désabonné(e)"
5. Si invalide : show erreur générique

TOKEN GENERATION
================
export async function generateUnsubscribeToken(email: string, campaignId?: string) {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  // INSERT into unsubscribe_tokens
  return token  // utilisé dans URL /unsubscribe?t=<token>
}

CHECK SUPPRESSION HELPER
=========================
export async function filterSuppressed(emails: string[]) {
  // Query suppression_list pour ces emails (case insensitive via CITEXT)
  // Return { allowed: string[], suppressed: { email, reason }[] }
}

DEFINITION OF DONE
==================
- [ ] Page suppression accessible aux roles owner/ops
- [ ] Je peux ajouter manuellement un email/domain
- [ ] Bulk add fonctionne (10+ emails à la fois)
- [ ] /unsubscribe?t=<token> ajoute l'email à la suppression list
- [ ] Token ne peut pas être réutilisé
- [ ] Token expire après 1 an
- [ ] L'email n'apparaît JAMAIS en clair dans l'URL
- [ ] SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md créé

ANTI-PATTERNS
=============
❌ Ne JAMAIS mettre l'email en clair dans l'URL d'unsubscribe
❌ Ne pas stocker le token raw (juste son hash)
❌ Ne pas oublier le check_suppression avant chaque export campagne
❌ Ne pas faire l'unsubscribe public derrière auth (doit être 1-click sans login)

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md suivant format SYSTEM-REFERENCE-BROWSE.md.
```

---

## 🟡 PROMPT C — CSV Import + Batches (PARALLÈLE)

```
CONTEXTE
========
L'admin shell + CRM (Prompt A) sont en cours. On build l'import CSV en parallèle.
Branch: feature/admin-import

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md — Module 1.3 (List Management)
2. ADMIN-DATABASE-SCHEMA.md — Table import_batches
3. ADMIN-NEXT-7-DAYS.md — Jour 4

TÂCHE
=====
1. Page d'import CSV avec drag & drop
2. Mapping de colonnes interactif
3. Preview + validation
4. API route avec batch processing
5. Tracking dans import_batches

FICHIERS À CRÉER
================
- app/dashboard/admin/influencers/import/page.tsx
- app/dashboard/admin/influencers/import/_components/csv-uploader.tsx
- app/dashboard/admin/influencers/import/_components/column-mapper.tsx
- app/dashboard/admin/influencers/import/_components/import-preview.tsx
- app/dashboard/admin/influencers/import/_components/import-progress.tsx
- app/dashboard/admin/influencers/import/_components/import-result.tsx
- app/dashboard/admin/influencers/imports/page.tsx (historique des batches)
- app/dashboard/admin/influencers/imports/[id]/page.tsx (détail d'un batch)
- app/api/admin/influencers/import/route.ts
- lib/admin/csv-parser.ts

FLOW UTILISATEUR
================
1. Upload CSV (drag & drop ou file picker, max 10 MB)
2. Parser client-side avec Papaparse
3. Show preview (10 first rows) + detected headers
4. Column mapping :
   - Email (REQUIRED)
   - First name
   - Last name
   - Platform (twitch/kick/youtube/tiktok/instagram)
   - Platform handle
   - Audience size
   - Niche
   - Country
   - Language
   - Tags (comma-separated)
5. Validation : check email format, required fields
6. Click "Import N rows" → POST API
7. Progress bar (polling status du batch)
8. Result page :
   - X imported (link to filtered list)
   - Y duplicates skipped
   - Z suppressed skipped
   - W failed (with errors)

API ROUTE
=========
POST /api/admin/influencers/import
Body: { rows: Array<InfluencerCSVRow>, mapping: Record<string, string> }

Logic:
1. Auth check (requireAdminRole('manage_crm'))
2. Create import_batches row (status='processing')
3. Stream process par batch de 100 rows :
   a. Check suppression_list (batch query par email)
   b. Insert influencers avec ON CONFLICT DO NOTHING (dedupe via CITEXT)
   c. Track counters
   d. Update import_batches progressively
4. Mark batch status='completed' avec timestamps

DEFINITION OF DONE
==================
- [ ] J'importe un CSV de 500 leads en moins de 30 sec
- [ ] Progress bar live pendant l'import
- [ ] Result clair : combien imported/duplicate/suppressed/failed
- [ ] L'import_batches row contient tous les counters
- [ ] Je peux voir l'historique des imports
- [ ] Je peux drill-down depuis un batch vers les influencers importés
- [ ] Les emails déjà dans suppression_list sont skip
- [ ] Les duplicates (CITEXT case-insensitive) sont skip
- [ ] Update SYSTEM-REFERENCE-ADMIN-CRM.md (section import)

ANTI-PATTERNS
=============
❌ Ne pas faire 1 INSERT par row (use batch insert)
❌ Ne pas oublier suppression check (compliance!)
❌ Ne pas bloquer l'UI pendant un gros import (background processing + polling)
❌ Ne pas perdre la trace d'un batch failed (toujours mark completed/partial/failed)

OUTPUT
======
Section "Import CSV" dans SYSTEM-REFERENCE-ADMIN-CRM.md.
```

---

## 🟣 PROMPT D — Webhooks Instantly + Inbox (PARALLÈLE)

```
CONTEXTE
========
L'admin shell est en place. On build l'ingestion des webhooks Instantly et l'inbox unifié.
Branch: feature/admin-inbox

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md — Module 1.1 (Inbox unifié)
2. ADMIN-DATABASE-SCHEMA.md — Tables webhook_events, email_events, email_messages
3. ADMIN-NEXT-7-DAYS.md — Jours 6 et 7 (partie inbox)

TÂCHE
=====
1. Webhook endpoint Instantly avec idempotency
2. Event processors pour 4 events critiques
3. Inbox UI read-only (PAS de composer pour Semaine 1)
4. Webhook health monitor page

FICHIERS À CRÉER
================
- app/api/admin/webhooks/instantly/route.ts
- lib/admin/webhooks/instantly-processor.ts
- lib/admin/webhooks/process-event.ts (factory)
- app/dashboard/admin/inbox/page.tsx
- app/dashboard/admin/inbox/_components/thread-list.tsx
- app/dashboard/admin/inbox/_components/thread-detail.tsx
- app/dashboard/admin/inbox/_components/influencer-context-sidebar.tsx
- app/dashboard/admin/inbox/_components/inbox-filters.tsx
- app/dashboard/admin/webhooks/page.tsx (health monitor)
- app/dashboard/admin/webhooks/_components/webhook-table.tsx
- app/dashboard/admin/webhooks/[id]/page.tsx (détail d'un webhook)

WEBHOOK ENDPOINT
================
POST /api/admin/webhooks/instantly

Logic :
1. Parse payload
2. Compute event_id (utilise payload.id ou ${event_type}_${timestamp})
3. Compute payload_hash (sha256)
4. INSERT INTO webhook_events avec ON CONFLICT (provider, event_id) DO NOTHING
5. Si insertion réussit (pas duplicate) → process l'event
6. Try/catch : si fail, mark webhook_events status='failed'
7. Si succès, mark status='completed'

EVENTS À PROCESS (Semaine 1)
============================
- email_sent → INSERT email_events (type='sent') + update influencer.last_contacted_at
- email_replied → INSERT email_messages + INSERT email_events (type='replied') + update influencer.status='replied'
- email_bounced → INSERT email_events + INSERT INTO suppression_list (reason='hard_bounce')
- email_unsubscribed → INSERT email_events + INSERT INTO suppression_list (reason='unsubscribe')

Autres events → stockés dans webhook_events mais pas traités (TODO Semaine 2+).

INBOX UI (READ-ONLY)
====================
Layout 2 colonnes (style Gmail) :
- Gauche (40%) : thread list
- Droite (60%) : thread detail

Thread list :
- Sorted by last_event_at DESC
- Filter : Unread / Read / Star / Archive
- Items : influencer name + email, subject, preview (60 chars), status badge, time ago

Thread detail :
- Timeline complète (sent + replies)
- Influencer context sidebar (status, lead score, tags)
- PAS de composer (Semaine 2)
- Actions : Mark hot (tag), Star, Archive, Mark read

IMPORTANT: Pour les VAs, le body doit être tronqué (200 chars + "...") via view v_email_messages_safe.

WEBHOOK HEALTH MONITOR
======================
Table des 100 derniers webhooks :
- Provider, event_type, received_at, processed_at, status
- Click → voir payload + error
- Filter : status, provider, event_type
- Retry button pour les `failed`

DEFINITION OF DONE
==================
- [ ] Je configure le webhook Instantly → URL https://viralanimal.com/api/admin/webhooks/instantly
- [ ] Test : envoie 1 email via Instantly → webhook_events row inséré + email_events row (type='sent')
- [ ] Test : reply au email → email_messages + email_events (replied) + influencer.status='replied'
- [ ] Test : bounce hard → suppression_list row ajouté
- [ ] Si Instantly renvoie même event 2x → 2e est ignoré (duplicate)
- [ ] Inbox UI affiche tous les replies, filtrable
- [ ] VA voit body tronqué (via v_email_messages_safe), pas le body complet
- [ ] Webhook health page accessible owner only
- [ ] SYSTEM-REFERENCE-ADMIN-INBOX.md créé

ANTI-PATTERNS
=============
❌ Ne pas process l'event AVANT l'INSERT webhook_events (sinon perte d'idempotency)
❌ Ne pas oublier ON CONFLICT (provider, event_id) DO NOTHING
❌ Ne pas exposer body complet aux VAs
❌ Ne pas faire de composer dans Semaine 1 (c'est Semaine 2)
❌ Ne pas oublier d'auto-suppress sur bounce/unsubscribe

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-INBOX.md suivant format SYSTEM-REFERENCE-BROWSE.md.
```

---

## 🔴 PROMPT E — Campaigns + Export CSV (PARALLÈLE)

```
CONTEXTE
========
L'admin shell est en place. On build la création de campagnes + export CSV vers Instantly.
Branch: feature/admin-campaigns

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md — Module 1 (Cold Email Engine)
2. ADMIN-DATABASE-SCHEMA.md — Tables email_campaigns, campaign_recipients
3. ADMIN-NEXT-7-DAYS.md — Jour 7 (campaign export)

TÂCHE
=====
1. Page de création de campagne
2. Sélection d'influencers avec filters
3. Export CSV suppression-aware
4. Stockage du snapshot dans Supabase Storage
5. Tracking dans campaign_recipients

FICHIERS À CRÉER
================
- app/dashboard/admin/campaigns/page.tsx (liste)
- app/dashboard/admin/campaigns/new/page.tsx (création)
- app/dashboard/admin/campaigns/[id]/page.tsx (détail)
- app/dashboard/admin/campaigns/_components/campaign-form.tsx
- app/dashboard/admin/campaigns/_components/recipient-selector.tsx
- app/dashboard/admin/campaigns/_components/export-preview.tsx
- app/api/admin/campaigns/route.ts (POST create)
- app/api/admin/campaigns/[id]/export/route.ts (POST export)
- lib/admin/campaigns/csv-generator.ts

FLOW CRÉATION CAMPAGNE
=======================
1. Form :
   - Name (required)
   - Description
   - Target niche (dropdown multi)
   - Target platform (dropdown multi)
   - Mailbox assignment (dropdown)
   - Subject template
   - Body template
2. Recipient selector :
   - Filter : status (in 'cold', 'contacted', etc.), niche, platform, audience_size_min/max, country
   - Show preview "X influencers match"
3. Preview export :
   - X total selected
   - Y suppressed (will skip)
   - Z duplicates (already in another active campaign)
   - W will be exported
4. Click "Export to Instantly" :
   - INSERT INTO email_campaigns
   - INSERT batch INTO campaign_recipients (one per allowed influencer)
   - Generate CSV
   - Upload to Supabase Storage : campaign-exports/{campaign_id}/recipients-{timestamp}.csv
   - Return CSV download link + summary

CSV FORMAT POUR INSTANTLY
==========================
email, first_name, last_name, display_name, platform, niche, audience_size, custom_var_1, unsubscribe_token

Le unsubscribe_token est généré par la fonction generateUnsubscribeToken() (Prompt B).
À utiliser dans le template body : {{unsubscribe_token}} → /unsubscribe?t=<token>

PAGE LISTE
==========
Table des campagnes :
- Name, Status (draft/active/paused/completed), Created at, Recipients count, Sent, Reply rate, Open rate
- Click → page détail
- Actions : Pause, Resume, Archive

PAGE DÉTAIL
===========
- Campaign info + metrics
- Liste des recipients avec leur status (queued, sent, replied, bounced, etc.)
- Stats : open rate, reply rate, bounce rate
- Export logs (CSV exports précédents)
- Edit button (pour les drafts)

DEFINITION OF DONE
==================
- [ ] Je crée une campagne avec 500 leads sélectionnés
- [ ] La preview montre : "500 selected, 23 suppressed, 12 duplicates, 465 will export"
- [ ] J'exporte → CSV téléchargeable + uploadé dans Storage
- [ ] campaign_recipients populated avec les 465 rows
- [ ] CSV contient bien la colonne unsubscribe_token avec tokens uniques
- [ ] La campagne apparaît dans la liste avec status='draft'
- [ ] SYSTEM-REFERENCE-ADMIN-CAMPAIGNS.md créé

ANTI-PATTERNS
=============
❌ Ne pas exporter sans check suppression_list
❌ Ne pas générer de tokens en duplicate
❌ Ne pas oublier de marquer les campaign_recipients status='queued'
❌ Ne pas stocker des CSV avec PII en bucket public

OUTPUT
======
SYSTEM-REFERENCE-ADMIN-CAMPAIGNS.md suivant format SYSTEM-REFERENCE-BROWSE.md.
```

---

## 🟠 PROMPT F — Instantly API Sync Service (PARALLÈLE)

```
CONTEXTE
========
L'admin shell est en place. On build le service de sync avec l'API Instantly pour avoir
toutes les métriques (campagnes + mailbox health) directement dans notre admin.
Branch: feature/admin-instantly-sync

DOCS À LIRE
===========
1. ADMIN-MEGA-PLAN.md — Tech Stack + Mailbox Health
2. ADMIN-DATABASE-SCHEMA.md — Tables mailboxes, mailbox_daily_stats, email_campaigns
3. Instantly API docs : https://developer.instantly.ai/

TÂCHE
=====
1. Client API Instantly avec auth
2. Sync job (cron) qui pull les stats toutes les 15 min
3. Mise à jour des tables mailboxes + email_campaigns + mailbox_daily_stats
4. Page "Sync Status" dans admin
5. Force-sync button

FICHIERS À CRÉER
================
- lib/integrations/instantly/client.ts (API wrapper)
- lib/integrations/instantly/types.ts
- lib/integrations/instantly/sync.ts (main sync logic)
- lib/integrations/instantly/sync-mailboxes.ts
- lib/integrations/instantly/sync-campaigns.ts
- app/api/admin/sync/instantly/route.ts (manual trigger)
- app/api/cron/sync-instantly/route.ts (scheduled, Netlify scheduled functions)
- app/dashboard/admin/sync/page.tsx
- app/dashboard/admin/sync/_components/sync-status-card.tsx

INSTANTLY API CLIENT
====================
const INSTANTLY_API_BASE = 'https://api.instantly.ai/api/v2'

export class InstantlyClient {
  constructor(private apiKey: string) {}

  async getCampaigns()
  async getCampaignAnalytics(id: string)
  async getEmailAccounts()
  async getEmailAccountHealth(id: string)
  async pauseCampaign(id: string)
  async resumeCampaign(id: string)
}

Env var : INSTANTLY_API_KEY (à ajouter à .env.local + Netlify)

SYNC LOGIC
==========
function syncInstantlyStats() {
  // 1. Sync mailboxes
  const accounts = await instantly.getEmailAccounts()
  for (account of accounts) {
    UPSERT mailboxes (email, provider='instantly', reputation_score, warmup_status, daily_send_count, last_synced_at)
    UPSERT mailbox_daily_stats (mailbox_id, stat_date=today, reputation_score, emails_sent, ...)
  }

  // 2. Sync campaigns
  const campaigns = await instantly.getCampaigns()
  for (campaign of campaigns) {
    const stats = await instantly.getCampaignAnalytics(campaign.id)
    UPSERT email_campaigns (external_id, sent_count, open_rate, reply_rate, bounce_rate, last_synced_at)
  }

  // 3. Log sync status
}

CRON CONFIG
===========
netlify.toml :
[[scheduled.functions]]
  path = "/api/cron/sync-instantly"
  schedule = "*/15 * * * *"

PAGE SYNC STATUS
================
- "Last sync: 8 min ago ✅"
- "Next sync: in 7 min"
- Stats : X campaigns synced, Y mailboxes synced
- Avg reputation score across mailboxes
- "Force sync now" button
- Recent sync logs (success/error)

DEFINITION OF DONE
==================
- [ ] Cron runs toutes les 15 min
- [ ] Mailboxes table reflects Instantly data (reputation_score à jour)
- [ ] Campaigns table a open_rate, reply_rate, bounce_rate à jour
- [ ] mailbox_daily_stats accumule l'historique pour graphiques
- [ ] Force-sync depuis l'admin marche
- [ ] Page sync status montre last_sync + next_sync
- [ ] SYSTEM-REFERENCE-ADMIN-CAMPAIGNS.md updated avec section "Instantly Sync"

ANTI-PATTERNS
=============
❌ Ne pas exposer l'API key côté client (server-only)
❌ Ne pas faire 100 API calls en parallèle (rate limit Instantly)
❌ Ne pas crash le cron si une campagne fail (process les autres + log error)
❌ Ne pas re-fetch les vieilles campagnes archived (filter active only)

OUTPUT
======
Section "Instantly API Sync" dans SYSTEM-REFERENCE-ADMIN-CAMPAIGNS.md +
lib/integrations/instantly/README.md avec usage examples.
```

---

## 📋 Ordre d'exécution recommandé

### Phase 1 — Séquentiel (1h-1h30)
1. **Prompt #1** — Schema (solo)
2. **Prompt #2** — Admin shell (solo, après #1 merged)

### Phase 2 — Parallèle (2-4h)
3. Lance simultanément dans 6 sessions Claude Code :
   - **Prompt A** — CRM
   - **Prompt B** — Compliance
   - **Prompt C** — Import
   - **Prompt D** — Webhooks + Inbox
   - **Prompt E** — Campaigns
   - **Prompt F** — Instantly Sync

### Phase 3 — Merge order (30 min)
- B (Compliance — pas de deps)
- C (Import — depends on B partial)
- A (CRM — utilise les RPC déjà en place)
- D (Inbox — depends on B pour suppression auto)
- E (Campaigns — depends on B pour suppression check + tokens)
- F (Instantly Sync — peut être mergé en dernier)

### Phase 4 — Test end-to-end
- Import un CSV de 50 leads de test
- Crée une campagne
- Export CSV → vérifie suppression check
- Configure webhook Instantly
- Send 1 email test
- Verify webhook arrive et update inbox
- Reply au test → verify status update
- Force sync Instantly → verify stats update

---

## 🛑 Si une session bloque

| Problème | Action |
|---|---|
| RLS bloque mon SELECT | Verify admin_users row exists pour ton user_id |
| RPC retourne "permission denied" | Check capability dans permissions.ts vs role en DB |
| Webhook ne reçoit rien | Test avec ngrok local + curl manuel |
| Instantly API 401 | Verify INSTANTLY_API_KEY env var (server-side seulement) |
| Migration fail "already exists" | DROP la table en staging, re-apply migration |
| CSV import slow | Réduit batch size à 50, ajoute progress polling |

---

## ✅ Definition of Done globale (fin de soirée)

- [ ] Schema entièrement migré (staging + prod)
- [ ] Admin shell accessible avec auth par rôle
- [ ] CRM influencers fonctionnel (list + detail + import)
- [ ] Compliance layer fonctionnelle (suppression + unsubscribe public)
- [ ] Webhooks Instantly ingestés (idempotent) + inbox read-only
- [ ] Campaigns creation + export CSV avec suppression check
- [ ] Sync service Instantly tournant
- [ ] 5-6 fichiers SYSTEM-REFERENCE-ADMIN-XXX.md créés
- [ ] Tests end-to-end passent

**= Tu peux importer 500 leads, créer une campagne, l'envoyer via Instantly, recevoir les replies dans ton admin, suppression auto sur bounce. Vague 1 Semaine 1 LIVE.**

---

*Document créé : 2026-05-11*
*À utiliser : ce soir (blitz mode)*
*Sessions Claude Code recommandées : 6-7 en parallèle après les 2 séquentielles*

---

## 🔍 PROMPT G — VÉRIFICATION & QA FINALE (à lancer après tous les merges)

> **Quand utiliser ?** Une fois tous les prompts #1, #2, A, B, C, D, E, F mergés dans `main`.
> Cette session Claude Code passe TOUT en revue, détecte les bugs, fixe les petits trucs, et te sort un rapport détaillé.

```
CONTEXTE
========
Tu es l'auditeur final de l'Admin Hub de Viral Animal.
Toutes les sessions de build sont terminées et mergées dans main.
Ta mission : vérifier que TOUT est correctement implémenté, détecter les bugs, et reporter.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: main (à jour avec tous les merges)

DOCS DE RÉFÉRENCE
=================
1. ADMIN-MEGA-PLAN.md
2. ADMIN-DATABASE-SCHEMA.md (sections v1, v2.0, v2.1)
3. ADMIN-NEXT-7-DAYS.md
4. ADMIN-CLAUDE-CODE-PROMPTS.md (ce qui était attendu de chaque session)
5. SYSTEM-REFERENCE-ADMIN-*.md (créés par chaque session)

MISSION EN 7 PHASES
====================

PHASE 1 — VÉRIFICATION DU SCHEMA SUPABASE
==========================================
Run sur Supabase (prod) les checks suivants :

A) Toutes les tables v2.0 + v2.1 existent :
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN (
       'admin_users', 'suppression_list', 'webhook_events',
       'campaign_recipients', 'email_events', 'affiliate_clicks',
       'affiliate_commission_ledger', 'fraud_flags', 'payout_holds',
       'ai_calls', 'import_batches', 'domains', 'mailbox_daily_stats',
       'lead_enrichment_snapshots', 'unsubscribe_tokens',
       'product_activation_events'
     );
   → DOIT retourner 16 rows

B) Capability helpers existent :
   SELECT proname FROM pg_proc WHERE proname IN (
     'can_view_crm', 'can_manage_crm', 'can_view_finance',
     'can_manage_payouts', 'is_owner', 'auth_role',
     'can_view_inbox', 'can_view_inbox_bodies'
   );
   → DOIT retourner 8 rows

C) RPC functions existent :
   SELECT proname FROM pg_proc WHERE proname IN (
     'update_influencer_status', 'update_influencer_notes',
     'add_influencer_tag', 'remove_influencer_tag',
     'add_to_suppression', 'create_manual_ledger_adjustment'
   );
   → DOIT retourner 6 rows

D) RLS activé sur les tables critiques :
   SELECT tablename, rowsecurity FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename IN ('influencers', 'admin_users',
     'suppression_list', 'affiliate_commission_ledger', 'mailboxes');
   → Toutes DOIVENT avoir rowsecurity = true

E) Mon admin_user existe avec role='owner' :
   SELECT user_id, role FROM admin_users
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'samycloutier30@gmail.com');
   → DOIT retourner 1 row avec role='owner'

F) Email column est CITEXT :
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'influencers' AND column_name = 'email';
   → data_type DOIT être 'citext' ou 'USER-DEFINED'

PHASE 2 — VÉRIFICATION DES FICHIERS
====================================
Vérifie que ces fichiers existent :

Layout & auth :
- app/dashboard/admin/layout.tsx
- app/dashboard/admin/page.tsx
- app/dashboard/admin/_components/admin-sidebar.tsx
- lib/admin/auth.ts
- lib/admin/permissions.ts
- lib/admin/audit.ts

CRM :
- app/dashboard/admin/influencers/page.tsx
- app/dashboard/admin/influencers/[id]/page.tsx
- lib/admin/influencer-actions.ts

Compliance :
- app/dashboard/admin/suppression/page.tsx
- app/unsubscribe/page.tsx
- lib/admin/unsubscribe-token.ts
- lib/admin/check-suppression.ts

Import :
- app/dashboard/admin/influencers/import/page.tsx
- app/api/admin/influencers/import/route.ts

Inbox + Webhooks :
- app/dashboard/admin/inbox/page.tsx
- app/api/admin/webhooks/instantly/route.ts
- lib/admin/webhooks/instantly-processor.ts

Campaigns :
- app/dashboard/admin/campaigns/page.tsx
- app/dashboard/admin/campaigns/new/page.tsx
- app/api/admin/campaigns/[id]/export/route.ts

Instantly Sync :
- lib/integrations/instantly/client.ts
- lib/integrations/instantly/sync.ts
- app/api/cron/sync-instantly/route.ts
- app/dashboard/admin/sync/page.tsx

SYSTEM REFERENCES :
- SYSTEM-REFERENCE-ADMIN.md (master)
- SYSTEM-REFERENCE-ADMIN-PERMISSIONS.md
- SYSTEM-REFERENCE-ADMIN-CRM.md
- SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md
- SYSTEM-REFERENCE-ADMIN-INBOX.md
- SYSTEM-REFERENCE-ADMIN-CAMPAIGNS.md

Si UN fichier manque → flag dans le rapport.

PHASE 3 — TESTS RLS
===================
Run ces tests pour valider les permissions :

A) Test 1 : VA ne peut PAS UPDATE direct influencers
   - Crée un user test avec role='va'
   - En tant que ce user, essaie :
     UPDATE influencers SET affiliate_code = 'hack' WHERE id = '<some-id>';
   - DOIT échouer (RLS bloque)

B) Test 2 : VA peut update status via RPC
   - En tant que VA, call :
     SELECT update_influencer_status('<some-id>', 'replied');
   - DOIT réussir + audit log entry created

C) Test 3 : Finance NE PEUT PAS voir inbox bodies complets
   - Crée un user test avec role='finance'
   - SELECT * FROM v_email_messages_safe;
   - body_text DOIT être tronqué à 200 chars

D) Test 4 : Personne ne peut UPDATE commission_ledger
   - En tant qu'owner, essaie :
     UPDATE affiliate_commission_ledger SET amount_cents = 999999 WHERE id = '<some-id>';
   - DOIT échouer (pas de policy UPDATE)

PHASE 4 — TESTS FONCTIONNELS (build localement)
================================================
Run `npm run dev` et teste manuellement :

A) Login + admin access :
   - Aller à localhost:3000/dashboard/admin
   - DOIT charger avec sidebar visible
   - Sidebar DOIT afficher tous les menus (parce que tu es owner)

B) Non-admin redirect :
   - Logout
   - Login avec un compte non-admin
   - Aller à localhost:3000/dashboard/admin
   - DOIT redirect vers /dashboard

C) Import CSV test :
   - Crée un CSV de 10 leads test
   - Va dans Influencers → Import
   - Upload + map columns + import
   - DOIT importer les 10 leads
   - DOIT créer un import_batches row complet

D) Suppression test :
   - Ajoute 1 email à la suppression
   - Re-import le CSV avec ce même email
   - DOIT skip cet email + rows_skipped_suppression = 1

E) Unsubscribe public flow :
   - Genère un token via le helper
   - Visite /unsubscribe?t=<token>
   - DOIT afficher confirmation + suppression_list row ajouté

F) Webhook idempotency :
   - POST 2x le même payload à /api/admin/webhooks/instantly
   - Premier DOIT être processed
   - Deuxième DOIT être marked duplicate

G) Campaign export :
   - Crée une campagne avec 10 leads (1 dans suppression)
   - Click export
   - DOIT générer un CSV avec 9 emails (pas 10)
   - campaign_recipients DOIT avoir 9 rows

H) Instantly Sync :
   - Vérifie que INSTANTLY_API_KEY est set
   - Click "Force sync now" sur la page sync
   - DOIT mettre à jour mailboxes + email_campaigns

PHASE 5 — TYPECHECK & LINTING
==============================
Run :
1. `npm run type-check` → 0 errors expected
2. `npm run lint` → 0 errors expected
3. `npm run build` → DOIT compiler sans erreur

Si erreurs → fix les petites (imports manquants, typos) automatiquement.
Si erreurs grosses → reporte dans le rapport final.

PHASE 6 — VÉRIFICATION DES SYSTEM-REFERENCE
============================================
Pour chaque SYSTEM-REFERENCE-ADMIN-XXX.md, vérifie :

A) Structure suit le format de SYSTEM-REFERENCE-BROWSE.md :
   - Header avec titre + version + date
   - Section "Architecture" avec table des fichiers
   - Section "Layout"
   - Section "Store/State"
   - Section "API endpoints"
   - Section "DB tables"

B) Tous les fichiers créés sont listés dans Architecture
C) Pas de TODO/FIXME laissés
D) Last updated = aujourd'hui

PHASE 7 — GÉNÉRATION DU RAPPORT FINAL
======================================
Crée un fichier ADMIN-VERIFICATION-REPORT.md avec EXACTEMENT cette structure :

# 🔍 Admin Hub — Verification Report
Date : [aujourd'hui]
Status global : ✅ READY / ⚠️ ISSUES FOUND / 🔴 BLOCKED

## ✅ Ce qui marche parfaitement
- [Liste des features validées avec checkmark]

## ⚠️ Issues mineures (fixées auto)
- [Liste des petits trucs que t'as fixés]
- Fichier X : missing import "Y" → fixed
- Etc.

## 🔴 Issues critiques (à fixer manuellement)
- [Liste des trucs qui demandent l'attention de Samy]
- Détail technique + fichier + ligne
- Suggestion de fix

## 📊 Stats
- Tables DB créées : X / 16
- Fichiers créés : X / Y
- SYSTEM-REFERENCE docs : X / 6
- Tests RLS passés : X / 4
- Tests fonctionnels passés : X / 8

## 🎯 Recommandations pour Vague 1 Semaine 2
- [Liste de ce qu'il faut commencer à préparer]

## 🚀 Tu peux lancer ?
- ✅ OUI / ⚠️ Pas encore — voici pourquoi : [...]

DEFINITION OF DONE
==================
- [ ] Toutes les phases 1-7 complétées
- [ ] Fichier ADMIN-VERIFICATION-REPORT.md créé
- [ ] Issues mineures fixées automatiquement
- [ ] Issues critiques bien documentées avec suggestion de fix

ANTI-PATTERNS
=============
❌ Ne pas dire "tout est ok" sans avoir vraiment vérifié
❌ Ne pas oublier de tester en local avec npm run dev
❌ Ne pas modifier les SYSTEM-REFERENCE si juste cosmétique
❌ Ne pas push prod si Phase 5 (build) échoue

OUTPUT FINAL
============
1. ADMIN-VERIFICATION-REPORT.md (le rapport)
2. Liste claire des actions que Samy doit faire avant de lancer en prod
3. Réponse au format : "Tu peux lancer ? OUI / NON parce que [...]"
```

---

## 📋 Quand lancer le Prompt G

✅ **Toutes les 7 sessions précédentes sont mergées dans main**
✅ **Tu as run `git pull` pour avoir tout le code à jour**
✅ **Tu es en local avec `npm install` à jour**

Alors lance le Prompt G dans une session Claude Code dédiée. Donne-lui 30-45 min pour faire son audit complet.

Tu vas recevoir un rapport clean qui te dit exactement :
- Si tu peux lancer en prod
- Quoi fixer si non
- Stats de complétion
- Next steps pour Semaine 2

---

*Prompt G ajouté : 2026-05-11 (verification & QA pass)*
