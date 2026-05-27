# 📚 SYSTEM REFERENCES INDEX — Viral Animal

> **Source unique de vérité** sur tous les systèmes en prod ou planifiés.
> Chaque module = 1 fichier `SYSTEM-REFERENCE-XXX.md` à jour.
> Cet index dit **quoi lire** avant de toucher à quel système.

**Dernière maj** : 2026-05-13 (V3 W1 + W2 merged)
**Mainteneur** : Samy Cloutier ([samy@viralanimal.com](mailto:samy@viralanimal.com))

---

## 🔑 RÈGLE D'OR

> **Avant de modifier un système → lire son SYSTEM-REFERENCE.**
> **Après avoir modifié un système → mettre à jour son SYSTEM-REFERENCE.**

Si un système n'a **pas** de reference → c'est un bug. Créer le fichier en même temps que le code.

---

## 📂 ORGANISATION

```
[ROOT]
├── SYSTEM-REFERENCE.md              ← Vue d'ensemble produit (legacy, à phaser out)
├── SYSTEM-REFERENCES-INDEX.md       ← CE FICHIER (le maître)
│
├── 🎬 PRODUIT (côté utilisateur)
│   ├── SYSTEM-REFERENCE-BROWSE.md
│   ├── SYSTEM-REFERENCE-AI.md
│   ├── SYSTEM-REFERENCE-ENHANCE.md
│   ├── SYSTEM-REFERENCE-DISTRIBUTION.md
│   └── SYSTEM-REFERENCE-ANALYTICS.md
│
├── 🏢 ADMIN HUB (côté Samy)
│   ├── SYSTEM-REFERENCE-ADMIN-CRM.md
│   ├── SYSTEM-REFERENCE-ADMIN-CAMPAIGNS.md
│   ├── SYSTEM-REFERENCE-ADMIN-INBOX.md
│   ├── SYSTEM-REFERENCE-ADMIN-AI-TRIAGE.md
│   ├── SYSTEM-REFERENCE-ADMIN-AFFILIATES.md
│   ├── SYSTEM-REFERENCE-ADMIN-PAYOUTS.md
│   ├── SYSTEM-REFERENCE-ADMIN-ANALYTICS.md
│   ├── SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md
│   ├── SYSTEM-REFERENCE-ADMIN-WATCHDOG.md
│   ├── SYSTEM-REFERENCE-ADMIN-MORNING-DASHBOARD.md
│   └── SYSTEM-REFERENCE-ADMIN-MAILBOX-HEALTH.md
│
├── 🤝 PARTNER PORTAL
│   └── SYSTEM-REFERENCE-PARTNER-PORTAL.md
│
├── 🎨 DESIGN / UI
│   └── SYSTEM-REFERENCE-DESIGN-SYSTEM.md
│
└── 🚀 V3 ACQUISITION
    ├── SYSTEM-REFERENCE-ADMIN-SCRAPER.md             ← V3-1A ✅ MERGED
    ├── SYSTEM-REFERENCE-ADMIN-REPOST-KIT.md          ← V3-1B ✅ MERGED
    ├── SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md (update) ← V3-1C ✅ MERGED
    ├── SYSTEM-REFERENCE-ADMIN-VIDEO-LIBRARY.md          ← V3-2A ✅ MERGED
    ├── SYSTEM-REFERENCE-ADMIN-AI-SCORING.md            ← V3-2B ✅ MERGED
    ├── SYSTEM-REFERENCE-ADMIN-MATCH-ENGINE.md          ← V3-2C ✅ MERGED
    ├── SYSTEM-REFERENCE-ADMIN-OFFER-GENERATOR.md      ← V3-2D ✅ MERGED
        + SYSTEM-REFERENCE-ADMIN-PUBLICATION-TRACKING.md
        + SYSTEM-REFERENCE-ADMIN-LEARNING-LOOP.md
```

---

## 🎬 PRODUIT (CÔTÉ UTILISATEUR)

### `SYSTEM-REFERENCE-BROWSE.md`
**Scope** : Page `/browse` — découverte de clips, filtres, infinite scroll, preview.
**Lire avant** : changements sur browse, filtres, ranking algo, infinite scroll behavior.
**Tables clés** : `clips`, `clip_metadata`, `user_likes`.

### `SYSTEM-REFERENCE-AI.md`
**Scope** : Pipeline AI principal (Claude transcription → hook detection → score viral → captions).
**Lire avant** : modifier prompts Claude, ajuster scoring, ajouter un nouveau LLM call.
**Coûts** : ~$0.02 / clip processé.

### `SYSTEM-REFERENCE-ENHANCE.md`
**Scope** : Page `/enhance/[clipId]` — options de remontage (split-screen, voix-off, subtitles karaoké).
**Lire avant** : toucher à l'éditeur, FFmpeg pipeline, ou aux options UI.
**Règle critique** : **le render DOIT matcher les OPTIONS choisies dans l'UI** (cf. `feedback_render_parity`).

### `SYSTEM-REFERENCE-DISTRIBUTION.md`
**Scope** : Publication multi-plateforme (TikTok, IG, YT Shorts), scheduling, OAuth comptes sociaux.
**Lire avant** : ajouter une plateforme, modifier OAuth flow, scheduling logic, TikTok publish dialog.
**Dépendances** : Apps API (Meta, TikTok, YouTube) — cf. `reference_social_api_apps.md` en mémoire.
**v8.1** : TikTok Direct Post compliance — TikTokPublishDialog, creator_info, 7 requirements UX, polling status.
**Docs liés** : `TIKTOK-DEMO-VIDEO-SCRIPT.md` (script vidéo démo pour audit TikTok).

### `SYSTEM-REFERENCE-ANALYTICS.md`
**Scope** : Analytics côté **user** (vues, likes, retention, performance par plateforme).
**Lire avant** : ajouter métriques user, modifier dashboards `/dashboard`.
**Note** : à ne pas confondre avec `SYSTEM-REFERENCE-ADMIN-ANALYTICS.md`.

---

## 🏢 ADMIN HUB (CÔTÉ SAMY)

### `SYSTEM-REFERENCE-ADMIN-CRM.md`
**Scope** : Pipeline 14 statuts, table `influencers`, dedup CITEXT email, tags, sources.
**Lire avant** : ajouter colonne à `influencers`, modifier statuts pipeline, import CSV, dedup logic.
**Tables clés** : `influencers`, `import_batches`, `lead_enrichment_snapshots`, `suppression_list`.

### `SYSTEM-REFERENCE-ADMIN-CAMPAIGNS.md`
**Scope** : Cold email campaigns (Instantly/Smartlead), templates, A/B variants, scheduling.
**Lire avant** : créer une nouvelle séquence email, ajouter un provider SMTP.
**Dépendance** : `SYSTEM-REFERENCE-ADMIN-MAILBOX-HEALTH.md`.

### `SYSTEM-REFERENCE-ADMIN-INBOX.md`
**Scope** : Inbox unifié (IMAP), reply composer, threading, assignment.
**Lire avant** : ajouter un account email, modifier la logique de threading.
**Pattern critique** : ne **jamais** auto-reply sur contenu reçu (anti-injection).

### `SYSTEM-REFERENCE-ADMIN-AI-TRIAGE.md`
**Scope** : Claude Haiku — classification (interested/objection/spam), lead scoring, generated drafts.
**Lire avant** : modifier prompts triage, ajuster confidence thresholds, ajouter une classe.
**Coûts** : ~$0.003 / email triagé.

### `SYSTEM-REFERENCE-ADMIN-AFFILIATES.md`
**Scope** : Codes promo, commission ledger immuable, attribution, Stripe Connect Express.
**Lire avant** : modifier la logique de commission, ajouter un tier d'affiliate, attribution.
**Tables clés** : `affiliate_codes`, `commission_ledger` (append-only), `partner_accounts`.

### `SYSTEM-REFERENCE-ADMIN-PAYOUTS.md`
**Scope** : Payout schedule (mensuel), Stripe Connect transfers, statements.
**Lire avant** : modifier le cycle de payout, ajouter une devise, threshold minimum.
**Compliance** : 1099-NEC / T4A si > $600 USD ou > $500 CAD annuel.

### `SYSTEM-REFERENCE-ADMIN-ANALYTICS.md`
**Scope** : Analytics côté **admin** (MRR, churn, growth, cohorts, funnel acquisition).
**Lire avant** : modifier les dashboards admin, ajouter une métrique business.

### `SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md` ✅ MAJ V3-1C
**Scope** : CASL, GDPR, CAN-SPAM, Loi 25 Québec, FTC disclosure, suppression list.
**Lire avant** : toucher à l'outbound, à la suppression list, ou au consent management.
**V3 ajouts** : suppression 4-way, `validateContact()`, FTC checker, `compliance_audit_log`, GDPR export/delete, compliance dashboard.

### `SYSTEM-REFERENCE-ADMIN-WATCHDOG.md`
**Scope** : Monitoring 24/7 — webhooks Stripe, jobs crons, erreurs critiques, alerting.
**Lire avant** : ajouter un check, modifier alerting (Slack/email).

### `SYSTEM-REFERENCE-ADMIN-MORNING-DASHBOARD.md`
**Scope** : Dashboard quotidien `/admin` — top métriques, actions à faire, alertes.
**Lire avant** : ajouter une carte au morning dashboard, changer l'ordre de priorité.

### `SYSTEM-REFERENCE-ADMIN-MAILBOX-HEALTH.md`
**Scope** : Reputation tracking (bounce rate, spam rate, warmup status), SPF/DKIM/DMARC.
**Lire avant** : ajouter une mailbox, faire migration de provider, troubleshooting deliverability.
**Réf mémoire** : `project_zoho_cold_email_pattern.md` (Zoho block recurrent).

---

## 🤝 PARTNER PORTAL

### `SYSTEM-REFERENCE-PARTNER-PORTAL.md`
**Scope** : `/partner/*` — magic link auth, dashboard influenceur, Stripe Connect onboarding.
**Lire avant** : modifier les pages partner, le magic link flow, ou le Stripe Connect Express setup.
**Sécurité** : RLS sur `partner_accounts`, JWT custom claims pour partner_id.

---

## 🎨 DESIGN / UI

### `SYSTEM-REFERENCE-DESIGN-SYSTEM.md`
**Scope** : Palette (amber/cyan/dark zinc), typography, components Tailwind, logo.
**Lire avant** : créer un nouveau composant, ajouter une couleur, choisir une icône.
**Décisions clés** : Logo doré métallique (`#FDE68A → #F59E0B → #B45309`), wordmark amber-500.

---

## 🚀 V3 ACQUISITION SYSTEM (À VENIR — WEEK 1)

> Voir `ACQUISITION-CLAUDE-CODE-PROMPTS-WEEK1.md` pour les prompts détaillés.
> Voir `ACQUISITION-SYSTEM-MASTER-PLAN.md` (V3) pour l'architecture complète.

### `SYSTEM-REFERENCE-ADMIN-SCRAPER.md` 🆕 (V3-1A)
**Scope** : Discovery automatique de **distributeurs d'apps** (créateurs qui font déjà du repost).
**Sources** : YouTube Data API v3 (priority 1), HTML parsing (priority 2), Playwright (priority 3 fallback).
**Pipeline** : keyword pre-score → Claude AI score (top 3% seulement) → 4-way suppression check.
**Tables** :
- `lead_discovery_runs`
- `lead_discovery_results`
- `public_contact_points` (provenance obligatoire : `source_url` + `found_at`)
- `affiliate_signal_snapshots`
- `promoted_products` (Distributor Graph)
- `scraper_saved_searches`
- `scraper_quota_usage`
- `scraper_source_health`
- `scraper_rate_limits`
- `high_intent_no_email`

**Lire avant** : ajouter une source, modifier le scoring, toucher au quota tracking.

### `SYSTEM-REFERENCE-ADMIN-REPOST-KIT.md` 🆕 (V3-1B)
**Scope** : Page publique `/partner/repost/[handle]` — kit pré-fait, mobile-first.
**Sections** : video preview avec milestones tracking, code promo, caption FTC-compliant, hashtags, projected commission, progress bar, one-tap actions, submit form.
**Tracking** : 16 event types granulaires (`kit_viewed`, `video_25_percent`, `code_copied`, `post_submitted`, etc.).
**Tables** :
- `repost_kit_sessions`
- `repost_kit_events`

**Lire avant** : modifier le repost kit UX, ajouter un event type, changer le funnel.

### `SYSTEM-REFERENCE-ADMIN-COMPLIANCE.md` ✅ DONE (V3-1C)
**Scope additionnel V3** :
- Suppression 4-way via `is_suppressed_4way()` Postgres + `filterSuppressed4Way()` TS
- `validateContact()` master validator (provenance + suppression + email check)
- FTC disclosure checker (`captionHasDisclosure()`, `validateCaptionForKit()`)
- Provenance enforcement (`checkProvenance()` — NO source_url = NO contact)
- Compliance dashboard `/dashboard/admin/compliance` (stats, blocks, audit log, GDPR)
- Table `compliance_audit_log` (11 action types)
- GDPR export + delete APIs
- Import flow updated to use 4-way suppression
- Webhook handlers updated to auto-add 4 dimensions on bounce/unsub

**Lire avant** : ajouter un nouveau lead source, modifier le suppression flow, changer les captions auto-générées.

---

## 🛣️ FUTURS SYSTEM REFERENCES (V3 SEMAINE 2+)

À créer au fur et à mesure du build V3 :

| Fichier | Scope | Semaine |
|---|---|---|
| `SYSTEM-REFERENCE-ADMIN-MATCH-ENGINE.md` | Match algorithm video ↔ influencer (rule-based V1) | S2 DONE |
| `SYSTEM-REFERENCE-ADMIN-OFFER-GENERATOR.md` | Personalized email generator + A/B variants + subject lines | ✅ S2 |
| `SYSTEM-REFERENCE-ADMIN-VIDEO-LIBRARY.md` | Bibliothèque vidéos pub admin (upload + tags + métadonnées) | S2 |
| `SYSTEM-REFERENCE-ADMIN-PUBLICATION-TRACKING.md` | Détection auto des reposts (yt-dlp + form manuel) | S3 |
| `SYSTEM-REFERENCE-ADMIN-LEARNING-LOOP.md` | Feedback loop : ce qui convertit → re-feed le scoring | S4 |
| `SYSTEM-REFERENCE-ADMIN-EXPERIMENTATION.md` | A/B testing engine pour offers, captions, hooks | S4-5 |
| `SYSTEM-REFERENCE-ADMIN-LEAD-QUALITY.md` | Lead source quality score + auto-pause sources qui sous-performent | S5 |

---

## 📋 CHECKLIST — Créer un nouveau SYSTEM-REFERENCE

Quand on build un nouveau module, le `SYSTEM-REFERENCE-XXX.md` doit contenir :

```markdown
# 🏷️ SYSTEM-REFERENCE-[NOM]

## 📌 Scope
[Ce que ce système fait — et ne fait PAS]

## 🗄️ Tables Supabase
[Liste exhaustive avec colonnes critiques + RLS]

## 🌐 Routes & Endpoints
[Pages Next.js + API routes]

## 🔧 Lib & Helpers
[Fichiers dans `lib/admin/[module]/` avec leur rôle]

## 🔐 Permissions
[Quels rôles peuvent quoi — `requireAdminRole(...)` patterns]

## ⚙️ ENV VARS
[Variables nécessaires]

## 🚨 Anti-patterns
[Ce qu'il ne FAUT PAS faire — gotchas, bugs passés]

## 🧪 Tests
[Comment tester — fixtures, seed data]

## 📊 Métriques surveillées
[Dashboards / alertes liés]

## 🔗 Dépendances
[Autres systèmes qui dépendent de celui-ci, et vice-versa]

## 📅 Historique
[Date de création + dates de gros refactors]
```

---

## 🔄 PROCESS DE MAINTENANCE

1. **Avant un build** : Lire le SYSTEM-REFERENCE concerné + cet INDEX.
2. **Après un build** : Mettre à jour le SYSTEM-REFERENCE concerné (sections impactées).
3. **Si nouveau module** : Créer son SYSTEM-REFERENCE + l'ajouter à cet INDEX.
4. **Trimestriellement** : Audit complet — quels fichiers sont stale ? Quelles tables ne sont plus utilisées ?

---

## 🎯 PROCHAINES ACTIONS

- [ ] **Semaine 1** : Build V3-1A / V3-1B / V3-1C en parallèle (3 sessions Claude Code)
- [ ] À la fin de chaque session : verifier que le SYSTEM-REFERENCE correspondant est créé/mis à jour
- [ ] Mettre à jour cet INDEX quand nouveaux fichiers SYSTEM-REFERENCE arrivent
- [ ] **Semaine 2** : Créer les 4 prochains SYSTEM-REFERENCE pour Match Engine, Offer Gen, Video Library, Publication Tracking

---

**Maintenu par** : Samy Cloutier
**Last updated** : 2026-05-27
**Branch live** : `master`
**Production URL** : [viralanimal.com](https://viralanimal.com)
