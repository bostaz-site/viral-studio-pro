# 🎨 Concept — Viral Animal

> Ce que Viral Animal EST aujourd'hui. Pas où on va — où on EST.

---

## 🎯 La promesse en 1 phrase

> **"Choisis un clip, on le rend viral, tu fais des vues — sans skills, en 30 secondes."**

C'est tout. Si une feature ne sert pas cette promesse, elle n'a pas sa place.

---

## 💡 Ce que Viral Animal fait concrètement

Une webapp simple qui fait **2 choses** que personne ne combine encore :

### Mode 1 — Reposter (le moteur principal)
Tu choisis un clip dans notre **bibliothèque de clips de streamers populaires** (Twitch, Kick) → notre AI le rend viral (sous-titres karaoké, split-screen, hook au début, format vertical 9:16, crédit auteur) → tu publishes 1 clic sur TikTok/Reels/Shorts.

### Mode 2 — Créateur (le moteur secondaire)
Tu uploades ton propre clip → même pipeline → tu publishes.

**Output identique dans les 2 cas :** une vidéo prête à viraliser, avec un Viral Score expliqué pour que tu saches pourquoi ça va marcher.

---

## 👤 Target user (un seul, focus sniper)

### Le Jeune Clipper (15-25 ans)

**Qui il/elle est :**
- Scroll TikTok / Reels / Shorts plusieurs heures par jour
- Voit des accounts de clips streamers qui font des millions de vues
- Voit le clip farming comme un **side hustle légitime**
- Veut faire **du cash + de la clout** rapidement
- Pas de patience pour apprendre Premiere Pro
- Pas de budget pour Opus Clip ($30+/mo) sans avoir testé
- A un iPhone + ordinateur basique

**Ce qu'il/elle veut :**
- Trouver des bons clips **sans scroller pendant des heures**
- Les éditer **en 30 secondes max**
- Publisher **partout** en 1 clic
- Voir ses **stats grimper**
- Faire son **premier $100 dans le mois**

**Sa frustration aujourd'hui :**
- Les outils existants sont chers, complexes, pour pros
- Trouver les clips qui vont buzzer = chronophage et aléatoire
- Le download/édition manuel = friction énorme
- Pas de feedback sur "pourquoi mon clip marche pas"

**Notre angle :** On compresse tout ça en **un outil aussi simple que Snapchat**, avec le **brain d'un coach viral derrière**.

---

## 🛠️ Les features qu'on a aujourd'hui (état actuel)

### Acquisition / Découverte
- **Browse Clips Trending** : 1000+ clips de streamers, refresh toutes les 5 min
- **Velocity Score V2** : 7 facteurs (Momentum, Authority, Engagement, Recency, EarlySignal, Format, Saturation)
- **Tiers visuels** : Mega Viral, Viral, Hot, Rising, Normal, Dead
- **Filtres niche** : IRL, FPS, MOBA, etc.

### Création
- **Upload propre clip** (MP4)
- **Choisir depuis bibliothèque** (Twitch URL → notre VPS télécharge proprement)
- **Format auto-conversion** : 9:16, 16:9, 1:1

### Enhance Editor
- **Sous-titres karaoké** : 10 styles (Hormozi, MrBeast, Neon, Minimal, etc.)
- **Animations captions** : highlight, word-pop, bounce, shake, typewriter, glow
- **Split-screen** : top-bottom avec B-roll (Minecraft, parkour, sable, slime)
- **Hook** : text overlay au début, 4 styles (Choc, Curiosity, Suspense, Shock)
- **Streamer tag** : crédit auteur intégré proprement
- **Smart Zoom** : micro, dynamic, follow
- **Audio Enhance** : loudnorm
- **Auto-Cut** : silence removal

### AI Layer (le cerveau)
- **AI Mood Detection** (Claude Haiku) : analyse le clip → choisit Rage/Funny/Drama/Wholesome/Hype/Story
- **6 mood presets** : chaque preset = combo optimisé (style + emphasis + zoom + hook + reorder + auto-cut)
- **Make It Viral button** : applique le bon preset automatiquement
- **Manual mood override** : 6 boutons si user veut choisir

### Distribution
- **TikTok Direct Post** (en review)
- **YouTube Shorts** (OAuth verified)
- **Instagram Reels** (en review)
- **Crédits auteur** auto en description

### Account / Growth
- **Creator Rank System** : score 0-100 + 7 tiers (Newcomer → Legendary)
- **YouTube stats sync** : Performance, Engagement, Growth, Audience, Consistency
- **Sync 1x/24h** (Phase 1)
- **Hidden Gem detection** : Performance > 80 + Audience < 55

### Monétisation
- **Free tier** : 3 vidéos/mois, watermark, 1 plateforme
- **Pro** ($29/mo) : illimité, sans watermark, toutes plateformes
- **Studio** ($79/mo) : + analytics, Remake This illimité, scheduling
- **Affiliate System** : 20-30% commission récurrente

### Système interne (notre edge)
- **21 audit agents** qui scannent le produit chaque nuit
- **Cross-finding pattern detection** (compresse les findings)
- **ROI Prediction + Outcome Measurement** (mesure 7j après ship)
- **Auto-Fix Cycle** (Discord Accept → PR auto)
- **The Lab V3** : Product Decision Intelligence System (multi-LLM deep dives)
- **Knowledge Graph** : 72+ nodes, relations entre features et goals

---

## 🚫 Non-goals — Ce qu'on fait PAS

On dit NON à :

### Côté produit
- ❌ **Éditeur vidéo complet** (on fait UN truc : viraliser un clip court — pas remplacer Premiere)
- ❌ **Long-form content** (on est short-form only, 60s max)
- ❌ **Live editing** (on est asynchrone, pas live)
- ❌ **Outil pour streamers seulement** (trop niche — on cible les clippers/reposters)
- ❌ **Multi-langue dans Phase 1** (anglais + français, le reste après)
- ❌ **Mobile app native** (web app suffit pour Phase 1, native après PMF)

### Côté business
- ❌ **Sales team / enterprise** (on est self-serve, product-led growth)
- ❌ **Ads platform** (Anthropic policy : no ads in products)
- ❌ **Crypto / NFT** (pas notre crowd)
- ❌ **Long onboarding** (1 min max, sinon ils churn)
- ❌ **Lifetime deals** (kill la viabilité long terme)

### Côté technique
- ❌ **Microservices** (solo founder, garde simple)
- ❌ **Custom infrastructure** (Netlify + Supabase + Railway suffit)
- ❌ **Custom ML models** (on utilise Claude/OpenAI pour AI layer)

---

## 🏗️ Architecture en bref

```
Frontend (Next.js 14 App Router + Tailwind + Supabase Auth)
    ↓
API Routes (Next.js)
    ↓
Supabase (Postgres + Storage + Auth)
    +
Railway VPS (FFmpeg render + cron jobs)
    +
Claude API (Mood detection, audit agents, The Lab)
    +
Twitch API + Kick API + YouTube Data API
```

**Stack :** TypeScript strict partout, server components par défaut, RLS sur toutes les tables user, fire-and-forget pattern pour les renders longs.

---

## 📊 État actuel (juin 2026)

| Composant | État |
|---|---|
| Browse trending clips | ✅ Live |
| Enhance editor | ✅ Live (en polish continu) |
| Upload propre clip | ✅ Live |
| AI Mood Detection | ✅ Live |
| TikTok Direct Post | 🟡 En review |
| YouTube Shorts | ✅ Live |
| Instagram Reels | 🟡 En review |
| Stripe billing | ✅ Live |
| Affiliate System | ✅ Live |
| Creator Rank | ✅ Live (Phase 1 YouTube) |
| 21 audit agents | ✅ Live (Railway cron) |
| The Lab V3 | 🆕 Just migrated |
| Real-Time Streamer Monitoring | 🔴 Phase 2 (le moat ultime) |
| Users payants | 0 (pré-launch) |

---

## 🎬 User flow type (le golden path)

```
1. User arrive sur landing → signe up gratuit (10s)
2. Onboarding (1 min) → vois trending clips
3. Click sur un clip qui buzz → enhance editor s'ouvre
4. Click "Make It Viral" → mood détecté + preset appliqué (5s)
5. Preview → click "Render" (30s)
6. Render done → click "Publish to TikTok" (5s)
7. Vidéo postée → user attend les vues
8. 24h après → notification "ton clip a fait 5K vues"
9. User revient → fait un autre clip
10. Mois 1 → user atteint Pro plan ($29)
```

**Time-to-first-clip-rendered : < 90 secondes.** C'est notre métrique core.

---

## 💎 Ce qui nous rend unique aujourd'hui

Si quelqu'un demande "pourquoi pas Opus Clip ?", la réponse :

1. **On clippe DEPUIS la bibliothèque streamers, pas que tes uploads**
   → Tu n'as pas besoin d'avoir du contenu pour commencer

2. **AI Mood Detection automatique**
   → Tu choisis pas les paramètres, on les choisit pour toi en fonction du clip

3. **Pricing accessible** ($29 vs $49 Opus, free tier généreux)
   → Tu testes avant de payer

4. **Niche streamers** (Twitch culture, gaming, IRL)
   → On parle ta langue, on connaît ce que tu veux

5. **Le Hunter** (détection clips avant qu'ils explosent)
   → Tu trouves les pépites avant tout le monde

---

## 🧬 Principes de design

- **Dark mode par défaut** (vibe Gen Z, gaming culture)
- **Desktop-first** (les jeunes utilisent leur ordi pour clipper)
- **Mobile-friendly** (Discord/dashboard accessibles mobile)
- **Loading states partout** (pas de blank screens)
- **Couleurs Viral Animal** : Electric Blue `#00E1FF` + Deep Navy `#0A0E27`
- **Ton de voix** : direct, brut, jeune, "no bullshit"

---

**Last updated**: 2026-06-18
**Version**: 1.0 (initial)
**Next review**: Après le 1er cycle Lab OU après changements majeurs au produit
