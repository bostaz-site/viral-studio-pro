# Prompt à envoyer à ChatGPT (GPT-4o)

Copie-colle tout ce qui suit dans ChatGPT :

---

## Contexte

Je construis une webapp appelée **Viral Animal** — un outil pour booster la viralité de clips de streamers. L'utilisateur choisit un clip, l'améliore (sous-titres, split-screen, reordering), puis le distribue sur TikTok, YouTube Shorts et Instagram Reels.

Stack : Next.js 14, Tailwind CSS, Supabase, dark mode.

L'app a déjà :
- **Page Browse** : feed de clips trending avec scoring V2 (7 facteurs, tiers mega_viral → dead)
- **Page Enhance** : éditeur avec AI Optimize, sous-titres karaoké, split-screen, mood detection
- **Page Distribution** : clip bank → AI engine → plateformes → bio generator → publish (avec caption engine, tracking simulator, strategy engine, reward engine, creator levels)
- **Settings** : Creator Rank (YouTube API connectée) avec 7 ranks de Newcomer à Legendary

## Ce que je veux builder

Une **page Analytics** qui sert de dashboard gamifié. Le but c'est que chaque fois que l'utilisateur ouvre cette page, il ait un **hit de dopamine** et envie de publier plus.

## Ma vision actuelle (je veux ton avis critique)

### Layout prévu :
1. **Rank Hero** — Grand badge animé avec score /100, XP bar vers le prochain rank, streak badge
2. **Quick Stats Row** — 4 cards (Total Views, Clips Published, Avg Score, Best Clip)
3. **Platform Breakdown** — Card par plateforme (YouTube réel, TikTok/Instagram simulé si pas connecté)
4. **Clip Leaderboard** — Top 5 clips + 3 "needs work" clips
5. **Growth Chart** — Line chart views over time (7j/30j)
6. **Achievements Grid** — Badges locked/unlocked avec progress bars
7. **Weekly Digest** — Comparaison semaine vs semaine dernière

### Éléments dopamine :
- Score counter animé (monte de 0 au score réel)
- Glow animé sur le rank badge
- Achievement unlock animation avec particles
- "You're on fire" states (streak flame, golden borders)
- Micro-progressions ("+12 views since yesterday")

### Sources de données :
- YouTube API : RÉEL (subscribers, views, engagement, growth)
- Clips published : RÉEL (render_jobs DB + localStorage)
- Streaks & achievements : RÉEL (localStorage)
- Views/likes par clip : SIMULÉ (tracking simulator)
- Growth chart : SIMULÉ (basé sur dates réelles + scores)
- TikTok/Instagram stats : SIMULÉ si pas connecté

### Système de rank existant :
| Score | Rank | Emoji |
|---|---|---|
| < 20 | Newcomer | 🌱 |
| 20-39 | Creator | 🥉 |
| 40-59 | Trending Creator | 🥈 |
| 60-79 | Viral Creator | 🥇 |
| 80-89 | Elite Creator | 💎 |
| 90+ | Legendary | 👑 |
| special | Hidden Gem | 🔥 |

## Ce que je te demande

1. **Critique brutale** de ma vision — qu'est-ce qui est nul, redondant, ou manquant ?
2. **Idées dopamine** que j'aurais pas pensé — qu'est-ce qui rendrait cette page addictive ?
3. **Layout alternatif** si tu penses que le mien est pas optimal
4. **Priorisation** — si tu avais 1 jour pour builder le MVP, tu garderais quoi et tu couperais quoi ?
5. **Pièges à éviter** — qu'est-ce qui pourrait rendre cette page fake ou cringe au lieu de motivante ?

Sois brutal et direct. Pas de flatterie. Je veux savoir ce qui est bien et ce qui est de la merde.
