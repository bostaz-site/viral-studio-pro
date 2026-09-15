# 🎨 DESIGN POLISH — Prompt Claude Code

> Session dédiée pour appliquer la palette finale (Or + Cyan) à toute l'app Viral Animal.
> À lancer en parallèle des autres prompts (N/O/P).
> Durée estimée : 2-3h.

---

## 🎯 PROMPT — COPY-PASTE DANS CLAUDE CODE

```
CONTEXTE
========
Tu travailles sur Viral Animal (https://viralanimal.com), une SaaS Next.js 14.
Le founder a décidé d'une palette de marque finale : Doré (Or) + Cyan.

CHANGEMENTS DÉJÀ FAITS (NE PAS RE-TOUCHER) :
- Logo loup en gradient or métallique (FDE68A → F59E0B → B45309) ✅
- Wordmark "ANIMAL" en amber-500 (was orange-500) ✅
- Sidebar active states (user + admin) en amber-400 ✅

À FAIRE : Appliquer la palette à TOUTE l'app.

Repo: C:\Users\samyc\Projects\Clips Project\
Branch: feature/admin-mailbox-health (continuer dessus, tout local)

PALETTE FINALE
==============

🌟 DORÉ (amber-500 #F59E0B / amber-400 #FBBF24) — ACTION/SUCCESS/MONEY
Usage :
- CTAs primaires (Upload, Generate, Publish, Upgrade, Send, Save, Submit)
- Active states sidebar (déjà fait)
- Velocity badges "Hot" et "Viral"
- Success badges (Onboarded, Active, Paying)
- Plan badge (Pro, Studio)
- Money / earnings displays
- Upgrade prompts

💎 CYAN (cyan-500 #06B6D4 / cyan-400 #22D3EE) — DATA/TECH/INFO
Usage :
- Charts Recharts (TOUS les graphiques analytics)
- Creator rank badge (Scout/Hunter/Alpha/Apex/Legend)
- Liens dans texte ([Voir plus](#))
- Hover effects subtils
- Info badges (ℹ️ tooltips)
- Progress bars (loading/completion)
- Stats counters neutres (qui ne sont pas du $)
- Secondary CTAs ("Learn more", "View details")

🔴 ROUGE (red-500) — ERREURS/DANGER (garder comme c'est)
🟢 VERT (green-500) — HEALTHY/SUCCESS NEUTRAL (garder)
🟠 ORANGE (orange-500) — WARNINGS (garder)
⚫ DARK BG — Background (garder)

DIRECTIVE PRINCIPALE
====================
Cherche tous les CTAs primaires (className contenant "bg-primary", "bg-cyan", "bg-blue",
"bg-violet", "bg-purple", "bg-indigo" ET qui ne sont pas des charts/data viz)
→ Replace par les classes amber-500/amber-400 équivalentes.

MAIS NE TOUCHE PAS :
- Composants charts Recharts (data visualization)
- Creator rank badge composants
- Code des modals analytics
- Inline styles dans les graphiques

MISSION EN 6 PHASES
====================

PHASE 1 — AUDIT
================
Run un grep pour identifier les fichiers à modifier :

A) Cherche tous les fichiers avec couleurs primary/cyan/blue/violet :
   grep -rn "bg-primary\|bg-cyan\|bg-blue\|bg-violet\|bg-purple\|bg-indigo" app/ components/
   grep -rn "text-primary\|text-cyan\|text-blue\|text-violet" app/ components/

B) Sépare les usages en 3 catégories :
   - CTAs primaires (Button components, onClick handlers, action buttons) → À CHANGER
   - Charts/Data viz (Recharts, lib/charts/) → NE PAS TOUCHER
   - Liens/text/info → GARDER cyan (ou changer en cyan si actuellement bleu/violet)

C) Liste tous les fichiers candidates dans un draft mental.

PHASE 2 — USER-FACING PAGES
============================
Audit + update ces pages prioritaires :

1. app/(dashboard)/page.tsx (Browse)
2. app/(dashboard)/enhance/page.tsx ou /enhance/[clipId]/page.tsx
3. app/(dashboard)/distribution/page.tsx
4. app/(dashboard)/analytics/page.tsx ⚠️ ATTENTION charts = cyan, gardés
5. app/(dashboard)/settings/page.tsx ou /(dashboard)/settings/*
6. app/login/page.tsx
7. app/signup/page.tsx (si existant)
8. app/page.tsx (landing si existant)

Pour chaque page, replace :
- Button primary actions → bg-amber-500 hover:bg-amber-600 text-amber-950
- Active states (qui ne sont pas charts) → text-amber-400 bg-amber-500/10

PHASE 3 — ADMIN PAGES
=====================
Audit + update ces pages :

1. app/(dashboard)/admin/page.tsx (Morning Dashboard si déjà buildé)
2. app/(dashboard)/admin/influencers/page.tsx + [id]/page.tsx
3. app/(dashboard)/admin/inbox/page.tsx + components
4. app/(dashboard)/admin/campaigns/page.tsx + new/page.tsx
5. app/(dashboard)/admin/affiliates/page.tsx + [id]/page.tsx
6. app/(dashboard)/admin/mailboxes/* (si Prompt K déjà mergé)
7. app/(dashboard)/admin/watchdog/page.tsx
8. app/(dashboard)/admin/payouts/page.tsx (si Prompt O déjà mergé)

Note : Sidebar admin déjà en doré, ne touche pas le sidebar.

PHASE 4 — COMPONENTS
====================
Audit + update ces composants partagés :

1. components/ui/button.tsx (shadcn Button) :
   - Vérifie que variant="default" utilise amber
   - Si actuellement primary (cyan/blue), change pour amber

2. components/trending/velocity-badge.tsx :
   - "Viral" / "Hot" / "Trending" → doré
   - "Rising" / "Active" → reste
   - "Slow" → gris/orange

3. components/trending/rank-badge.tsx :
   - GARDE les couleurs actuelles (badges decorative)

4. components/trending/notification-bell.tsx :
   - Notification dot → amber

5. components/brand/viral-animal-logo.tsx :
   - DÉJÀ FAIT, ne pas re-toucher

PHASE 5 — CSS VARIABLES
========================
Si le projet utilise des CSS variables custom :

1. Vérifie app/globals.css ou styles/globals.css
2. Si --primary-color est défini en bleu/cyan, considère :
   - Option A : Change --primary-color en amber (impact global)
   - Option B : Garde --primary-color tel quel, override seulement sur les CTAs
   
   → Option B est plus sûre. Ne touche pas aux variables globales.

PHASE 6 — DOCUMENTATION
========================
Crée un nouveau fichier SYSTEM-REFERENCE-DESIGN-SYSTEM.md avec :

# Design System — Viral Animal

## Palette finale
- **Or (Amber)** : action, success, money
  - amber-400 (#FBBF24) : active states
  - amber-500 (#F59E0B) : CTAs primary
  - amber-600 (#D97706) : hover state
  - Gradient logo : #FDE68A → #F59E0B → #B45309

- **Cyan** : data, tech, info
  - cyan-400 (#22D3EE) : info badges
  - cyan-500 (#06B6D4) : charts, links, secondary CTAs
  - cyan-600 (#0891B2) : hover

- **Rouge** : erreurs (red-500)
- **Vert** : healthy/success neutral (green-500)
- **Orange** : warnings (orange-500)

## Règles d'application
[Tableau des règles par type d'élément]

## Pages auditées
- ✅ Browse
- ✅ Enhance
- ✅ Distribution
- ✅ Analytics (charts gardés cyan)
- ✅ Settings
- ✅ Admin pages

## Composants partagés updated
[Liste]

## Composants intentionnellement non-touchés
- Recharts (data visualization)
- Creator rank badges (decorative)
- Velocity badges Rising/Slow (semantic)

DEFINITION OF DONE
==================
- [ ] Phase 1 audit complétée
- [ ] User-facing pages updated (8 pages)
- [ ] Admin pages updated (10+ pages)
- [ ] Components partagés updated
- [ ] CSS variables vérifiées
- [ ] SYSTEM-REFERENCE-DESIGN-SYSTEM.md créé
- [ ] Build local passe (npm run build)
- [ ] Aucun broken styling visuel (test visuel rapide)

ANTI-PATTERNS
=============
❌ Ne PAS toucher aux Recharts (charts en cyan c'est volontaire)
❌ Ne PAS changer les --primary-color globales (override locally)
❌ Ne PAS changer rouge/vert/orange (sémantiques)
❌ Ne PAS toucher au logo (déjà fait)
❌ Ne PAS toucher au sidebar (déjà fait)
❌ Ne PAS faire un find-and-replace aveugle de "primary" → "amber" (casse les charts)

OUTPUT
======
1. Liste des fichiers modifiés (récapitulatif)
2. SYSTEM-REFERENCE-DESIGN-SYSTEM.md créé
3. Confirmation que npm run build passe
4. Quelques avant/après notable (description)
```

---

## 📋 Comment utiliser

1. **Copy le bloc** entre les ```
2. **Ouvre une nouvelle session Claude Code**
3. **Colle le prompt**
4. Laisse-le tourner ~2-3h

---

## ⚠️ Important — Lance-le en PARALLÈLE avec N/O/P

Tu peux avoir **4 sessions Claude Code en parallèle** maintenant :
- 🌅 Prompt N — Morning Dashboard
- 💼 Prompt O — Stripe Connect + Payouts
- 📊 Prompt P — Analytics + Cost Tracker
- 🎨 **Prompt Design Polish** (celui-ci)

**Pas de conflits** parce que :
- N modifie `app/(dashboard)/admin/page.tsx` (la home admin)
- O modifie `app/(dashboard)/admin/payouts/` et `app/partner/`
- P modifie `app/(dashboard)/admin/analytics/` et `app/(dashboard)/admin/costs/`
- Design Polish change **les couleurs** dans tous les fichiers existants

Le Design Polish va modifier les fichiers existants (Browse, Enhance, etc.) mais ne crée pas de nouveaux fichiers en conflit avec N/O/P.

---

## 🎬 Action

**Tu lances les 4 prompts en parallèle (N, O, P, Design Polish) ?**

Ça va te donner en 2-3h :
- ✅ Morning Dashboard (THE page)
- ✅ Stripe Connect + Auto Payouts
- ✅ Analytics + Cost Tracker (5 pages)
- ✅ Design Polish (palette finale appliquée partout)

**= Vague 2 100% complète + Design final.**

Ramène-moi les résultats quand t'as fini les 4 sessions.