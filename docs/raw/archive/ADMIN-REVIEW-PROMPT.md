# 🔍 ADMIN REVIEW PROMPT — À coller dans ChatGPT

> Copie-colle TOUT ce qui suit dans ChatGPT, puis upload les 2 autres docs (`ADMIN-MEGA-PLAN.md` + `ADMIN-DATABASE-SCHEMA.md`) en pièces jointes.

---

## 🎬 CONTEXTE

Tu es **CTO senior + Head of Growth** d'une scale-up SaaS. Tu as 15 ans d'expérience à scaler des produits B2C/creator-economy de 0 à $50M ARR. Tu as déjà fait foirer 3 startups, donc tu reconnais les red flags de loin.

Je m'appelle **Samy Cloutier**, je suis solo founder de **Viral Animal** (`viralanimal.com`) — un SaaS qui transforme les streams Twitch/Kick/YouTube en clips viraux TikTok/Reels/Shorts. Le produit côté utilisateur est déjà live et fonctionnel.

**Je travaille maintenant sur le côté admin** : la machine interne qui va me permettre de scaler à $50-80k MRR en 12 mois, principalement via cold email à des micro-influenceurs (15k → 50k → 150k emails/mois) et un programme d'affiliation à 30% de commission récurrente.

Je suis **solo dev + solo growth**. Je code 8-10h/jour. Je n'ai pas d'équipe. Je n'ai pas de pognon à brûler. Chaque feature que je build doit avoir un ROI clair.

---

## 📦 CE QUE TU REÇOIS

Deux documents :

1. **`ADMIN-MEGA-PLAN.md`** — La vision produit complète de la console admin : 8 modules (Cold Email Engine, Influencer CRM, Affiliate Management, Pipeline Analytics, AI Automation, Daily Ops Dashboard, Content Operations, Financial Operations), architecture, personas, 7 phases de build, risques.

2. **`ADMIN-DATABASE-SCHEMA.md`** — Le schéma Postgres complet : 12 nouvelles tables, 4 SQL views, RLS policies, triggers, fonctions, 8 migrations dans l'ordre.

---

## 🎯 TA MISSION

Fais une **review brutale, sans complaisance, mais constructive**. Je ne veux pas de "great plan!". Je veux les trous, les angles morts, les sur-engineering, les choses que je vais regretter dans 6 mois.

### Couvre ces 7 angles obligatoires :

---

### 1. 🏗️ Architecture & Choix techniques

- Est-ce que **Next.js + Supabase + Stripe + n8n** est le bon stack pour mes besoins, ou est-ce que j'aurais dû considérer autre chose (Inngest, Trigger.dev, Temporal, Convex) ?
- Le schéma DB est-il **normalisé correctement** ? Quels indexes manquent ? Quels patterns de query vont devenir lents à 100k influencers ?
- La sécurité **RLS + admin role** est-elle suffisante, ou est-ce que je devrais passer par un middleware d'auth séparé ?
- Le HMAC-signed proxy URL pour TikTok — est-ce que c'est solide ou un hack qui va péter ?

---

### 2. 📧 Cold Email Strategy

- 15k → 50k → 150k emails/mois — **est-ce réaliste pour un solo founder** ?
- Combien de **mailboxes** je dois warmup pour envoyer 150k/mois sans flag ? (calcule)
- Mon plan actuel est **Instantly + Zoho** (avec migration prévue vers Maildoso). Quelle est ta recommandation pour 150k/mois avec budget limité ?
- Mes **email templates** et la séquence (Day 0 → Day 3 → Day 7 → Day 14) sont-ils trop agressifs ? Trop mous ?
- Quel **reply rate** je dois viser pour que la machine soit profitable à mon prix ($29-79/mois) ?

---

### 3. 🎯 Programme d'affiliation 30% récurrent

- **30% commission récurrente à vie** — est-ce que c'est suicidaire pour mon CAC payback period ?
- Quels sont les **risques de fraude** que je vais sous-estimer (self-referral, fake signups, etc.) ?
- Stripe Connect Express vs Stripe Connect Standard — pour mon use case (verser des micro-paiements à 1000+ affiliés), lequel ?
- Quel **payout threshold** (minimum à atteindre avant payment) est optimal — $25, $50, $100 ?
- L'attribution **cookie + fingerprint serveur** est-elle suffisante, ou je dois aussi tracker via UTM persistants en DB ?

---

### 4. 🤖 Automation IA (Claude Haiku)

- Mon plan utilise Claude Haiku pour : lead scoring, classification des replies, draft responses, summarization. **Quel est le coût réel** à 150k emails/mois en API calls ?
- Est-ce que je devrais **cacher / batcher** plus agressivement les calls pour réduire les coûts ?
- Pour le **lead scoring**, est-ce que Haiku est suffisant ou je devrais utiliser Sonnet pour le triage initial puis Haiku pour le bulk ?
- Quelles **automations** je dois absolument NE PAS faire (parce que ça va finir en mass-spam ou en mauvaise UX) ?

---

### 5. 🚀 Phasing & Priorisation

J'ai 7 phases (Phase 0 → Phase 7). Je suis solo. Je peux mettre **20-30h/semaine sur l'admin** sur les 6 prochaines semaines.

- Est-ce que mon ordering est correct ?
- Quelles features peuvent être **delayed 6 mois** sans impact sur le revenue ?
- Quelles features ne sont **pas dans le plan mais devraient être en P0** ?
- Quelles features sont **du sur-engineering** que je devrais retirer complètement ?

---

### 6. 💰 Économie unitaire & monétisation

- Mon pricing : **$29 Pro / $79 Studio** — est-ce trop bas pour un produit creator-economy avec ce niveau de valeur ?
- Si je veux $50k MRR en 12 mois, combien de **clients payants** je dois atteindre ? Est-ce réaliste avec mon funnel cold email ?
- Quelles **expansion revenue tactics** je devrais ajouter dans le plan (upsells, addons, usage-based) ?
- Est-ce que je devrais avoir un **plan enterprise** ($299+/mois) pour les agences ?

---

### 7. 🔥 Red flags & angles morts

- Quelles sont les **3 erreurs les plus probables** que je vais faire dans les 90 prochains jours ?
- Quels **legal risks** je sous-estime (CAN-SPAM, GDPR pour emails, affiliate disclosure, etc.) ?
- Quels **competitor moats** je n'ai pas considérés (OpusClip, Captions, Submagic) ?
- Quels signaux indiqueront que je dois **pivoter ou tuer cette stratégie** ?

---

## 📋 FORMAT DE TA RÉPONSE

Structure ta review **exactement comme ça** :

```
═══════════════════════════════════════════
🎯 EXECUTIVE SUMMARY (5 lignes max)
═══════════════════════════════════════════
[Verdict global : plan solide / risqué / suicidaire / surdimensionné]

═══════════════════════════════════════════
🟢 TOP 3 FORCES DU PLAN
═══════════════════════════════════════════
1. [Force #1] — pourquoi
2. [Force #2] — pourquoi
3. [Force #3] — pourquoi

═══════════════════════════════════════════
🔴 TOP 3 CONCERNS MAJEURS
═══════════════════════════════════════════
1. [Concern #1] — pourquoi c'est grave + comment fixer
2. [Concern #2] — pourquoi c'est grave + comment fixer
3. [Concern #3] — pourquoi c'est grave + comment fixer

═══════════════════════════════════════════
🟡 TOP 3 FEATURES MANQUANTES
═══════════════════════════════════════════
1. [Feature manquante] — pourquoi essentielle
2. [Feature manquante] — pourquoi essentielle
3. [Feature manquante] — pourquoi essentielle

═══════════════════════════════════════════
🔧 REVIEW PAR ANGLE (1-7)
═══════════════════════════════════════════

### 1. Architecture & Tech
[Détaillé, avec recommandations concrètes]

### 2. Cold Email Strategy
[Détaillé, avec chiffres]

### 3. Programme d'affiliation
[Détaillé, avec calculs CAC/LTV]

### 4. Automation IA
[Détaillé, avec estimations coûts]

### 5. Phasing & Priorisation
[Reorder concret si nécessaire]

### 6. Économie unitaire
[Pricing recommendations]

### 7. Red flags & angles morts
[Liste sans filtre]

═══════════════════════════════════════════
✅ ROADMAP RECOMMANDÉE (révisée)
═══════════════════════════════════════════
[Réordonne les 7 phases si nécessaire, avec timeline réaliste pour un solo founder]

═══════════════════════════════════════════
🎬 NEXT 7 DAYS (actionable)
═══════════════════════════════════════════
[Liste exacte des choses à faire cette semaine, dans l'ordre]
```

---

## 🚨 RÈGLES D'OR DE TA REVIEW

1. **Sois brutal mais constructif** — Si quelque chose va échouer, dis-le clairement, puis donne l'alternative.
2. **Chiffres > opinions** — Donne des coûts réels, des taux de conversion réalistes, des calculs.
3. **Pas de bullshit corporate** — Pas de "synergies", pas de "leverage value creation". Parle comme un opérateur.
4. **Pense scale + survie** — Toutes tes recos doivent fonctionner pour un solo founder broke ET tenir jusqu'à $1M ARR.
5. **Challenge tout** — Y compris la stratégie de base (cold email à 150k/mois est-elle même la bonne approche ?).
6. **Sois spécifique** — "Améliore le scoring" = useless. "Le scoring devrait être 0-100 basé sur (followers × engagement_rate × niche_match), pondéré par recency" = utile.

---

## ❓ 22 QUESTIONS PRIORITAIRES À RÉPONDRE

Dans ta review, réponds explicitement à ces 22 questions (numérote-les) :

1. Quel est le bon ordre de build pour les 6 prochaines semaines ?
2. Combien de mailboxes je dois warmup pour 150k emails/mois ?
3. Maildoso vs Instantly vs SmartLead vs Lemlist — pour mon use case ?
4. Stripe Connect Express ou Standard pour les affiliés ?
5. Le pricing $29/$79 est-il optimal ? Si non, quel pricing ?
6. Dois-je ajouter un plan Enterprise ($299+) ?
7. 30% commission affiliée à vie — soutenable ou trop généreux ?
8. Quelle est mon CAC payback period réaliste ?
9. Reply rate cible pour rentabiliser le cold email ?
10. Lead scoring : Haiku, Sonnet ou ML maison ?
11. Quels indexes Postgres manquent dans le schéma ?
12. RLS suffit ou je dois rajouter un layer middleware ?
13. n8n vs Inngest vs Trigger.dev pour les workflows ?
14. Quel payout threshold pour les affiliés ?
15. Comment je préviens la fraude affiliée ?
16. Quelles features de l'admin plan dois-je TUER ?
17. Quelles features manquent en P0 ?
18. Quels legal risks je sous-estime ?
19. Quels competitor moats je n'ai pas vus ?
20. À quel signal je dois pivoter ?
21. Mon plan content/SEO est-il suffisant en parallèle du cold email ?
22. Dois-je faire une levée de fonds, ou bootstrap est viable jusqu'à $50k MRR ?

---

## 🎤 TON STYLE

- Direct, sans filtre, mais respectueux
- Tu peux dire "c'est de la merde" si c'est vrai, mais explique pourquoi
- Tu peux dire "c'est du génie" si c'est vrai, mais c'est rare
- Parle français (Québec OK), avec termes techniques en anglais quand approprié
- Pas de disclaimers chiants ("je ne suis qu'une IA blablabla")

---

**GO. Donne-moi la review complète maintenant.**
