# 🔍 Acquisition System Review Prompt — Pour ChatGPT

> Copy-colle TOUT ce qui suit dans ChatGPT, puis upload `ACQUISITION-SYSTEM-MASTER-PLAN.md`.

---

## 🎬 CONTEXTE

Tu es **CTO senior + Head of Growth + Expert en Affiliate Marketing**. 20 ans d'expérience scaling SaaS de 0 à $50M ARR via cold email + influencer marketing.

Je m'appelle **Samy Cloutier**, je suis solo founder de **Viral Animal** (`viralanimal.com`) — un SaaS qui transforme les streams Twitch/Kick/YouTube en clips viraux pour TikTok/Reels/Shorts.

**Mon admin hub est déjà LIVE en production** avec :
- CRM influenceurs complet (14 statuts pipeline)
- Inbox unifié + reply composer
- Stripe LIVE corporate
- Webhook idempotency + commission ledger immuable
- AI Triage (Claude Haiku classification + lead scoring + drafts)
- Watchdog 24/7
- Partner Portal avec magic link + Stripe Connect Express
- Morning Dashboard + Analytics suite + Cost Tracker
- Compliance CASL/GDPR + suppression list
- Mailbox Health monitoring

**Ce que je veux maintenant** : Builder LE système d'acquisition le plus efficace au monde pour onboarder des influenceurs comme affiliés.

---

## 🎯 LA VISION

**Principe directeur** : ZÉRO effort pour l'influenceur.

L'influenceur reçoit un email avec :
1. **Sa vidéo de pub prête à reposter** (que j'ai déjà filmée, matchée à sa niche)
2. **Son code promo unique** pré-généré
3. **Sa caption optimisée**
4. **Un landing page perso** où il télécharge tout en 1 click

Il fait juste **react + repost**. Pas besoin de filmer quoi que ce soit.

---

## 📦 CE QUE TU REÇOIS

`ACQUISITION-SYSTEM-MASTER-PLAN.md` — Mon plan détaillé de **8 modules** :

1. **Scraper Influenceurs Affiliate-Friendly** (YouTube/TikTok/Instagram)
2. **AI Affiliate Probability Score** (Claude analyse bio + posts)
3. **CRM Ingestion** (déjà existant)
4. **Vidéos Bibliothèque** (admin upload + tags)
5. **Match Algorithm vidéo ↔ influenceur** (AI matching)
6. **Personalized Offer Generator** (email perso par lead)
7. **One-Click Reposting Kit** (`/partner/repost/[handle]`)
8. **Publication Tracking + Auto Follow-Up**

---

## 🎯 TA MISSION

Fais une **review brutale, sans complaisance, mais constructive**. Je ne veux pas de "great plan!". Je veux les trous, les angles morts, les risques juridiques, les choses que je vais regretter dans 6 mois.

### Couvre ces 8 angles obligatoires :

---

### 1. 🧠 Strategy & Positioning

- Est-ce que l'angle "zero effort for influencer" est aussi disruptif que je le pense, ou est-ce que ça existe déjà (concurrents) ?
- Quels sont les segments d'influenceurs qui vont être les plus réceptifs vs ceux qui vont rejeter ?
- Pourquoi un influenceur qui gagne déjà $X/mois avec d'autres affiliates accepterait MA proposition ?
- Comment je différencie mon offre vs les 50 autres SaaS qui propose 20-30% commission ?

---

### 2. 🕷️ Scraper — Faisabilité Technique

- **YouTube** : Discovery via Data API → réaliste à scale (10k/mois) ?
- **TikTok** : sans API officielle, comment vraiment scraper en masse ? Apify ($50/mo) vs custom (risque TOS) ?
- **Instagram** : pareil — Graph API est très restrictive. Comment faire en pratique ?
- **Hashtag scraping** : durabilité ? TikTok change ses anti-scraping régulièrement.
- Quels sont les **risques légaux** (RGPD, CCPA, TOS) si je scrape massivement ?

---

### 3. 🤖 AI Affiliate Probability Score — Précision

- Mon prompt Claude est-il bien designed ?
- Comment j'évite les biais (genre tous les anglos US scorés plus haut que les FR Canada) ?
- Quel reply rate je peux espérer avec leads scorés > 80 vs 60 vs 40 ?
- Devrais-je valider le scoring sur 50 leads avant de scale ?
- Quels signals additionnels je devrais ajouter ?

---

### 4. 🎬 Match Algorithm — Risque de Mismatch

- Algorithme basé sur des règles vs ML model — lequel est plus robuste pour 100 vidéos × 10k influenceurs ?
- Comment je gère le cas où aucune vidéo ne matche bien ? (fallback vidéo générique ? ou skip ?)
- Manuel override par admin — combien de temps ça va prendre à scale ?
- Comment éviter qu'une même vidéo soit envoyée à 500 influenceurs (saturation TikTok algo) ?

---

### 5. 📧 Personalized Offer Generator — Conversion

- Mon template email est-il optimal ?
- Les variables dynamiques sont-elles assez profondes pour vraiment se démarquer ?
- Comment je m'assure que `{{recent_topic}}` n'est pas trop générique (genre "ton dernier post" — boring) ?
- Devrais-je inclure une **prévisualisation de la vidéo** direct dans l'email (GIF preview ou link to thumbnail) ?
- Quel **subject line** convertit le mieux pour ce type d'offre ?
- Combien de **variantes A/B** je devrais tester ?

---

### 6. 🎁 Reposting Kit — UX & Friction

- Le flow `/partner/repost/[handle]` est-il vraiment "1 click" ?
- Mobile-first ? (la majorité des creators sont sur mobile)
- Comment j'évite le "I'll do it later" et personne ne reposte vraiment ?
- Social proof intégré ("47 others reposted this") — éthique ? Juste ?
- Suggestion timestamps "react at 0:03" — est-ce que ça aide vraiment ou c'est trop prescriptif ?
- Devrais-je ajouter un **deadline / urgency** ("Code expires in 7 days") ?

---

### 7. 📊 Publication Tracking — Réaliste ?

- Method A (form manuel) vs Method B (scraping auto) — quel taux de submission je peux espérer ?
- Si 50% des influenceurs ne submit pas leur post, comment je détecte vraiment ?
- yt-dlp pour scraper leurs derniers posts — durabilité ? Frequency check ?
- Quelles métriques je dois vraiment tracker pour optimiser (views, likes, conversions, retention) ?
- Quand est-ce qu'un influenceur est considéré "inactif" et je dois le re-engager ?

---

### 8. 🔥 Risques Critiques + Compliance

- **Affiliate disclosure** : Les influenceurs sont-ils légalement obligés de dire "sponsored" / "ad" ? Comment je m'assure que ma caption suggérée respecte ça ?
- **TikTok / Instagram TOS** : Le repost de contenu sponsorisé est-il OK ? Y a-t-il des règles spécifiques ?
- **GDPR / Loi 25 Québec** : Quels risques de scraper massivement des emails sans consentement ?
- **Spam laws CAN-SPAM / CASL** : Mon outbound est-il compliant ?
- **Stripe Connect** : Si je paie des affiliés à l'international, quels risques ?
- **Fraud** : Un influencer peut-il créer des fake users avec son propre code pour gagner commission ?
- **Réputation risk** : Si 50 influenceurs postent la MÊME vidéo, TikTok algo va-t-il la pénaliser ?

---

## 📋 FORMAT DE TA RÉPONSE

Structure ta review **exactement comme ça** :

```
═══════════════════════════════════════════
🎯 EXECUTIVE SUMMARY (5 lignes max)
═══════════════════════════════════════════
[Verdict global : génial / risqué / overengineered / pas assez ambitieux]

═══════════════════════════════════════════
🟢 TOP 3 FORCES DU PLAN
═══════════════════════════════════════════
1. [Force #1] — pourquoi c'est une vraie innovation
2. [Force #2] — pourquoi
3. [Force #3] — pourquoi

═══════════════════════════════════════════
🔴 TOP 3 CONCERNS MAJEURS
═══════════════════════════════════════════
1. [Concern #1] — pourquoi grave + fix
2. [Concern #2]
3. [Concern #3]

═══════════════════════════════════════════
🟡 TOP 3 OPPORTUNITÉS MANQUÉES
═══════════════════════════════════════════
1. [Quelque chose que je devrais ajouter]
2. [...]
3. [...]

═══════════════════════════════════════════
🔧 REVIEW PAR ANGLE (1-8)
═══════════════════════════════════════════

### 1. Strategy & Positioning
[Détaillé]

### 2. Scraper Faisabilité
[Détaillé avec recos sur APIs alternatives]

### 3. AI Scoring Précision
[Détaillé avec prompt suggestions]

### 4. Match Algorithm
[Détaillé]

### 5. Personalized Offer
[Détaillé avec subject lines suggérés]

### 6. Reposting Kit UX
[Détaillé]

### 7. Publication Tracking
[Détaillé]

### 8. Compliance & Risques
[Détaillé avec checks légaux]

═══════════════════════════════════════════
✅ ROADMAP RÉVISÉE (5 phases sur 6 semaines)
═══════════════════════════════════════════
[Réordonner si besoin]

═══════════════════════════════════════════
🎬 NEXT 7 DAYS (actionable)
═══════════════════════════════════════════
[Liste exacte des choses à faire cette semaine]

═══════════════════════════════════════════
💡 IDÉES BONUS
═══════════════════════════════════════════
- [Ideas qui pourraient transformer le plan en killer feature]
```

---

## 🚨 RÈGLES D'OR

1. **Sois brutal mais constructif** — Si une stratégie va échouer, dis-le + alternative
2. **Chiffres > opinions** — Reply rates réalistes, conversion rates, coûts
3. **Pas de bullshit corporate** — Parle comme un opérateur qui a vu 100 startups
4. **Pense solo founder + survie** — Toutes recos doivent fonctionner pour 1 personne broke
5. **Challenge les hypothèses fondamentales** — Si "zero effort" est un mirage, dis-le
6. **Sois spécifique** — Pas "améliorer le scoring" mais "ajoute X signal + voici le prompt"

---

## ❓ 12 QUESTIONS PRIORITAIRES À RÉPONDRE

Dans ta review, réponds explicitement à ces 12 questions (numérote-les) :

1. Le scraper YouTube via Data API → réaliste à 1000 leads/jour ?
2. TikTok/Instagram scraping sans API → Apify ($50) ou skip pour V1 ?
3. AI Affiliate Score 0-100 → je dois valider sur combien de leads avant de me fier ?
4. Match Algorithm rule-based → suffisant ou je dois training un ML model ?
5. Combien de vidéos pub uniques je dois avoir dans la bibliothèque pour 1000 leads ?
6. Mon email template est-il optimisé ou il faut le réécrire complètement ?
7. Reply rate attendu avec ce niveau de personnalisation ?
8. Acceptance rate attendu (passer de "interested" à "onboarded") ?
9. Post rate attendu (passer de "onboarded" à "posted") ?
10. Combien de mailboxes je dois warmup pour ce volume ?
11. Faut-il ajouter une étape "demo call" avant onboarding ou go direct ?
12. Combien de temps avant de voir mon premier paying user via cette machine ?

---

## 🎤 TON STYLE

- Direct, sans filtre, mais respectueux
- Dis "c'est de la merde" si c'est vrai, mais explique pourquoi + alternative
- Tu peux dire "c'est du génie" si c'est vrai, mais c'est rare
- Parle français (Québec OK), termes techniques en anglais OK
- Pas de disclaimers chiants

---

**GO. Donne-moi la review complète maintenant.**
