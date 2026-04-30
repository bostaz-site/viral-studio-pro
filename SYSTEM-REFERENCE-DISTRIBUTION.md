# SYSTEM REFERENCE — Distribution Page (v7 — Smart Queue Engine)

> Ce fichier est la source de verite pour la page Distribution.
> Derniere mise a jour apres ajout du Smart Queue Engine (auto-distribution intelligente).

---

## Architecture

| Fichier | Role |
|---|---|
| `components/distribution/distribution-hub.tsx` | Composant principal (~1480 lignes, inclut SmartQueueSection) |
| `lib/distribution/caption-engine.ts` | Moteur de captions : 10 tones, block mixing, risk/reward metadata |
| `lib/distribution/tracking-simulator.ts` | Simulation post-publish : chaos engine + variant-aware projections |
| `lib/distribution/strategy-engine.ts` | Strategie dynamique : frequence, priorite, messages, confidence |
| `lib/distribution/user-memory.ts` | Memoire session : tracking patterns, insights personnalises |
| `lib/distribution/session-persistence.ts` | Persistance cross-session (localStorage) : streaks, progression, "What Worked" (NEW v6) |
| `lib/distribution/reward-engine.ts` | Systeme de recompenses : milestones, streaks, rare events, creator levels (NEW v6) |
| `lib/distribution/smart-queue-engine.ts` | Smart Queue Engine — timing, sequencing, risk, learning, confidence, explanations (NEW v7) |
| `stores/queue-store.ts` | Zustand store — queue state, learning data, settings, override handling (NEW v7) |
| `stores/distribution-store.ts` | Zustand store — accounts, publish targets, publish logic |
| `app/(dashboard)/dashboard/distribution/page.tsx` | Page wrapper (Suspense + metadata) |

---

## Layout (top to bottom)

```
1. Header (titre "Distribution" + description)
2. Reward Toast (top-right, auto-dismiss 5s, rare events/milestones) (v6)
3. Strategy Block — frequency, priority, countdown, confidence %, strategy message, streak badge
4. Personalized Insights (pills, apparait apres 1+ publish)
5. Clip Bank — scroll horizontal, smart labels, micro-interactions
6. Bio & Publish (grid 2 colonnes) — MONTE juste apres le clip bank (v8)
   ├── Bio Generator — 6-step sequence + 3 variantes (block mixing) + risk/reward labels (v6)
   └── Publish Panel — step-by-step sequence + AI Growth Projections (variant-aware) (v6)
7. Smart Queue Section (v7) — AI Schedule timeline
   ├── Scheduled posts (time, platform, risk, breakout %, explanation)
   ├── Strategy label + confidence
   ├── Emotional mix assessment
   ├── "If you do nothing" preview
   └── Override learning toast
8. FlowLine (animated)
9. AI Distribution Engine — cercle pulse + toggle + schedule preview + Beta badge
10. FlowLine
11. Platforms Grid — 5 cartes (TikTok, YouTube, Instagram, Facebook[soon], X[soon])
12. Recent Activity — metriques + tone insight
13. What Worked — feedback loop persistent (v6)
14. Stats Row — Queue, All Time (persistent), Platforms, Creator Level + progress bar (v6)
```

---

## Session Persistence (`lib/distribution/session-persistence.ts`) — NEW v6

### PersistentStats (localStorage)
```typescript
{
  totalClipsPublished: number
  totalViewsProjected: number
  clipsByTone: Record<string, number>
  clipsByPlatform: Record<string, number>
  clipScores: number[]              // last 50 scores
  weeklyClipsCount: number
  weeklyAvgScore: number
  lastWeekAvgScore: number | null   // for "vs last week"
  weekNumber: number                // ISO week
  bestClipScore: number
  bestClipTitle: string | null
  currentStreak: number             // consecutive days
  longestStreak: number
  lastPublishDate: string | null    // ISO date
  lastSessionDate: string | null
  sessionsCount: number
  firstUseDate: string
}
```

### Key: `"viral-animal-distribution-stats"`

### Streak Logic
- `lastPublishDate` = yesterday → increment `currentStreak`
- `lastPublishDate` = today → keep unchanged
- `lastPublishDate` older than yesterday → reset to 1
- Track `longestStreak` (max ever)

### Weekly Rollover
- Track ISO week number
- Week change: `weeklyAvgScore` → `lastWeekAvgScore`, reset `weeklyClipsCount`
- Enables "Avg score: 74 → +6 vs last week"

### "What Worked" Summary (`getWhatWorkedSummary`)
```typescript
{
  topTone: { name: string; performanceVsAvg: number } | null
  topPlatform: { name: string; multiplierVsOthers: number } | null
  bestTimeOfDay: string | null
  recommendation: string  // "Double down on hype content on TikTok"
}
```
Based on accumulated `clipsByTone` and `clipsByPlatform`.

### Graceful Fallback
localStorage indisponible (SSR, private browsing) → defaults, aucune erreur.

---

## Reward Engine (`lib/distribution/reward-engine.ts`) — NEW v6

### Reward Interface
```typescript
{
  id: string
  type: 'milestone' | 'streak' | 'rare_event' | 'personal_best' | 'level_up'
  title: string
  subtitle: string
  emoji: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
}
```

### Milestones (one-time, total clips)
| Clips | Titre | Emoji | Rarete |
|---|---|---|---|
| 1 | First Blood | 🎯 | common |
| 5 | Getting Serious | 💪 | common |
| 10 | Double Digits | 🔥 | uncommon |
| 25 | Content Machine | ⚡ | uncommon |
| 50 | Half Century | 💎 | rare |
| 100 | Centurion | 👑 | legendary |

### Streak Rewards (consecutive days)
| Jours | Titre | Emoji | Rarete |
|---|---|---|---|
| 3 | Hat Trick | 🔥 | common |
| 7 | Full Week | 💪 | uncommon |
| 14 | Two Weeks Strong | ⚡ | rare |
| 30 | Monthly Legend | 👑 | legendary |

### Rare Events (conditional, max 1 par publish)
- "Potential Breakout" (rare) — score > 85 AND 3+ platforms
- "Score Spike" (uncommon) — score > avg + 20
- "Triple Threat" (uncommon) — 3 clips session, all > 70
- "Perfect Setup" (rare) — score > 80 + caption + 3 platforms
- "Sniper" (uncommon) — first clip session > 85
- "New Personal Best" (common) — clipScore > bestClipScore

### Session Milestones
- 3 clips: "Triple Drop ⚡"
- 5 clips: "Power Session 🔥"
- 10 clips: "Marathon Runner 💎"

### Creator Levels (`getCreatorLevel`)
| Level | Titre | Clips requis |
|---|---|---|
| 1 | Rookie | 0 |
| 2 | Starter | 3 |
| 3 | Creator | 8 |
| 4 | Distributor | 15 |
| 5 | Strategist | 25 |
| 6 | Expert | 40 |
| 7 | Pro | 60 |
| 8 | Elite | 85 |
| 9 | Master | 120 |
| 10 | Legend | 200 |

Retourne: `{ level, title, nextLevelAt, progress (0-100%) }`

### Reward Collection (`collectRewards`)
Appele apres chaque publish avec contexte complet (totalClips, streak, sessionCount, score, platforms).
Retourne un tableau de rewards, affiche seulement le premier (le plus rare).

---

## Smart Queue Engine (`lib/distribution/smart-queue-engine.ts`) — NEW v7

### Concept
Moteur d'auto-distribution intelligent. Decide QUOI poster, QUAND, OU, et dans QUEL ORDRE.
Apprend des resultats et s'adapte dans le temps. 5 couches + 3 systemes additionnels.

### 5 Couches

| Couche | Role |
|---|---|
| Timing Engine | Score chaque heure par plateforme (base + learned). Recency weighting (dernieres 48h comptent 3x). |
| Sequencing Engine | Queue priority par clip. Formule: viralScore×0.30 + freshness×0.20 + platformFit×0.20 + momentumWindow×0.15 + emotionalDiversity×0.10 - killPenalty×0.05 |
| Risk Strategy | 2 niveaux: Proven (score >= 70) et Wildcard (< 70). Regle: jamais 2 wildcards consecutifs, prime time = proven prefere. |
| Learning Loop | Apprend de chaque post. Stocke: platformAffinity, timeBucketPerformance, moodPerformance, hookPerformance. Fast learning (1 post cree un signal). |
| Confidence Layer | 0-100% base sur l'historique. 0 posts = 35%, 3 = 45%, 7 = 55%, 15 = 70%, 30+ = 80-95%. |

### 3 Systemes additionnels

| Systeme | Role |
|---|---|
| Emotional Rotation | Penalty de -15 si meme mood que le post precedent (pas hard rule, penalty soft). |
| Momentum Window | Si un post performe 1.5x+, les 2-3 posts suivants recoivent un boost (multiplier 1.0-1.3). |
| Kill Switch | Si les 2 derniers clips similaires (mood/hook) performent < 0.7x, penalty -20 sur les clips similaires. Pattern-based, pas binaire. |

### Breakout Probability (contextuelle)
```typescript
breakoutProbability = base(30-80 from viralScore) × timingMultiplier × momentumMultiplier
// timingMult: prime=1.15, good=1.0, offpeak=0.85
// momentumMult: streak >= 7 → 1.2, >= 3 → 1.1, 0 clips/week → 0.85
// Context string: "↑ good timing", "↓ low momentum", etc.
```

### Queue Preview (output)
```typescript
{
  posts: ScheduledPost[]         // clip + platform + time + risk + breakout% + explanation
  totalEstReach: { low, high }   // estimated total reach
  confidence: number             // average confidence
  emotionalMix: 'diverse' | 'moderate' | 'repetitive'
  strategy: string               // "Build → Breakout → Capitalize"
}
```

### Strategy Labels
- `proven-wildcard-proven` → "Build → Breakout → Capitalize"
- `proven-proven-proven` → "Consistent Push"
- `proven-proven-wildcard` → "Build → Build → Test"
- `wildcard-proven-proven` → "Test → Capitalize → Push"

### Override Learning
Quand l'utilisateur reordonne manuellement:
- Boost la plateforme cible (×1.05)
- Baisse la plateforme source (×0.97)
- Boost le time bucket choisi (×1.05)
- Toast "Want us to learn from this?" → Yes/No

### Data Storage (localStorage)
- `viral-animal-queue-learning` : LearningData (postHistory, affinities, performances)
- `viral-animal-queue-settings` : QueueSettings (maxPerDay, blackoutHours, activePlatforms, autoMode)

---

## Queue Store (`stores/queue-store.ts`) — NEW v7

### State
```typescript
{
  queue: QueuePreview | null
  learning: LearningData
  settings: QueueSettings
  clipBank: QueueClip[]
  isGenerating: boolean
  showOverrideToast: boolean
}
```

### Actions
- `init()` : charge learning + settings depuis localStorage
- `setClipBank(clips)` : met a jour le bank + auto-regenere la queue
- `regenerateQueue()` : recalcule la queue complete (requestAnimationFrame pour pas bloquer UI)
- `updateSettings(partial)` : sauvegarde + regenere
- `recordResult(result)` : enregistre performance, met a jour learning, regenere
- `handleOverride(...)` : enregistre override, affiche toast
- `getDoNothingPreview()` : retourne { postCount, estReach, confidence }

---

## Smart Queue UI (SmartQueueSection dans distribution-hub.tsx) — NEW v7

### Position
Entre "Clip Bank" et "FlowLine: Bank → AI"

### Layout
```
Header: "NEXT UP — AI SCHEDULE" (Calendar icon purple, badge "Smart")
Card:
  ├── Scheduled posts (max 3, expandable):
  │   ├── Time column (HH:MM, Today/Tomorrow)
  │   ├── Risk icon (✅ Proven / 🎲 Wildcard)
  │   ├── Clip title (truncate)
  │   ├── Platform badge + slot quality
  │   ├── Breakout probability (Zap icon amber, "Breakout: 72%")
  │   ├── Context ("↑ good timing")
  │   └── Explanation ("Capitalizing on previous performance · Prime time slot")
  ├── Expand button (+N more scheduled)
  └── Footer:
      ├── Strategy label + Confidence %
      ├── Emotional mix (✅ Diverse / ⚠️ Moderate / ❌ Repetitive)
      └── "If you do nothing" preview (posts count, est. reach, confidence)
Override toast (conditionnelle): "You changed the order. Want us to learn?" [Yes] [No]
```

### Score badge colors
- >= 80: orange-500/15 text-orange-400
- >= 60: emerald-500/15 text-emerald-400
- < 60: zinc-700/50 text-zinc-400

---

## Variant Risk/Reward (UPGRADED v6)

### BioVariant (extended)
```typescript
{
  id: 'high-ctr' | 'safe-reach' | 'viral-bait'
  label: string
  style: string
  color: 'orange' | 'emerald' | 'red'
  caption: string
  hashtags: string[]
  reachMultiplier: number       // NEW
  failureChance: number         // NEW (0-100%)
  riskLabel: string             // NEW ("Proven formula" | "Safe & steady" | "High risk, high reward")
  projectedReachLabel: string   // NEW ("5.8K-11K")
}
```

### Valeurs par variant
| Variant | reachMultiplier | failureChance | riskLabel |
|---|---|---|---|
| Best (high-ctr) | 1.3 | 15% | "Proven formula" |
| Alternative (safe-reach) | 1.0 | 5% | "Safe & steady" |
| Risky (viral-bait) | 2.0 | 35% | "High risk, high reward" |

### Affichage dans les onglets
Sous chaque label de variant : `"{riskLabel} · {projectedReachLabel}"` en text-[10px].
Exemple: "Proven formula · 5.8K-11K" vs "High risk, high reward · 2.3K-18K"

### Impact sur le tracking
`simulatePostMetrics` accepte maintenant `variantId`:
- `viral-bait`: 35% chance (seeded) de "failure mode" (plateau early) vs 65% boost 1.5-2x
- `high-ctr`: 85% chance de boost 1.2-1.4x
- `safe-reach`: range tight 0.9-1.1x

---

## Reward Toast

Notification top-right apres publish quand un reward est declenche.

### Style par rarete
- legendary: `bg-amber-950/90 border-amber-500/40`
- rare: `bg-purple-950/90 border-purple-500/40`
- uncommon/common: `bg-card border-border`

### Contenu
- Emoji en text-2xl
- Title en font-bold
- Subtitle en text-muted

### Auto-dismiss: 5 secondes (`setTimeout`)

---

## "What Worked" Block — NEW v6

Card entre Recent Activity et Stats Row. Apparait quand `totalClipsPublished >= 2`.

### Contenu
- Icone Trophy (amber)
- Titre: "What worked" (uppercase tracking-widest)
- Top tone + performance vs average (ex: "Hype +62%")
- Top platform + multiplicateur (ex: "TikTok 2.3x")
- Recommendation en text-[10px] muted (ex: "Double down on hype content on TikTok")

### Source de donnees
`getWhatWorkedSummary(persistentStats)` — base sur les donnees accumulees cross-session.

---

## Stats Row (UPGRADED v6)

4 stats:
- **Queue**: `clipBank.length - publishedCount`
- **All time**: `persistentStats.totalClipsPublished` (persistent, survit au refresh)
- **Platforms**: nombre de plateformes actives
- **Creator Level**: titre + progress bar vers le prochain niveau
  - Titre en text-lg font-bold
  - Barre de progression purple (h-1)
  - "Lv.{N} · {progress}%" en text-[10px]

---

## Store (`stores/distribution-store.ts`)

Zustand store pour les comptes sociaux et la publication.
- `accounts: SocialAccount[]` — fetched via GET /api/social-accounts
- `publishTargets: PublishTarget[]` — [{platform, enabled}] auto-enabled pour les comptes connectes
- `publishProgress: Record<string, PublishProgress>` — status par plateforme (idle/publishing/published/error)
- `isPublishing: boolean` — true pendant les API calls publish
- Actions : `fetchAccounts()`, `togglePublishTarget(platform)`, `publishClip(clipId, caption, hashtags)` (parallele), `resetPublishProgress()`

## Strategy Block

Card en haut de la page avec bordure gauche purple. Contient :
- Confidence badge (high=purple, medium=amber, low=zinc) via `getConfidenceLevel()`
- Frequency : `getPostFrequency()` — label contextuel (ex: "3x today, 2x tomorrow")
- Priority : `getPlatformPriority()` — label avec ordre stagger (ex: "TikTok first -> YouTube 2h later")
- Countdown : prochaine fenetre de post (fake, next 6h slot)
- Strategy message : `getStrategyMessage()` — pool contextuel jour/heure/score
- Streak badge si streak >= 3 (emoji flamme)

## Clip Bank

Scroll horizontal de thumbnails 9:16 des clips rendus. Source : `render_jobs WHERE status='done'`.
- Smart labels : "Best next" (1er), "Priority" (score >= 80, Flame icon), "Ready" (>= 60), "Draft" (autres)
- Micro-interactions : hover:scale-105, glow ring orange (>= 80) ou emerald (>= 60)
- Click : selectionne le clip + reset publish progress

## AI Engine Node

Cercle central avec effets visuels quand AI ON : outer glow ring, gradient bg, orbiting dots, drop-shadow sur Sparkles icon. Badge "Beta". Toggle AI auto-distribute + schedule preview (heures optimales par plateforme via `getOptimalPostingTimes()`).

## Platforms Grid

5 cartes (TikTok, YouTube, Instagram, Facebook[soon], X[soon]). Etats : coming soon (grayscale), not connected (bouton "Connect account"), connected (toggle ON/OFF, dot vert), active (glow purple), publishing/published/error.

## Bio Generator

6-step sequence animee (stepFade). Caption Engine : detecte tone du titre, assemble hook + bridge + payoff + amplifier par variant. 3 variantes : Best (high-ctr, recommended), Alternative (safe-reach), Risky (viral-bait). Chaque variant affiche riskLabel + projectedReachLabel. Typewriter effect sur selection. Textarea editable + hashtags en pills.

## Publish Panel

Clip preview + step-by-step publish sequence (2 fake steps + real API calls). Progress bar globale + progress dans le bouton. Post-publish : AI Growth Projections via `simulatePostMetrics()` (variant-aware) avec disclaimer "Predicted performance". Metriques : views, likes, comments, shares, growth %, velocity label, platform breakdown.

## Recent Activity

Historique des publishes de la session. Chaque entree : dot vert/rouge, titre, plateformes (icons), tone, metriques simulees (views + growth %), timestamp relatif.

---

## CSS Animations

```css
@keyframes flowDot    — dot qui descend les FlowLines (1.5s)
@keyframes pulseGlow  — glow pulse sur AI engine circle (2s)
@keyframes stepFade   — fade-in des steps bio/publish (0.3s)
@keyframes scaleIn    — scale+fade pour post-publish projections (0.4s)
```

---

## Statut par Feature

| Feature | Status |
|---|---|
| Clip bank (Supabase) | WIRED_REAL |
| Social accounts fetch | WIRED_REAL |
| Platform toggles (store sync) | WIRED_REAL |
| Publish API calls | WIRED_REAL |
| Publish progress tracking | WIRED_REAL |
| Publish step-by-step sequence | WIRED_REAL (2 fake steps + real API) |
| Caption Engine (10 tones, block mixing, ~2000 combos) | SIMULATED (templates avances, pas d'AI API, unique par clip) |
| Variant risk/reward metadata | SIMULATED (multiplicateurs fixes, pas de donnees reelles) |
| AI Growth Projections (chaos engine, variant-aware) | SIMULATED (chaos deterministe, labele "Predicted") |
| Strategy Engine (40+ messages, contexte jour/heure) | SIMULATED (pas de vrais analytics) |
| User Memory session | SIMULATED (patterns reels de la session) |
| Session Persistence (localStorage) | WIRED_LOCAL (survit au refresh, cross-session) |
| Reward Engine (milestones, streaks, rare events) | WIRED_LOCAL (base sur totalClipsPublished reel) |
| Creator Levels (progression) | WIRED_LOCAL (base sur totalClipsPublished reel) |
| "What Worked" feedback loop | SIMULATED (base sur donnees accumulees, pas de vrais metrics API) |
| Streak tracking | WIRED_LOCAL (localStorage, dates reelles) |
| Smart labels clips | WIRED_REAL (velocity_score reel) |
| Recent activity avec metriques | SIMULATED (vues via tracking-simulator) |
| Smart Queue Engine (timing, sequencing) | WIRED_LOCAL (localStorage learning + real clip data) |
| Smart Queue Breakout Probability | SIMULATED (contextuel, base sur viralScore + timing + momentum) |
| Smart Queue Learning Loop | WIRED_LOCAL (localStorage, fast learning) |
| Smart Queue Override Learning | WIRED_LOCAL (toast + affinity adjustment) |
| Smart Queue Reach Estimation | SIMULATED (formule interne, labele "est.") |
| Smart Queue Kill Switch | SIMULATED (pattern detection, pas de vrais metrics API) |
| Smart Queue Emotional Rotation | SIMULATED (mood from clip data, pas mood detector API) |
| Facebook/X | NOT_IMPLEMENTED |

---

## Axes d'amelioration restants (post v7)

1. **Smart Queue → Real Publish** — Connecter le scheduling a la publication reelle via APIs TikTok/YouTube/Instagram
2. **Mood tagging** — Utiliser le mood detector existant pour tagger chaque clip dans la queue (actuellement "unknown")
3. **Hook type detection** — Parser le titre/transcription pour detecter le type de hook (question/shock/story)
4. **Tracking reel** — API TikTok/YouTube/Instagram pour vraies vues/likes → nourrir le learning loop avec des vrais performance metrics
5. **Bio generation reelle** — Connecter a Claude API pour remplacer les templates
6. **Persistance Supabase** — Migrer learning data localStorage vers Supabase pour cross-device
7. **Drag & drop** — Permettre le reordering manuel des posts dans la queue (actuellement override pas wired)
8. **Queue settings UI** — Panel pour ajuster maxPerDay, blackoutHours, etc.
9. **Refactoring composant** — Splitter distribution-hub.tsx en sous-composants (SmartQueueSection deja separe)
