# SYSTEM REFERENCE — Enhance / Editor Page (v2.1)

> Ce fichier est la source de verite pour la page Enhance (editeur de viralite).
> Couvre : architecture, layout, state, chaque section UI, scoring, AI, render, animations.
> Pour le schema DB, env vars, et conventions generales, voir `CLAUDE.md`.

---

## TL;DR — Enhance Flow

```
1. Load clip (3 sources : trending store, Supabase DB, ou upload)
2. User clique "AI Optimize"
3. Systeme :
   -> detecte le mood (Claude Haiku, fallback 'hype' si timeout)
   -> genere hook text + reorder segments (VPS Railway)
   -> applique le mood preset (~20 settings d'un coup)
   -> joue la sequence d'analyse fake (6 steps, ~4s)
   -> trigger auto-render (FFmpeg via VPS)
4. Render pipeline :
   -> capture overlays (Canvas 2D -> PNG base64)
   -> POST /api/render avec settings + overlays
   -> VPS FFmpeg : sous-titres + split-screen + hook + zoom
   -> stockage Supabase Storage
   -> polling 3s -> signed URL
5. User : download MP4 ou publish to socials
Alternative : user change les settings manuellement (sans AI Optimize)
-> preview CSS temps reel se met a jour
-> Blowup Chance score recalcule (diminishing returns)
-> user clique "Generate clip" -> meme render pipeline
```

---

## Architecture

| Fichier | Role |
|---|---|
| `app/(dashboard)/dashboard/enhance/page.tsx` | Landing page (sans clipId) — CTA "Browse clips" + "Upload" |
| `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx` | Page principale (~2220 lignes) — state machine, settings, render, toute l'UI |
| `components/enhance/live-preview.tsx` | Preview CSS temps reel : video, captions, tags, hook, split-screen, smart zoom (~540 lignes) |
| `components/enhance/ai-analysis-sequence.tsx` | Sequence animee 6 etapes post-AI avec framer-motion (~377 lignes) |
| `components/enhance/tag-panel.tsx` | Panel "Streamer tag" extrait — grille de styles + slider taille (~150 lignes) |
| `lib/enhance/scoring.ts` | Scoring engine : types, constantes, `computeScores()`, `computeCurrentScore()`, `computeScoreBreakdown()` (~580 lignes) |
| `lib/enhance/analysis-copy.ts` | Justifications par mood, display names, fake dynamic data seeded, confidence labels (~150 lignes) |
| `lib/ai/mood-detector.ts` | Claude Haiku call — detecte mood + important_words (~140 lignes) |
| `lib/ai/mood-presets.ts` | 6 moods (rage/funny/drama/wholesome/hype/story) + `MoodPreset` + `PLATFORM_THEME` (~230 lignes) |
| `lib/capture-hook-overlay.ts` | Canvas 2D → PNG base64 du hook capsule (pas SVG foreignObject) |
| `lib/capture-tag-overlay.ts` | Canvas 2D → PNG base64 du tag streamer |
| `lib/schemas/render.ts` | Zod schema `renderSettingsSchema` + `renderInputSchema` — contrat frontend ↔ VPS |
| `app/api/enhance/ai-optimize/route.ts` | Route POST — mood detection (proxy `detectMood()`) |
| `app/api/render/route.ts` | Route POST — full render (Zod, quota, queue, VPS handoff) |
| `app/api/render/hook/route.ts` | Route POST — hook text generation (proxy VPS) + webhook callback |
| `app/api/render/status/route.ts` | Route GET — poll status, signed URLs, queue position |
| `app/api/render/quick/route.ts` | Route POST — 1-click export depuis Browse (auto mood + preset) |
| `components/video/before-after-player.tsx` | Split-view comparison player (drag slider, clip-path, video sync) |
| `components/distribution/publish-dialog.tsx` | Dialog de publish (reutilise depuis Distribution) |

---

## Layout (top to bottom)

```
1. Header — Back button (ChevronLeft → /dashboard) + "Enhance Clip" titre + clip info (title, @author)
2. Grid 2 colonnes : [300px sticky preview | 1fr scrollable settings]

=== Colonne gauche (sticky, max-h viewport, scroll interne) ===
3. Preview Toggle — 3 tabs: "Original" | "Enhanced" | "Rendered" (apparait apres render done)
4. LivePreview — 9:16 preview CSS temps reel (280px max-width)
5. Generate Button — "Generate clip" (orange gradient, Zap icon) — cache pendant AI flow / render / done
6. Error Card — affiche erreur render avec retry + action secondaire (quota → upgrade)
7. Action Buttons (apparaissent apres AI flow start OU render done):
   ├── Progress message (bleu/vert/amber selon etat)
   ├── Rendering spinner (apres sequence, avant done)
   ├── "Publish now" — primary CTA (cyan gradient, navigates to Distribution with action=publish)
   ├── "Place in bank" — secondary CTA (cyan outline):
   │     - First click: confirms placement, shows checkmark
   │     - Second click: navigates to `/dashboard/distribution?scrollTo=bank&highlight={clipId}`
   │     - Distribution page auto-scrolls to Clip Bank + highlights the clip with cyan ring pulse
   ├── "Download MP4" — tertiary (outline, <a download>)
   └── "Reset & start over" — remet tout a zero

=== Colonne droite (scrollable) ===
8. AI Optimize button — CTA principal, 3 etats visuels (idle/analyzing/complete)
9. AI Analysis Sequence — 6 steps animes (apparait apres API calls termines)
10. Blowup Chance bar — sticky top-0, barre bicolore (orange base + green boost), score /100
11. Accordion settings :
    ├── Karaoke Captions (Type icon)
    ├── Split-Screen (Monitor icon)
    ├── Streamer Tag (@ icon)
    ├── Smart Zoom (Focus icon) [New]
    ├── Audio Enhancement (Volume2 icon) [New]
    ├── Auto-Cut Silences (Scissors icon) [New]
    └── Hook Viral (Flame icon) [New]
12. PublishDialog — modal reutilise de Distribution
```

---

## State Machine

### Page State (`enhanceState` implicite via booleans)

```
idle
  → makeViralLoading=true      (click "AI Optimize")
  → analysisSequenceActive=true (API calls termines, sequence joue)
  → analysisComplete=true       (sequence finie)
  → rendering=true              (auto-render declenche)
  → renderDownloadUrl set       (render done)
```

Pas de Zustand store — tout le state est local au composant `EnhancePage` via `useState`.

### Key State Variables

| Variable | Type | Description |
|---|---|---|
| `clip` | `TrendingClipData \| null` | Donnees du clip charge |
| `videoUrl` | `string \| null` | URL video pour preview (Twitch signed, Supabase signed, ou rendered) |
| `settings` | `EnhanceSettings` | Tous les reglages utilisateur |
| `rendering` | `boolean` | Render en cours |
| `renderDownloadUrl` | `string \| null` | URL de telechargement du rendu final |
| `renderJobId` | `string \| null` | ID du job de rendu actif |
| `isRenderedVideo` | `boolean` | Preview montre la video rendue (baked MP4) |
| `originalVideoUrl` | `string \| null` | URL originale sauvegardee avant remplacement par rendered |
| `showEnhancements` | `boolean` | Overlays CSS actifs dans la preview |
| `makeViralLoading` | `boolean` | "AI Optimize" en cours (API calls) |
| `analysisSequenceActive` | `boolean` | Sequence animee en cours |
| `analysisComplete` | `boolean` | Sequence terminee |
| `detectedMood` | `ClipMood \| null` | Mood detecte par AI |
| `selectedMood` | `ClipMood \| null` | Mood actif (AI ou user override) |
| `moodConfidence` | `number` | Confiance de la detection (0-100) |
| `moodAiDetected` | `boolean` | true si le mood vient de l'AI (pas d'override user) |
| `hookAnalysis` | `HookAnalysis \| null` | Resultat de la detection de hook viral |
| `hookGenerating` | `boolean` | Hook generation en cours |
| `scoreBreakdown` | `ScoreBreakdown` | Points par section (+X pts) |
| `displayScore` | `number` | Score affiche avec animation count-up |

---

## Clip Loading

3 sources, testees dans cet ordre :

### 1. Upload (`source=upload` query param)
- Charge depuis `videos` table (Supabase)
- Signed URL pour preview (1h TTL)
- `TrendingClipData` avec `platform: 'upload'`, `author_name: 'You'`
- Champs trending a null (velocity_score, view_count, etc.)

### 2. Trending Store (in-memory)
- `useTrendingStore.clips.find(c => c.id === clipId)`
- Marche si l'user vient du Browse (clips deja fetches)

### 3. Supabase Fallback
- `SELECT * FROM trending_clips WHERE id = clipId`
- Deep link direct ou refresh de page

### Video URL Resolution
- **Twitch** : extrait slug de l'URL → `GET /api/clips/video-url?slug=X` → CloudFront signed MP4
- **Upload** : Supabase Storage signed URL (1h TTL)
- **Kick** : pas de resolution directe (thumbnail fallback)

---

## DEFAULT_SETTINGS

```typescript
{
  captionsEnabled: false,
  captionStyle: 'none',
  emphasisEffect: 'none',
  emphasisColor: 'red',
  customImportantWords: [],
  captionPosition: 72,
  wordsPerLine: 4,
  splitScreenEnabled: false,
  brollVideo: 'none',
  splitRatio: 60,
  videoZoom: 'contain',
  tagStyle: 'none',
  tagSize: 100,
  aspectRatio: '9:16',
  smartZoomEnabled: false,
  smartZoomMode: 'micro',
  audioEnhanceEnabled: false,
  bassBoost: 'off',
  speedRamp: 'off',
  autoCutEnabled: false,
  autoCutThreshold: 0.7,
  hookEnabled: false,
  hookTextEnabled: true,
  hookReorderEnabled: true,
  hookText: '',
  hookStyle: 'suspense',
  hookTextPosition: 15,
  hookLength: 0,
  hookReorder: null,
}
```

---

## AI Optimize Flow ("Make it viral")

### Declencheur
Bouton "AI Optimize" en haut de la colonne droite. 3 etats visuels :
- **Idle** : orange gradient, Sparkles icon, "AI Optimize — Best settings in one click"
- **Analyzing** : orange pulse, Loader2 spin, shimmer effect, "Analyzing clip... — Tuning every parameter"
- **Complete** : emerald gradient, Check icon, "AI-optimized — All settings tuned for this clip"

### Pipeline (`applyBestCombo`)

```
1. setMakeViralLoading(true)
2. POST /api/enhance/ai-optimize → mood detection (Claude Haiku, 15s timeout)
   ├── Success: setDetectedMood, setSelectedMood, setMoodConfidence, setMoodExplanation, setSecondaryMood
   │   + auto-populate customImportantWords from AI important_words
   └── Failure: fallback to 'hype' at 30% confidence
3. applyMoodPreset(preset) → ecrase ~20 settings d'un coup
4. POST /api/render/hook → hook text + reorder segments (VPS, 15s timeout)
   ├── Success: setHookAnalysis, auto-select hook matching mood's hookStyle
   │   + store reorder data in settings.hookReorder
   └── Failure: silent — hook text stays empty
5. setMakeViralLoading(false)
6. setAnalysisSequenceActive(true) → lance AIAnalysisSequence
7. Sequence plays 6 steps (~4s total)
8. onComplete: setAnalysisComplete(true), pendingAutoRenderRef triggers handleRender()
```

### Auto-render Guard
`pendingAutoRenderRef` + `useEffect` surveille que :
- `settings.captionStyle` matche `appliedCaptionStyleRef.current`
- Si `hookReorderEnabled`, `settings.hookReorder` est populated
- Pas deja en rendering

Quand les conditions sont remplies : `handleRender()` se declenche automatiquement.

---

## AI Analysis Sequence (`AIAnalysisSequence`)

### 6 Steps

| # | Label | Sub text | Duration | Special |
|---|---|---|---|---|
| 1 | Scanning audio waveform... | `{duration}s of audio · {peaks} volume peaks detected` | 500ms | |
| 2 | Detecting emotional peaks... | `Key moment identified at {timestamp}` | 700ms | |
| 3 | Optimizing caption style... | `{segments} high-energy segments found` | 800ms | Reveal: caption style + justification |
| 4 | Selecting emphasis & color... | Emphasis justification | 700ms | Reveal: effect + color dot + justification |
| 5 | Crafting viral hook... | Hook justification | 1000ms | `isWow` — "Viral pattern detected" + hook text typing |
| 6 | Finalizing parameters... | `{total} data points analyzed` | 500ms | |

### Fake Dynamic Data
`generateDynamicData(clipId, duration)` — seeded random par clipId (deterministe). Genere :
- `audioDuration` : arrondi de la duree
- `peaksDetected` : `floor(duration/8) + random(0-2) + 1`
- `keyMomentTimestamp` : entre 25% et 75% de la duree
- `highEnergySegments` : `max(2, floor(duration/6) + random(0-1))`

### Justifications (`JUSTIFICATIONS[mood]`)
Par mood, 5 strings couvrant : captionStyle, emphasisEffect, emphasisColor, hook, zoom.
Exemples pour `rage` :
- captionStyle: "maximizes impact during intense moments"
- emphasisColor: "high contrast on dark backgrounds"
- hook: "optimized for shock-value retention"

### Result Card
Apres les 6 steps : card emerald avec count-up du score de confiance, 3 checkmarks :
- "Hook tuned for retention"
- "Captions matched to energy"
- "Effects aligned with peak moments"

Apres 800ms → `onComplete()` callback.

---

## LivePreview (`components/enhance/live-preview.tsx`)

### 3 Modes

| Mode | Condition | Comportement |
|---|---|---|
| **Original** | `showEnhancements=false` | Video brute, pas d'overlays CSS |
| **Enhanced** | `showEnhancements=true, isRenderedVideo=false` | Video originale + overlays CSS (captions, tags, hook, split, zoom) |
| **Rendered** | `isRenderedVideo=true` | Video MP4 rendue (tout bake), pas d'overlays CSS |

### Container
- `aspect-ratio: 9/16`, `max-width: 280px`, `rounded-2xl`, border `white/10`, `shadow-2xl`
- Centre horizontalement

### Layers (z-index croissant)

1. **Blurred background** (z-auto) — video/image en `object-cover scale-110` avec `blur(12px) brightness(0.65) saturate(1.25) contrast(1.1)`. Cache quand split-screen actif.

2. **Main video** (z-1) — `object-contain` (normal) ou `object-cover` (split). Zoom selon `videoZoom` :
   - `contain` : 100% (pas de zoom)
   - `fill` : 115% (subtle)
   - `immersive` : 135% (medium)

3. **Smart Zoom animations** — CSS keyframes via `--sz-from` / `--sz-to` CSS vars :
   - `micro` : `scale(1.0) → scale(1.05)`, 5s, `ease-in-out forwards`
   - `dynamic` : punch zooms a 15% et 65%, 4s loop
   - `follow` : scale 1.2x + translate pan, 8s loop

4. **Gradient overlay** (z-10) — `bg-gradient-to-t from-black/40 to-transparent`

5. **Platform badge** (z-10) — top-left, `Badge` avec nom de plateforme

6. **Format badge** (z-20) — top-center, `9:16` en `text-[9px]`

7. **Split line** (z-10) — `h-0.5 bg-gradient-to-r via-blue-400/60`, positioned at `splitRatio%`

8. **Blur fill zone** (z-auto) — bottom section, `backdrop-blur-xl`, gradient zinc, Eye icon + "Blur fill" label

9. **Tag overlay** (z-20) — bottom-left, 4 styles visuels (voir section Tags)

10. **Hook text overlay** (z-30) — positioned at `hookTextPosition%`, capsule noire avec border glow (plateforme-aware)

11. **Karaoke captions** (z-20) — positioned at `captionPosition%`, max-width 85%

### Caption Animation Modes

| Animation | Comportement dans la preview |
|---|---|
| `word-pop` | 1 seul mot affiche a la fois, `text-xl`, pop-in animation. Important words en rouge + plus gros. |
| `highlight` | Tous les mots visibles, mot actif avec `highlightClass` (bg-white/20). Active word scale statique. |
| `bounce` | Tous les mots visibles, mot actif `translateY(-45%) scale(1.3)`. |
| `glow` | Background `bg-black/60 shadow-[0_0_20px_rgba(255,255,255,0.15)]`. Halo colore sur mot actif. |
| `typewriter` | Reveal caractere par caractere sur le mot actif, curseur `\|` a la fin. |

### Word Cycling
- `sampleWords = ['This', 'is', 'CRAZY', 'bro', 'let\'s', 'go']` (tronque a `wordsPerLine`)
- `activeWordIdx` cycle toutes les 400ms (match Whisper timestamp typical)
- Important words : CAPS (>=3 chars), contient `!`, ou dans `IMPORTANT_WORDS_SET` (35 mots viraux)

### Emphasis Effects (sur mots importants actifs)

| Effect | Transform |
|---|---|
| `scale` | `scale(1.5)` (word-pop: `scale(1.35)`) |
| `bounce` | `translateY(-30%) scale(1.25)` (word-pop: `translateY(-6px) scale(1.15)`) |
| `glow` | Extra text-shadow halo avec emphasisColor |

### Rendered Video Mode
- `<video>` avec `autoPlay loop muted playsInline`
- Thumbnail poster pendant chargement
- Spinner Loader2 en overlay
- Fallback sur `onError` → revient au mode Enhanced

### ScoreBadge (exporte depuis live-preview.tsx)
```tsx
<ScoreBadge score={impact} isBest={isHighlight} isMoodPick={isMoodPick} />
```
- `isMoodPick` : badge vert avec "AI" prefix
- `isBest` : badge orange
- Defaut : badge gris muted
- Format : `+{score}` ou `+0`

---

## Blowup Chance Bar

### Position
Sticky `top-0 z-10` dans la colonne settings, avec `backdrop-blur-md`.

### Structure
```
[Flame icon] "BLOWUP CHANCE" (label)          [Score label] (ex: "Viral ready")

[██████████████████░░░░░░░░░░] 72.5 / 100 (+12.5)
  orange base (0→baseline)   green boost (baseline→total)
```

### Bicolor Bar
- **Base segment** : `from-orange-500 to-amber-400`, width = `baselineScore%`
- **Boost segment** : `from-emerald-500 to-emerald-400`, starts at `baselineScore%`, width = `min(scoreBreakdown.total, 99 - baselineScore)%`
- **Glow pulse** : si total >= 70, overlay `via-white/8` avec animation `barGlow 3s ease-in-out infinite`

### Dynamic Colors
| Score | Gradient | Glow |
|---|---|---|
| >= 80 | emerald → cyan | `shadow-emerald-500/30`, shadow-xl |
| >= 60 | amber → orange | `shadow-amber-500/25`, shadow-lg |
| < 60 | orange → red | `shadow-orange-500/20` |

### Score Labels (`getScoreLabel`)
| Score | Label | Color |
|---|---|---|
| >= 95 | "Legendary potential" | text-orange-400 |
| >= 85 | "Viral ready" | text-green-400 |
| >= 70 | "High potential" | text-blue-400 |
| >= 55 | "Good base" | text-yellow-400 |
| < 55 | "Rising" | text-muted-foreground |

### Animated Count-up
Quand `currentScore` change → animation 500ms ease-out cubic (`1 - (1 - progress)^3`), arrondi a 1 decimale.

### Congrats Message
Score >= 90 → fire emoji + "Maximum viral potential reached!" avec animation `confettiDrop`.

---

## Scoring Engine (`lib/enhance/scoring.ts`)

### Types Principaux

```typescript
interface EnhanceSettings {
  captionsEnabled: boolean
  captionStyle: string           // 'word-pop' | 'highlight' | 'bounce' | 'glow' | 'none'
  emphasisEffect: string         // 'none' | 'scale' | 'bounce' | 'glow'
  emphasisColor: string          // 'red' | 'yellow' | 'cyan' | 'green' | 'orange' | 'pink' | 'purple' | 'white'
  customImportantWords: string[]
  captionPosition: number        // 0-100 (top→bottom)
  wordsPerLine: number           // 1-8
  splitScreenEnabled: boolean
  brollVideo: string             // 'blur-fill' | 'none' (b-roll options unused in UI)
  splitRatio: number             // 40-80
  videoZoom: 'contain' | 'fill' | 'immersive'
  tagStyle: string               // 'viral-glow' | 'kick-glow' | 'twitch-minimal' | 'kick-minimal' | 'none'
  tagSize: number                // 50-150
  aspectRatio: '9:16' | '1:1' | '16:9'  // locked to 9:16 in UI
  smartZoomEnabled: boolean
  smartZoomMode: 'micro' | 'dynamic' | 'follow'
  audioEnhanceEnabled: boolean
  bassBoost: 'off' | 'mild' | 'heavy'
  speedRamp: 'off' | 'subtle' | 'dynamic'
  autoCutEnabled: boolean
  autoCutThreshold: number       // 0.3-2.0
  hookEnabled: boolean
  hookTextEnabled: boolean
  hookReorderEnabled: boolean
  hookText: string
  hookStyle: 'shock' | 'curiosity' | 'suspense'
  hookTextPosition: number       // 5-85
  hookLength: number
  hookReorder: { segments: Segment[]; totalDuration: number; peakTime: number } | null
}
```

### `computeBaselineScore(clip)` → number
`max(30, clip.velocity_score ?? 0)`. Floor a 30 pour les uploads sans data.

### `computeCurrentScore(settings, scores, baseline, mood?)` → number
Formule a rendements decroissants :
```
headroom = max(0, 99 - baseline)
totalWeight = sum of all enabled feature weights + mood-match bonuses
boost = headroom * totalWeight
currentScore = min(99, round((baseline + boost) * 10) / 10)
```

### Feature Weights (base) — calibrated 2026-07

> Poids ancres sur ~70 sources verifiees. Voir `RECHERCHE-VIRALITE-CALIBRATION.md`.
> Hook=#1 (TikTok officiel), captions=preuve forte, split reduit (preuve anecdotique + risque plateforme), bassBoost retire (inaudible sur telephone).

| Feature | Weight | Condition | Changement |
|---|---|---|---|
| Captions | 0.14 | `captionsEnabled && captionStyle !== 'none'` | inchange |
| Hook | 0.13 | `hookEnabled` | 0.11→0.13 |
| Hook Reorder | 0.07 | `hookReorderEnabled` | 0.05→0.07 |
| Split-screen | 0.07 | `splitScreenEnabled` | 0.12→0.07 |
| Emphasis | 0.06 | `emphasisEffect !== 'none'` | 0.08→0.06 |
| Audio Enhance | 0.05 | `audioEnhanceEnabled` | 0.03→0.05 |
| Auto-Cut | 0.05 | `autoCutEnabled` | 0.03→0.05 |
| Tag | 0.04 | `tagStyle !== 'none'` | 0.08→0.04 |
| Smart Zoom | 0.03 | `smartZoomEnabled` | 0.05→0.03 |
| Speed Ramp | 0.02 | subtle=0.02, dynamic=0.02 | 0.02-0.03→0.02 |
| ~~Bass Boost~~ | 0.00 | _retire du scoring_ | 0.03-0.05→0.00 |

**Total max** : ~0.66 (tout active, sans mood bonuses)

### Mood-Match Bonus Weights

| Match | Bonus |
|---|---|
| Caption style matches mood preset | +0.06 |
| Emphasis effect matches | +0.04 |
| Emphasis color matches | +0.03 |
| Video zoom matches | +0.02 |
| Smart zoom mode matches | +0.02 |
| Auto-cut matches | +0.02 |

**Total mood bonus** : ~0.19 max. Grand total ~0.85.

### Example
```
baseline = 50, headroom = 49
All features ON + all mood matches → weight = 0.85
boost = 49 * 0.85 = 41.7
score = min(99, 50 + 41.7) = 91.7
```

### `computeScoreBreakdown(settings, baseline, mood?)` → ScoreBreakdown
Memes poids, retourne points par section :
```typescript
{ captions: 6.9, splitScreen: 5.9, tag: 3.9, smartZoom: 2.5, audio: 1.5, autoCut: 1.5, hook: 5.4, total: 27.6 }
```

### `computeScores(clip)` → ComputedScores
Normalise les scores bruts par category (captions 35%, emphasis 15%, b-roll 30%, tags 20%).
Retourne `captionScores`, `emphasisScores`, `brollScores`, `tagScores` + `best` combo.
Utilise pour les ScoreBadge sur chaque option dans l'UI.

---

## Constants

### CAPTION_STYLES (5 options)

| ID | Label | Animation | baseScore |
|---|---|---|---|
| `word-pop` | Word Pop | word-pop | 14 |
| `highlight` | Highlight | highlight | 12 |
| `bounce` | Bounce | bounce | 11 |
| `glow` | Glow | glow | 10 |
| `none` | None | — | 0 |

### EMPHASIS_EFFECTS (4 options)

| ID | Label | baseScore |
|---|---|---|
| `none` | None | 0 |
| `scale` | Scale Up | 14 |
| `bounce` | Bounce | 10 |
| `glow` | Glow | 8 |

### EMPHASIS_COLORS (8 options)

| ID | Label | Hex |
|---|---|---|
| `red` | Red | #EF4444 |
| `yellow` | Yellow | #FACC15 |
| `cyan` | Cyan | #22D3EE |
| `green` | Green | #4ADE80 |
| `orange` | Orange | #F97316 |
| `pink` | Pink | #EC4899 |
| `purple` | Purple | #C77DFF |
| `white` | White | #FFFFFF |

### TAG_STYLES (5 options)

| ID | Label | Description | Icon | baseScore |
|---|---|---|---|---|
| `viral-glow` | Viral Glow | Black capsule + neon purple border + glow | fire | 14 |
| `kick-glow` | Kick Glow | Black capsule + neon green border + glow | green heart | 14 |
| `twitch-minimal` | Twitch Minimal | Clean black, subtle purple border | purple circle | 10 |
| `kick-minimal` | Kick Minimal | Clean black, subtle green border | green circle | 10 |
| `none` | None | No visible tag | prohibited | 0 |

**Platform filtering** : tags Kick scores 0 sur clips Twitch et vice-versa.

---

## Accordion Sections (detail)

### 1. Karaoke Captions

**Trigger summary** : Style name + emphasis effect + color (ou "Off")
**Score badge** : `+{scoreBreakdown.captions} pts`

**Contenu** :
- **Style grid** (3 cols) : 5 options. Chaque card montre "Aa" preview + ScoreBadge. Mood pick = border vert + "AI" badge. Best pick (sans mood) = border orange.
- **Animation info** : readonly display du animation label lie au style choisi
- **Keyword emphasis grid** (3-5 cols) : 4 effects. Same mood/best highlighting.
- **Emphasis color** : 8 cercles colores. Disabled quand effect = none. AI badge sur la couleur choisie par l'AI.
- **Important words** : auto-detected preview (CAPS, OMG, CRAZY, INSANE, WTF) + custom words avec X pour supprimer + form pour ajouter.
- **Vertical position** : slider 0-100 + presets (Top=8, Middle=42, Bottom=72)
- **Words per line** : slider 1-8

### 2. Split-Screen

**Trigger summary** : "Blur fill · {ratio}" ou "Off"
**Score badge** : `+{scoreBreakdown.splitScreen} pts`

**Contenu** :
- **Blur fill toggle** : custom switch (emerald quand ON). Toggle `splitScreenEnabled` + `brollVideo='blur-fill'`.
- **Ratio slider** : 40-80%, step 5. Label "{ratio}% / {100-ratio}%".
- **Video framing** : 3 options grid — Contain (100%), Fill (subtle zoom), Immersive (medium zoom).

### 3. Streamer Tag (via `TagPanel`)

**Trigger summary** : Style name ou "Off"
**Score badge** : `+{scoreBreakdown.tag} pts`

**Contenu** (delegue a `TagPanel` avec `noCard=true`) :
- **Tag style grid** (2 cols) : 5 styles avec icon + description. Mood/best highlighting + ScoreBadge.
- **Tag size slider** : 50-150%, step 5. Visible uniquement si style !== 'none'.

### 4. Smart Zoom [New badge]

**Trigger summary** : Mode name ou "Off"
**Score badge** : `+{scoreBreakdown.smartZoom} pts`

**Contenu** :
- **Master toggle** : enable/disable avec pts display
- **Mode selector** (quand enabled, 1 col) :
  - Micro zoom : "Breathing zoom cinematic (1.05 → 1.21). Subtle & pro." [Safe badge]
  - Dynamic : "Punch zooms on audio peaks + 2.5s cooldown. Max impact." [New badge]
  - Follow face : "Tracks face with smooth cinematic panning." [New badge]
  - Mood-match bonus `+{getOptionPts(0.02)} pts` affiche si le mode matche le preset

### 5. Audio Enhancement [New badge]

**Trigger summary** : "On" ou "Off"
**Score badge** : `+{scoreBreakdown.audio} pts`

**Contenu** :
- **Master toggle** : enable/disable avec pts display
- **Info card** (quand enabled) : High-pass 80Hz, FFT denoising, Loudness normalization
- Bass Boost et Speed Ramp ne sont PAS exposes dans l'UI (geres uniquement par mood presets)

### 6. Auto-Cut Silences [New badge]

**Trigger summary** : "On · {threshold}s threshold" ou "Off"
**Score badge** : `+{scoreBreakdown.autoCut} pts`

**Contenu** :
- **Master toggle** : enable/disable avec pts display
- **Silence threshold slider** : 0.3-2.0s, step 0.1. Labels "Aggressive (0.3s)" / "Gentle (2s)".
- **Adaptive hint** : When a mood is detected/selected, shows "AI suggests Xs for {mood} clips" (rage/hype=0.5s, drama=0.7s, others=current value). Purple text.
- **Mood in payload** : `autoCut.mood` is sent to the VPS for server-side adaptive threshold.
- **Info card** : Detects silences (Whisper), cuts pauses, realigns captions.

### 7. Hook Viral [New badge, orange]

**Trigger summary** : Style + hook text preview (20 chars truncated) ou "Off"
**Score badge** : `+{scoreBreakdown.hook} pts`

**Contenu** :
- **Master toggle** : orange theme (pas emerald). Toggle `hookEnabled`.
- **Sub-toggles** (2 cols grid) :
  - Hook text : overlay at start. Type icon.
  - Moment fort 1er : reorder clip. Zap icon. Bonus pts affiches. Si active et pas de hookReorder → auto `generateHook()`.
- **Text position slider** : 5-85%, visible si hookTextEnabled
- **Hook visibility info** : "Hook text visible for the entire clip"
- **Generate button** : orange gradient. States: "Detect viral moment" → Loader "Analyzing..." → "Regenerate hooks"
- **Hook analysis results** (apres generation) :
  - **Peak info card** : timestamp du moment viral, score bar, reorder segments visualises (HOOK/CONTEXT/PAYOFF avec couleurs orange/bleu/emerald et duree proportionnelle)
  - **Hook style selector** (3 cols) : Shock (skull), Curiosity (eyes), Suspense (hourglass). Click change le style et auto-selectionne le hook text correspondant.
  - **Hook text variants** : 3 options generees par le VPS. Click selectionne text + style.
  - **Custom hook input** : max 60 chars, counter affiche.

---

## Mood System

### 6 Moods (`ClipMood`)

| Mood | Emoji | Caption | Emphasis | Emphasis Color | Zoom | Smart Zoom | Hook Style | Auto-Cut |
|---|---|---|---|---|---|---|---|---|
| rage | fire | word-pop | scale | red | fill | dynamic | shock | ON (0.5s) |
| funny | laughing | bounce | bounce | yellow | fill | micro | curiosity | OFF |
| drama | masks | highlight | glow | purple | immersive | follow | suspense | OFF |
| wholesome | sparkles | glow | none | cyan | contain | micro | curiosity | OFF |
| hype | trophy | word-pop | scale | orange | fill | dynamic | shock | ON (0.5s) |
| story | speaking | highlight | none | white | contain | micro | suspense | ON (0.7s) |

### Platform Theme

| Platform | Tag Style | Hook Glow Color |
|---|---|---|
| twitch | viral-glow | #C77DFF (purple) |
| kick | kick-glow | #00E701 (green) |
| youtube | viral-glow | #FF0000 (red) |

### `getMoodPresetForClip(mood, platform)`
Merge `MOOD_PRESETS[mood]` + `PLATFORM_THEME[platform].tagStyle`.

### Mood Selection
- AI detecte → `setDetectedMood(mood)`, `setSelectedMood(mood)`, `moodAiDetected=true`
- User override → `handleMoodSelect(mood)` : `moodAiDetected=false`, applique le preset
- `selectedMood ?? detectedMood` = mood actif pour le scoring

---

## API Routes

### POST `/api/enhance/ai-optimize`

**Auth** : `withAuth` (user connecte requis)
**Rate limit** : 30/jour (free) | 300/jour (pro/studio) — cle `ai-optimize:{userId}`
**Input** (Zod) :
```typescript
{ transcript: string(max 5000), title?: string(max 500), streamer?: string(max 200), niche?: string(max 100) }
```
**Output** :
```typescript
{ data: { mood, confidence, explanation, secondary_mood, important_words[], caption_reason?, emphasis_reason?, hook_reason?, preset: MoodPreset } }
```
- `caption_reason` : 1 sentence explaining why this caption style fits THIS clip's content (max 150 chars)
- `emphasis_reason` : 1 sentence explaining why the emphasis effect fits THIS clip's energy
- `hook_reason` : 1 sentence explaining why this hook approach works for THIS clip
**Fallback** : sur erreur, retourne `mood:'hype'`, `confidence:30`.
**429** : "Daily limit reached (30/day). Upgrade to Pro for 300/day."

### POST `/api/render/hook`

**Auth** : `withAuth` (frontend hook generation) | HMAC signature (VPS webhook callback)
**Rate limit** (frontend only) : 50/jour (free) | 500/jour (pro/studio) — cle `render-hook:{userId}`
**HMAC** : VPS webhook signe avec `WEBHOOK_SECRET` via header `X-Webhook-Signature: sha256=<hex>`. Mode warn-only quand `WEBHOOK_HMAC_ONLY=false`.
**Input** (Zod — frontend) :
```typescript
{
  transcript: string, wordTimestamps: [{word, start, end}], audioPeaks: [{time, amplitude}],
  duration: number, title: string, streamerName: string, niche: string,
  hookLength: number(0-300), maxContext: number
}
```
**Proxy** : forwarde au VPS Railway.
**Output** :
```typescript
{ data: { peak: { peakTime, peakScore, scores[], windowSize }, hooks: [{ style, label, text }], reorder: { segments, totalDuration, peakTime } } }
```
**429** : "Daily limit reached (50/day). Upgrade to Pro for 500/day."

### POST `/api/render`

**Voir section "Render Pipeline" dans SYSTEM-REFERENCE.md pour le detail complet.**

Body construit par `handleRender()` :
```typescript
{
  clip_id: string,
  source: 'clips' | 'trending',
  settings: {
    captions: { enabled, style, wordsPerLine, animation, emphasisEffect, emphasisColor, customImportantWords, position },
    splitScreen: { enabled, brollCategory, ratio, layout: 'top-bottom' },
    tag: { style, size, authorName, authorHandle, overlayPng, overlayAnchorX, overlayAnchorY },
    format: { aspectRatio, videoZoom },
    smartZoom: { enabled, mode },
    audioEnhance: { enabled },
    autoCut: { enabled, silenceThreshold },
    hook: { enabled, textEnabled, reorderEnabled, text, style, textPosition, length, reorder, overlayPng, overlayCapsuleW, overlayCapsuleH },
  }
}
```

---

## Render Flow (Frontend)

### Pipeline Summary (self-contained)

Le render complet, de A a Z, sans avoir besoin de lire un autre fichier :

```
Frontend                          API                              VPS Railway
--------                          ---                              -----------
1. Capture hook PNG (Canvas 2D)
2. Capture tag PNG (Canvas 2D)
3. Build settings payload
4. POST /api/render -----------> 5. Zod validation
                                 6. Auth + quota check
                                 7. Concurrency guard (Redis)
                                 8. Forward to VPS ------------->  9. FFmpeg pipeline:
                                                                     - Download source video
                                                                     - Apply hook reorder
                                                                     - Burn captions (ASS)
                                                                     - Split-screen + blur fill
                                                                     - Overlay hook text PNG
                                                                     - Overlay tag PNG
                                                                     - Smart zoom filter
                                                                     - Audio enhance
                                                                     - Auto-cut silences
                                                                     - Encode H.264 9:16
                                                                  10. Upload MP4 -> Supabase Storage
                              <----------------------------------11. Webhook callback (status + URL)
12. Poll GET /api/render/status
13. Receive signed download URL
14. Switch preview to rendered MP4
```

### `handleRender()`

```
1. setRendering(true), revert to CSS preview si on etait en mode Rendered
2. Capture hook overlay PNG (Canvas 2D) si hookEnabled + hookTextEnabled + hookText
3. Capture tag overlay PNG (Canvas 2D) si tagStyle !== 'none'
4. POST /api/render avec settings + overlays
5. Response handlers:
   ├── !ok || !data → error message
   ├── vpsReady === false → warning message + original URL
   ├── jobId present → startPolling(jobId)
   └── else → "Render started!"
```

### Polling (`startPolling(jobId)`)

- Interval : 3s
- Max polls : 200 (= 10 min)
- `sessionStorage.setItem('render-job:{clipId}', jobId)` pour persistence
- On `done` : clear poll, save download URL, set rendered video URL, show success message
- On `error` : clear poll, show error message
- On `rendering` : show queue position if available, else "30-60 seconds"
- Timeout (>200 polls) : warning message, stop polling, keep sessionStorage

### Resume on Mount
- Check `sessionStorage.getItem('render-job:{clipId}')`
- Probe `/api/render/status` une fois
- Si `done`/`error` ou still active → `startPolling()` pour gerer le terminal state

---

## Overlay Capture

### Hook Overlay (`lib/capture-hook-overlay.ts`)
- Pure Canvas 2D (pas de SVG foreignObject — taint le canvas)
- Scale = `videoWidth / 280` (preview width = 280px)
- Capsule noire `rgba(0,0,0,0.75)` + border glow (couleur plateforme)
- Text uppercase, font 900, Segoe UI / system fonts
- Retourne `{ png: base64, capsuleW, capsuleH, positionPct }`

### Tag Overlay (`lib/capture-tag-overlay.ts`)
- Meme approche Canvas 2D
- Scale facteur = `videoWidth / 280 * (tagSize / 100)`
- Twitch logo via Path2D du SVG path
- Glow styles avec `shadowBlur` / `shadowColor`
- Retourne `{ png: base64, w, h, anchorX, anchorY }`

---

## Render Schema (`lib/schemas/render.ts`)

Single source of truth Zod. Utilise par :
- `POST /api/render` (validation du body)
- `POST /api/render/quick` (auto-build from mood preset)
- Frontend `handleRender()` (contract reference)
- VPS `vps/routes/render.js` (destructure `req.body.settings`)

### Key Schema Points
- `captions.animation` : string (derive du captionStyle dans le frontend)
- `hook.reorder` : nullable object avec segments array
- `hook.overlayPng` : nullable string (base64)
- `audioEnhance.bassBoost` / `speedRamp` : enum avec defaults `'off'`
- `autoCut.silenceThreshold` : 0.2-1.0
- `autoCut.mood` : string (pour adaptive threshold server-side)
- `format.videoZoom` : enum `contain | fill | immersive`
- `smartZoom.mode` : enum `micro | dynamic | follow`

---

## CSS Animations

### Keyframes (inline `<style>` dans LivePreview)

```css
@keyframes kenburns {
  0% { transform: scale(1) translate(0, 0); }
  100% { transform: scale(1.08) translate(-2%, -1%); }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 15px rgba(249, 115, 22, 0.3); }
  50% { box-shadow: 0 0 25px rgba(249, 115, 22, 0.5), 0 0 50px rgba(249, 115, 22, 0.15); }
}

@keyframes smartZoomMicro {
  0% { transform: scale(var(--sz-from)); }
  100% { transform: scale(var(--sz-to)); }
}

@keyframes smartZoomDynamic {
  0% { transform: scale(var(--sz-from)); }
  15% { transform: scale(var(--sz-to)); }   /* punch 1 */
  25% { transform: scale(var(--sz-from)); }
  50% { transform: scale(var(--sz-from)); }
  65% { transform: scale(var(--sz-to)); }   /* punch 2 */
  75% { transform: scale(var(--sz-from)); }
  100% { transform: scale(var(--sz-from)); }
}

@keyframes smartZoomFollow {
  0%   { transform: scale(var(--sz-to)) translate(0%, 0%); }
  20%  { transform: scale(var(--sz-to)) translate(-0.8%, 0.3%); }
  40%  { transform: scale(var(--sz-to)) translate(0.5%, -0.4%); }
  60%  { transform: scale(var(--sz-to)) translate(1%, 0.2%); }
  80%  { transform: scale(var(--sz-to)) translate(-0.3%, -0.2%); }
  100% { transform: scale(var(--sz-to)) translate(0%, 0%); }
}
```

### CSS vars pour Smart Zoom
- `--sz-from` : base zoom (1.0 pour contain, 1.15 pour fill, 1.35 pour immersive)
- `--sz-to` : `baseZoom * 1.05` (micro/dynamic) ou `baseZoom * 1.20` (follow)

### Blowup Chance Animations (referenced in page)
- `barGlow` : pulse de `via-white/8`, 3s infinite
- `scorePop` : scale pop 0.4s ease-out
- `confettiDrop` : drop 0.5s ease-out

### AI Optimize Button
- `shimmer_2s_infinite` : gradient blanc translucide qui traverse horizontalement

### Framer Motion (AIAnalysisSequence)
- Steps : `initial={{ opacity: 0, x: -8 }}` → `animate={{ opacity: 1, x: 0 }}`
- Result card : `initial={{ opacity: 0, y: 8, scale: 0.97 }}` → full
- Reveal text : `initial={{ opacity: 0, y: 4 }}` → full
- Loading bar per step : `width: 0 → 100%`, duration = step.duration

---

## Publish Integration

### PublishDialog
Reutilise `components/distribution/publish-dialog.tsx` depuis Distribution.
Props : `open`, `onClose`, `clipId`, `clipTitle`.
S'ouvre via le bouton "Publish to socials" (disabled tant que `!renderDownloadUrl`).

---

## updateSetting Behavior

```typescript
const updateSetting = useCallback(<K extends keyof EnhanceSettings>(key: K, value: EnhanceSettings[K]) => {
  setSettings(s => ({ ...s, [key]: value }))
  // First change → auto-switch to Enhanced preview
  if (!hasUserChangedSettings.current) {
    hasUserChangedSettings.current = true
    setShowEnhancements(true)
  }
  // If rendered video was showing → revert to CSS preview
  if (isRenderedVideo) {
    setIsRenderedVideo(false)
    setRenderDownloadUrl(null)
    setRenderMessage(null)
  }
}, [isRenderedVideo])
```

---

## Error Handling

### Render Errors (`ErrorCard`)
Utilise `classifyError(message)` pour categoriser :
- `timeout` : "render server timed out, try again or shorten"
- `quota` : "monthly limit hit, upgrade" + secondary action → /settings
- `network` : "check internet connection"
- default : "something went wrong, try again"

Chaque ErrorCard a un bouton Retry qui `setRenderMessage(null)` + `handleRender()`.

### Loading State
Skeleton avec 4 panels animes + preview 9:16 a droite.

### Error State
AlertCircle + message + "Back to feed" button.

---

## Edge Cases & Guards

### Clip sans transcript
- Hook generation skip : si pas de `wordTimestamps`, le bouton "Detect viral moment" est desactive
- Captions : preview montre les sample words statiques, render echoue gracefully si pas de transcript Whisper
- AI Optimize : mood detection fonctionne quand meme (utilise title + niche comme fallback)

### Mood API timeout (>15s)
- Fallback automatique : `mood='hype'`, `confidence=30`
- Le flow continue normalement (hook generation + sequence + render)
- L'user ne voit pas d'erreur — juste un mood potentiellement moins precis

### Hook API fail
- Silent fail : `hookAnalysis` reste null
- Si `hookReorderEnabled=true` mais pas de `hookReorder` data -> auto-render guard BLOQUE (attend les donnees)
- L'user peut toujours ecrire un hook text custom manuellement

### User spam "AI Optimize"
- Pas de debounce explicite cote frontend
- Chaque clic relance le full pipeline (mood + hook + sequence)
- Le dernier resultat ecrase les precedents
- Risque : double API calls, mais pas de corruption de state

### Double render call
- `rendering` boolean empeche un 2eme `handleRender()` pendant qu'un render tourne
- Le polling ne demarre qu'une fois (guard `pollingRef.current`)
- SessionStorage stocke UN seul jobId par clipId — un nouveau render ecrase l'ancien

### Render stuck / VPS down
- Polling max : 200 x 3s = 10 minutes
- Apres 200 polls : warning message, polling s'arrete, jobId reste en sessionStorage
- Pas de timeout auto-transition vers error (documente dans Axes d'Amelioration #10)
- User peut retry manuellement via le bouton Retry dans ErrorCard

### Upload sans video URL
- Si Supabase Storage signed URL echoue -> error state avec "Failed to load video"
- Preview reste vide, settings sont quand meme editables
- Render va fail cote VPS (pas de source video)

### Clip Kick (pas de MP4 direct)
- Pas de resolution MP4 pour Kick — fallback sur thumbnail dans la preview
- Render fonctionne quand meme si le VPS peut download via l'URL externe
- Documente dans Axes d'Amelioration #5

---

## Statut par Feature

| Feature | Status | Notes |
|---|---|---|
| Live CSS preview (captions, tags, split, hook, zoom) | **WIRED_REAL** | Temps reel, reflete settings |
| Mood detection (Claude Haiku) | **WIRED_REAL** | API call reel via `/api/enhance/ai-optimize` |
| Hook text generation (VPS) | **WIRED_REAL** | API call reel via `/api/render/hook` |
| Full FFmpeg render | **WIRED_REAL** | VPS Railway + Supabase Storage |
| Render polling | **WIRED_REAL** | 3s interval, sessionStorage persistence |
| Blowup Chance scoring | **WIRED_REAL** | Real diminishing-returns formula |
| Score breakdown (+X pts) | **WIRED_REAL** | `computeScoreBreakdown()` avec mood bonuses |
| AI Analysis Sequence | **WIRED_REAL** | Uses real hookAnalysis data (peaks, peakTime, peakScore) with seeded fallback |
| Analysis justifications | **WIRED_REAL** | AI-generated per-clip reasons from mood detector (caption_reason, emphasis_reason, hook_reason) with static fallback |
| "Viral pattern detected" | **WIRED_REAL** | Conditional on peakScore > 7 (real hook analysis data) |
| Audio peaks / segments counts | **WIRED_REAL** | Uses hookAnalysis.peak.scores.length when available, seeded fallback otherwise |
| Before/After player | **NOT_IMPLEMENTED** | Composant existe (`before-after-player.tsx`) mais pas wire dans la page |
| Mood selector (user override) | **WIRED_REAL** | `handleMoodSelect()` applique le preset |
| Overlay capture (Canvas PNG) | **WIRED_REAL** | Capture reelle pour VPS render |
| Publish dialog | **WIRED_REAL** | Reutilise Distribution publish flow |
| Download | **WIRED_REAL** | `<a href={renderDownloadUrl} download>` |
| Caption position presets | **WIRED_REAL** | Top=8, Middle=42, Bottom=72 |
| Custom important words | **WIRED_REAL** | Stocke dans settings, envoye au VPS |
| B-roll video options | **DEAD_CODE** | `BROLL_OPTIONS` existe dans scoring.ts mais UI remplacee par Blur fill toggle |

---

## Axes d'Amelioration

1. **Before/After player** — composant existe mais pas integre. Le bouton "Compare" est mentionne dans SYSTEM-REFERENCE mais absent du code de la page.

2. **Bass Boost / Speed Ramp UI** — les options sont dans `EnhanceSettings` et le scoring mais pas exposees dans l'Accordion. Actuellement set uniquement par mood presets.

3. **Store Zustand** — tout le state est local (30+ useState). Extraire vers un store Zustand ameliorerait la maintenabilite et permettrait le partage entre composants.

4. **Mood selector visible** — apres "AI Optimize", pas de moyen de changer le mood manuellement dans l'UI actuelle (seulement via re-click "AI Optimize"). `handleMoodSelect` existe mais aucun UI l'appelle.

5. **Kick video preview** — pas de resolution MP4 pour Kick. Fallback sur thumbnail. Pourrait utiliser le kick-proxy HLS.

6. **Render progress** — polling fixe 3s. Migration vers `useRenderSubscription` (Supabase Realtime + adaptive backoff) comme le Browse.

7. **Score animation** — le count-up fonctionne mais la `displayScore` initiale = `currentScore` ce qui skip l'animation au premier render.

8. **B-roll cleanup** — `BROLL_OPTIONS` et `brollScores` dans scoring.ts sont dead code depuis le remplacement par Blur fill. Nettoyer.

9. ~~**Adaptive auto-cut hint**~~ — RESOLU (2026-05-04). Le hint adaptatif par mood est implemente dans Accordion Section 6 : "AI suggests Xs for {mood} clips" (rage/hype=0.5s, drama=0.7s). `autoCut.mood` envoye au VPS pour threshold server-side.

10. **Timeout recovery** — mentionne dans SYSTEM-REFERENCE.md (60s auto-transition to error si stuck) mais pas implemente dans le code actuel. Le seul guard est le polling max 200 * 3s = 10min.

---

## Qualite de rendu (v2 — 2026-07-02)

### 4 tiers (retry ladder automatique)

Si FFmpeg OOM (exit code null/137), le systeme retente automatiquement au tier suivant avec log `[FFmpeg] fallback tier N`.
Pilote par env var `RENDER_QUALITY` (defaut `high`).

| Tier | Resolution | Preset | CRF | Maxrate | Bufsize | FPS | Profile/Level | Audio | Unsharp |
|------|-----------|--------|-----|---------|---------|-----|---------------|-------|---------|
| **HIGH_60** | 1080x1920 | faster | 19 | 12M | 24M | 60 (si source >= 50fps, sinon 30) | high / 4.2 | 192k | oui |
| **HIGH_30** | 1080x1920 | faster | 20 | 8M | 16M | 30 | high / 4.2 | 192k | oui |
| **SAFE** | 720x1280 | veryfast | 23 | 5M | 10M | 30 | high / 4.1 | 160k | non |
| **LAST_RESORT** | 720x1280 | ultrafast | 26 | 4M | 8M | 30 | high / 4.1 | 160k | non |

Flags communs a tous les tiers : `-profile:v high -level:v 4.2/4.1 -pix_fmt yuv420p -fps_mode cfr -sc_threshold 0 -movflags +faststart -tag:v avc1 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -threads 2 -filter_threads 1 -filter_complex_threads 1`

Audio tous tiers : `-c:a aac -b:a {192k|160k} -ar 48000 -ac 2`

### Ordre du filtergraph

```
1. scale/crop (compositing blur-bg + foreground lanczos)
2. smart zoom (scale/crop avec lanczos)
3. eq (exposition adaptative — 4 buckets)
4. unsharp=5:5:0.25:3:3:0.0 (HIGH tiers uniquement)
5. subtitles ASS (burn APRES le scale final → texte net)
6. overlays PNG (tag + hook)
7. watermark
8. format=yuv420p (terminal)
```

Regle : les sous-titres se burn APRES le scale final, jamais avant (sinon texte mou).

### Exposition adaptative (4 buckets)

| avgLuma | eq filter |
|---------|-----------|
| < 65 | brightness=0.035:contrast=1.08:saturation=1.08:gamma=1.03 |
| 65-95 | brightness=0.015:contrast=1.05:saturation=1.05:gamma=1.01 |
| 95-140 | brightness=0:contrast=1.02:saturation=1.04 |
| > 140 | pas de filtre eq |

### ASS PlayRes

`PlayResX` / `PlayResY` suivent dynamiquement la resolution du tier (1080/1920 en HIGH, 720/1280 en SAFE). `ScaledBorderAndShadow: yes` active. Font sizes 64-88px calibres pour 1080x1920 (adaptes automatiquement par `adjustPositioning` pour 720p).

### Audio Enhancement

Quand `audioEnhance` est ON : `highpass=f=80,afftdn=nf=-25,loudnorm=I=-14:LRA=11:TP=-1.5:linear=false:dual_mono=true`

### Overlays PNG

Les overlays (hook + tag) sont captures en Canvas 2D a `videoWidth=1080` (resolution de sortie HIGH). Scale factor = `1080 / 280` (preview width = 280px).

---

## Systemes connexes

| Systeme | Relation avec le render |
|---------|------------------------|
| **Enhance editor** | Declencheur principal — settings UI → POST /api/render → VPS FFmpeg |
| **Quick Export (Browse)** | 1-click export depuis Browse clips — auto mood + preset → meme pipeline render |
| **Autofarm (Distribution)** | Futur — clip bank → smart publisher → auto-enhance + auto-post |
| **Whisper transcription** | OpenAI Whisper API sur le VPS — word-level timestamps pour captions ASS |
| **Supabase Storage** | Stockage des MP4 rendus (bucket `clips/`), thumbnails, source videos |
| **Railway VPS** | Serveur FFmpeg — Dockerfile, auto-deploy via git push sur branche `master`, `railway.toml` dans `vps/` |
| **Redis (Upstash)** | File d'attente FIFO des render jobs, concurrence max configurable |

Deploy VPS : Railway auto-deploy depuis le Dockerfile dans `vps/`. Config dans `vps/railway.toml`. Env var `RENDER_QUALITY=high` a ajouter dans Railway (pas Netlify).

Version : v2 — 2026-07-02
