# SYSTEM REFERENCE — Distribution Page (v9.2 — Polish Pass + Design Constitution)

> Source de verite pour la page Distribution.
> Derniere mise a jour : 2026-07-02 — wolf brain -15%, clip bank 180px, AI FIT→Match, empty state voice, mini-KPIs orbit, amber=actions only.

---

## Architecture

| Fichier | Role |
|---|---|
| `components/distribution/distribution-hub.tsx` | Composant principal (~2177 lignes) — header, Caption + Publish strip, Connection Map (brain core + platforms), Smart Queue, Clip Bank |
| `components/distribution/distribution-hub.css` | Styles dedies (~3554 lignes) — cyan theme, glass cards, modal overlays, scrollbars, animations |
| `components/distribution/platform-picker-modal.tsx` | Modal Platform Picker (~165 lignes) — selectionner plateformes, accessibilite (Escape, aria-modal) |
| `components/distribution/clip-picker-modal.tsx` | Modal Clip Picker (~153 lignes) — Bank/Remixes tabs, selectionner clip a publier |
| `lib/ai/caption-engine.ts` | AI Caption Engine : Claude Haiku per-platform captions + hashtags (WIRED_REAL) |
| `app/api/captions/distribution/route.ts` | POST endpoint : auth, Zod, rate limit, cache, DB persist |
| `lib/distribution/caption-engine.ts` | Moteur de captions template (fallback) : 10 tones, block mixing, risk/reward metadata |
| `lib/distribution/tracking-simulator.ts` | Simulation post-publish : chaos engine + variant-aware projections |
| `lib/distribution/strategy-engine.ts` | Strategie dynamique : frequence, priorite, messages, confidence |
| `lib/distribution/user-memory.ts` | Memoire session : tracking patterns, insights personnalises |
| `lib/distribution/session-persistence.ts` | Persistance cross-session (localStorage) : streaks, progression, "What Worked" |
| `lib/distribution/reward-engine.ts` | Recompenses : milestones, streaks, rare events, creator levels |
| `lib/distribution/smart-queue-engine.ts` | Smart Queue — timing, sequencing, risk, learning, confidence |
| `stores/queue-store.ts` | Zustand — queue state, learning data, settings, override handling |
| `stores/distribution-store.ts` | Zustand — accounts, publish targets, publish logic |
| `app/(dashboard)/dashboard/distribution/page.tsx` | Page wrapper (Suspense + metadata) |

---

## Layout (top to bottom, v8)

```
1. Header — "Distribution" + sub + CLIP FARM ONLINE/STANDBY chip + settings icon
2. Reward Toast (top-right, auto-dismiss 5s)
3. Strategy Block — frequency, priority, countdown, confidence %, strategy message, streak badge
4. Personalized Insights (apparait apres 1+ publish)
5. Publish Strip — 2-col grid (mobile: stack)
   ├── Caption Studio (AI) — Generate AI captions / per-platform variants / copy / regenerate
   └── Publish card — clip preview (clickable, opens picker) + targets line + Post now CTA
6. Connection Map (brain core section)
   ├── 4 platform cards positioned at circle edges (TikTok TL, IG TR, YouTube BL, Facebook BR)
   ├── Dynamic SVG flow lines (corner-targeting, L-shaped bezier, animated particles)
   ├── AI Brain Core (centered)
   │   ├── 3 concentric glass rings + outer rotating dashed ring + cyan/orange node accents
   │   ├── Brain SVG (cyan gyri + neural nodes)
   │   ├── Wolf SVG (orange neon emblem) — centered in brain negative space
   │   └── 4 subtle bridges (neural nodes ↔ wolf edges)
   └── CLIP FARM panel (below brain)
       ├── Title: "CLIP FARM RUNNING" / "CLIP FARM OFF"
       ├── Subtext (RUNNING): "{N} clips synced · {M} scheduled · learning enabled"
       ├── Hint (OFF): "Turn on to start distributing your clips"
       ├── Pill toggle: "● Auto-Distribute │ On/Off"
       └── Stats: NEXT POST · QUEUE
7. Smart Queue Section (v7) — AI Schedule timeline (existing)
8. Clip Bank — horizontal rail, cyan theme, state hierarchy, X remove buttons, + Add clips
9. Recent Activity
10. What Worked
11. Stats Row + Creator Level
12. Modals (overlay):
    ├── Platform picker — opens on "Post now" click
    └── Clip picker — opens on clip preview/empty state click (Bank/Remixes tabs)
```

> **Note:** PLATFORMS const `optimalHours` arrays use AM/PM legacy format (e.g. `'7 PM'`, `'11 AM'`). Consider migrating to 24h integers for consistency with `en-GB` time formatting used elsewhere.

---

## AI Brain Core (Connection Map center) — v10 State Machine + Alive+

### Core State Machine
```typescript
type CoreState = 'paused' | 'running' | 'publishing' | 'success'
```
- `paused` : toggle OFF. Brain grayscale, animations paused, single amber rest-node breathing.
- `running` : toggle ON, idle. Neural cascade (4.8s), wolf flash synced, bridges animate.
- `publishing` : active publish in progress. Cascade 2.4s, bridges .8s, wolf continuous pulse. Chips show "POSTING".
- `success` : ~3s after publish. Single amber wolf pulse, then back to running.

Class applied: `.dist-core-wrap.state-${coreState}` (+ `.off` when paused for backward compat).

### Brain Alive+ Animations (running state)
1. **Neural cascade** : 8 nodes fire top→bottom (staggered f0-f3, delays 0/.18/.36/.54s of 4.8s cycle)
2. **Node halos** : r 3→7→10 expand + fade on each fire
3. **Bridge flow** : dashoffset -12 (1.6s) + deliver pulse (opacity/glow at 92% of 4.8s)
4. **Wolf flash** : synced at .9s delay — drop-shadow burst at cycle 92%
5. **Fissure spark** : small cyan dot descends central fissure (78-84% of cycle)
6. **Publishing** : all timings halved (2.4s cascade), wolf continuous 1.8s pulse
7. **Paused** : rest-node (amber r3, 3.2s breathe) at brain top, everything else frozen
8. **Wolf fill** : opaque #020617 (brain lines no longer bleed through)

### Accessibility
- Platform chips: `<button>` with `aria-pressed` (toggles) or `aria-label` (CONNECT)
- Pill toggle: `role="switch"` + `aria-checked`
- Focus-visible: 2px cyan outline + offset on all interactive elements
- `<p class="sr-only" aria-live="polite">` announces publishing/success
- `prefers-reduced-motion`: all animations disabled, animateMotion SVG particles not rendered

### Performance
- All `transition: all` replaced by targeted property lists (36 instances)
- `.dist-core-wrap { isolation: isolate; contain: paint; }`
- `will-change` on outer-ring and connector (the only continuously animated elements)
- ElectricBorder: speed 1.4, chaos 0.04 (calmer current)

### Concept
Centre visuel de la page. Symbolise le "AI control center" qui orchestre la distribution.

### Structure JSX
```jsx
<div className="dist-core-wrap">
  <div className="dist-core-glow" />
  <div className="dist-core-glass" />
  <svg viewBox="0 0 320 320">
    <defs>...filters + gradients...</defs>

    {/* Concentric rings — depth */}
    <circle r="148" /> {/* outer glass */}
    <circle r="142" /> {/* mid */}
    <circle r="128" /> {/* inner */}

    {/* Outer ring (rotating dashes + accent nodes) */}
    <g className="dist-core-outer-ring">
      <circle r="148" strokeDasharray="2 7" />
      <circle cx="308" cy="160" fill="#7DD3FC" />  {/* cyan node */}
      <circle cx="12" cy="160" fill="#7DD3FC" />
      <circle cx="160" cy="12" fill="#FB923C" />   {/* orange brand accent */}
    </g>

    {/* Static dashed inner ring (counter-stable) */}
    <circle r="138" strokeDasharray="1 5" />

    {/* Brain (translated +30 to fit viewBox) */}
    <g transform="translate(0 30)">
      {/* soft fills, lobes with brainGlow filter, fissure (split to skip wolf area),
          inner grooves (cyan), neural nodes */}
    </g>

    {/* Wolf — neon emblem, centered in brain negative space (opaque fill) */}
    <g className="dist-brain-wolf" transform="matrix(0.55 0 0 0.55 119.3 118.925)" filter="url(#wolf-glow)">
      <path fill="#020617" stroke="#FFC58A" strokeWidth="2.4" />
    </g>

    {/* 4 subtle bridges neural-node → wolf */}
    <g className="dist-brain-bridges">...</g>
  </svg>

  {/* Mini-KPIs in orbit around brain */}
  <div className="dist-brain-kpis">
    <span className="dist-brain-kpi kpi-tl">TikTok ON</span>
    <span className="dist-brain-kpi kpi-tr">Bank 20 clips</span>
    <span className="dist-brain-kpi kpi-br">Next drop 19:00</span>
  </div>

  <div className="dist-core-connector-line" />
  <div className="dist-core-panel">...CLIP FARM panel...</div>
</div>
```

### Brain dimensions (v9.2 — reduced 15%)
- `.dist-core-wrap` : **340×340px** (was 400×400)
- `.dist-brain-svg` : **272×272px** (was 320×320)
- CLIP FARM panel remounts closer

### Mini-KPIs
3-4 discret pills orbiting the brain showing live system state:
- "TikTok ON" (top-left)
- "Bank {N} clips" (top-right)
- "Next drop {time}" (bottom-right, only when scheduled)
Font 9px, 600 weight, cyan/60 color, background rgba(9,9,11,.7), border cyan/15, radius 6px.

### Filters (defs)
- `wolf-glow` : 3-layer drop shadow (1.2px / 4px / 12px) avec couleurs #FED7AA / #FB923C / #F97316
- `brainGlow` : feGaussianBlur stdDeviation=5 + feColorMatrix cyan (0.15, 0.75, 1) + feMerge

### Gradients (defs)
- `brainStroke` : linear cyan #7DD3FC → #38BDF8 → #0EA5E9
- `brainSoftFill` : vertical fade #38BDF8 (0.16) → #0EA5E9 (0.04)
- `cyan-orange` : pour les bridges (cyan → orange)

### Wolf positioning (matrix transform)
- Wolf head bbox center : (74, 76.5) en coords original
- Brain center after translate(0 30) : (160, 161)
- Matrix : `matrix(0.55 0 0 0.55 119.3 118.925)` → place head center exactement a (160, 161)
- Scale 0.55 → wolf occupe ~38% du diametre du brain

### Fissure split
La fissure centrale est coupee en 2 segments pour ne pas traverser le visage du loup :
- Segment haut : `M160 45 L160 78`
- Segment bas : `M160 188 L160 218`

### Animations
- `.dist-core-outer-ring` : rotation 50s linear infinite (anneau dashed + nodes)
- `.dist-brain-bridges` : opacity pulse 4s (`dist-bridge-pulse`)
- Orange accent node : opacity 0.5→1 breathing 3s
- `.dist-core-glow` : scale pulse 4s (`dist-breathe`)
- `.dist-core-wrap.off *` : grayscale + animation paused

---

## CLIP FARM Panel — v8 NEW

### Position
Absolute, `bottom: -185px` from brain wrap (15px plus proche que la version initiale).

### Structure
```jsx
<div className="dist-core-panel {on|off}">
  <div className="dist-core-panel-head">
    <span className="dist-core-panel-title">CLIP FARM RUNNING|OFF</span>
    {RUNNING && <span className="dist-core-panel-subtext">N clips synced · M scheduled · learning enabled</span>}
    {OFF && <span className="dist-core-panel-hint">Turn on to start distributing your clips</span>}
  </div>

  <button className="dist-core-pill {on|off}">
    <span className="pill-orb" />        {/* 8px circle, pulses when off */}
    <span className="pill-label">Auto-Distribute</span>
    <span className="pill-state">On|Off</span>  {/* border-left separator */}
  </button>

  <div className="dist-core-panel-stats">
    <div className="dist-core-stat">
      <span className="stat-label">Next post</span>
      <span className="stat-value">Today HH:MM</span>  {/* en-GB locale → 24h */}
      <span className="stat-sub">Instagram Reels</span>  {/* PLATFORMS.find(...).label */}
    </div>
    <div className="dist-core-stat-divider" />
    <div className="dist-core-stat">
      <span className="stat-label">Queue</span>
      <span className="stat-value">N scheduled</span>
      <span className="stat-sub">+M ready next</span>
    </div>
  </div>
</div>
```

### Pill toggle (dist-core-pill) — premium horizontal
- Forme : pill 999px radius, 9px padding
- ON : border cyan 0.6, glow box-shadow inset+outer cyan, state cyan #38BDF8
- OFF : border cyan 0.35 (still cyan, not gray), pill `breathe` animation 2.4s, orb pulse + scale 1→1.25 (1.6s), pulsing outer ring `::after` (cyan, scale 1→1.06)
- Hover (off) : border 0.7, glow 0.32, animations stop, orb fixed cyan
- Le but de l'etat OFF : "system en attente, click pour activer" (inviting, pas mort)

### Connector line (brain → panel)
```css
.dist-core-connector-line {
  bottom: -5px;
  height: 80px;   /* bridges from ~75px above container bottom to panel top (5px below) */
  background-image: repeating-linear-gradient(to bottom, #38BDF8 0-8px, transparent 8-20px);
  animation: dist-connector-flow 1.4s linear (background-position scroll);
}
.dist-core-connector-line::after { bottom: -5px; /* aligns with panel port */ }
```
- OFF state : gradient gray, no animation
- Visually bridges the full gap between brain bottom and CLIP FARM panel top

### CLIP FARM panel positioning
- **Top-anchored** : `top: calc(100% + 5px)` — content grows DOWNWARD, never into the brain
- **Clearance reserved** : `.dist-core-wrap` uses `padding-bottom: var(--core-panel-clearance)` (320px)
  so the absolutely-positioned panel pushes the Clip Bank section down instead of overlapping it.
  `height` changed to `min-height: 340px` + `box-sizing: content-box` so the padding actually extends the box.
- **Fixed footprint** : `.dist-core-panel-head { min-height: 48px }` reserves hint space in ON mode,
  `.pill-label { white-space: nowrap }` prevents wrap → zero layout shift ON↔OFF
- Panel port (::before top:-5px) sits at container bottom, receives the connector line

### Funnel lines (panel → Clip Bank)
```
SVG .dist-funnel.flipped — viewBox 1316×100, 7 bezier paths
- Converge from spread-out top points → center bottom (flipped via scaleY(-1))
- ON state: .dist-flow-path.blue (cyan animated dashes + 2 particle circles)
- OFF state: .dist-flow-path.dim (gray, no animation)
- Height: 100px (CSS), margin: -4px 0 (tight coupling to adjacent elements)
- Visually connects bottom of CLIP FARM panel to top of Clip Bank rail
```

---

## Connection Map (platforms ↔ brain) — v8 NEW

### Container
```css
.dist-connection-map {
  min-height: 640px;
  box-sizing: border-box;
  display: grid;
  place-items: start center;  /* brain anchored to TOP */
  padding-top: 20px;
  padding-bottom: 40px;
}
```

### Math
- Container total : 640px (border-box)
- Padding : top 20 + bottom 40 = 60
- Content area : 580px
- Brain wrap (400×400) at TOP of content → wrap from y=20 to y=420
- Outer circle (radius 148, centered at wrap center y=220) → y=72 to y=368
- Apps with 32px overhang :
  - Top apps : `top: 40px` → app extends 40-160 (32px above circle top y=72)
  - Bottom apps : `bottom: 240px` → app extends 280-400 (32px below circle bottom y=368)
  - Gap top-app-bottom (160) ↔ bottom-app-top (280) = **120px**

### Platform card positions
```css
.dist-plat-node {
  width: 110px;
  text-align: center;
  user-select: none;
  -webkit-user-drag: none;
}
.pos-tl { left: 40px; top: 40px; }
.pos-tr { right: 40px; top: 40px; }
.pos-bl { left: 40px; bottom: 240px; }
.pos-br { right: 40px; bottom: 240px; }
```

### Platform card content
- Icon (72×72 glass) — wrapped in `<ElectricBorder>` if active
- Name (12px, white-space: nowrap, max-width: 110px)
- Toggle/badge :
  - Connected + active (master toggle ON) : `● ON` (green dot + label)
  - Connected + master OFF : `● OFF` (gray) — auto-OFF when master toggle is off
  - Not connected : `Connect` (purple dashed pill → /settings)
  - Coming soon : `Soon` (gray)

### Active state logic
```ts
const isActive = isConn && isEnabled && aiAutoDistribute
// → toutes les apps deviennent visuellement OFF si master toggle OFF
```

### Flow lines (dynamic SVG paths)
```jsx
<svg className="dist-map-svg" preserveAspectRatio="none">
  <defs>
    <filter id="particle-glow">...feGaussianBlur stdDeviation=2...</filter>
  </defs>
  <path id="flow-path-{id}" className="dist-flow-path {blue|dim}" d={flowPaths[id]} />
  {/* Animated particles when active */}
  {isPlatActive(id) && (
    <>
      <circle r="3.5" fill="#38BDF8" filter="url(#particle-glow)">
        <animateMotion dur="2.6s" repeatCount="indefinite" path={flowPaths[id]} />
      </circle>
      <circle r="2" fill="#7dd3fc" opacity="0.7">
        <animateMotion dur="2.6s" begin="0.9s" repeatCount="indefinite" path={flowPaths[id]} />
      </circle>
    </>
  )}
</svg>
```

### Path computation (pathTo)
```ts
// Click → corner of card closest to brain center
const sx = cardCx < targetX ? cardR : cardL  // inner X (right or left)
const sy = cardCy < targetY ? cardB : cardT  // inner Y (bottom or top)

// End point: 105px short of brain center (lands at outer ring)
const stopShort = 105

// Bezier control points: line LEAVES brain horizontally, then curves vertically to card
// (down for bottom apps, up for top apps)
const c1 = (sx, sy + (ey - sy) * 0.85)      // long vertical from card
const c2 = (sx + (ex - sx) * 0.25, ey)      // short horizontal lead-in near card
return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`
```

### ResizeObservers
- Observe : `.dist-connection-map`, brain wrap, chaque platform ref
- Window resize listener
- Double settle : `setTimeout(100)` + `setTimeout(500)` post-mount
- N'importe quel layout shift recalcule les paths

### Path style
```css
.dist-flow-path {
  stroke-dasharray: 8 12;
  stroke-linecap: round;
  filter: drop-shadow(0 0 6px currentColor) drop-shadow(0 0 14px currentColor);
  animation: dist-dash 9s linear infinite;
}
.dist-flow-path.blue { stroke: #38BDF8; opacity: .8; }
.dist-flow-path.dim  { stroke: #475569; opacity: .22; filter: none; }
```
- Master toggle OFF → toutes les paths passent en `dim`, particules ne sont plus rendues

---

## Publish Strip — v8 REDESIGN

### Layout
2-col grid, gap 16px, mobile stack. Replace previous "AI-Generated Caption" + "Publish" cards with simpler versions.

### Card Caption
```jsx
<div className="dist-glass dist-console-card">
  <div className="dist-console-card-head">
    <h3>Caption</h3>
    <p>AI writes a caption for your clip.</p>
    <button className="dist-cyan-btn" onClick={generateBio}>
      Generate | Regenerate | Generating…
    </button>
  </div>

  {/* Steps de generation (progressive) */}
  {bioGenerating && bioStep >= 0 && (
    <div className="dist-console-steps">{BIO_STEPS}</div>
  )}

  {/* Resultat OU empty state */}
  {bioText ? (
    <>
      <div className="dist-caption-box">
        <textarea value={bioText} onChange={...} className="dist-caption-textarea" />
      </div>
      <div className="dist-caption-actions">
        <button onClick={() => navigator.clipboard.writeText(bioText)}><Copy /> Copy</button>
      </div>
    </>
  ) : (
    <div className="dist-caption-empty">
      <Sparkles /> {/* cyan icon in glass circle */}
      <p>Generate a caption for this clip.</p>
      <p>Trending hashtags · tuned for your platforms.</p>
    </div>
  )}
</div>
```

### Card Publish
```jsx
<div className="dist-glass dist-console-card">
  <div className="dist-console-card-head">
    <h3>Publish</h3>
    <p>Send your clip to the connected platforms.</p>
  </div>

  {selectedClip ? (
    <>
      {/* Clip preview clickable → opens clip picker */}
      <button className="dist-next-clip dist-next-clip-btn" onClick={() => setShowClipPicker(true)}>
        <thumbnail with score badge if >= 80>
        <info: title + meta>
        <span className="dist-next-clip-change"><RefreshCw /> Change</span>
      </button>

      {/* Targets line clickable → opens platform picker */}
      <button className="dist-publish-targets dist-publish-targets-btn" onClick={() => setShowPlatformPicker(true)}>
        <TrendingUp /> Posting to <strong>{N} platforms</strong> <ChevronRight />
      </button>

      {/* Single primary action */}
      <button className="dist-cyan-btn primary" onClick={() => setShowPlatformPicker(true)}>
        <Send /> Post now
      </button>
    </>
  ) : (
    /* Empty state — no clip staged */
    <div className="dist-next-empty">
      <Rocket /> "No clip staged"
      <p>"Pick a clip from your bank to publish now, or wait for AI Schedule."</p>
      <button className="dist-cyan-btn" onClick={scrollToBank}><Film /> Pick from bank</button>
      <p>Choose from your bank or your remixes.</p>
    </button>
  )}
</div>
```

### selectedClipId logic (Publish strip — MANUAL ONLY)
- **NOT auto-set** on mount. Publish strip stays EMPTY until explicit user action.
- **NEVER auto-filled from queue.posts[0]** — AI Schedule is a separate world from manual publishing.
- Set when: user clicks Rocket button on a bank card, or arrives from Enhance with `?action=publish&clip={id}`
- NOT set when: user clicks "Place in bank" (bank only, Publish stays empty)
- Empty state (same in ON and OFF modes): Rocket icon muted + "No clip staged" + "Pick from bank" CTA

### Separation: AI-driven vs Manual
| World | Sections | Behavior |
|---|---|---|
| **AI-driven** (machine runs) | Brain panel, AI Schedule, Bank synced badge | Reflects queue state truthfully. Amber when OFF. |
| **Manual** (user action) | Caption strip, Publish strip | ALWAYS empty until user explicitly picks a clip via Rocket. Same empty state in ON and OFF. |

### Plurals & counts rules
- `"1 clip synced"` / `"N clips synced"` — singular when count === 1
- `"1 clip queued"` / `"N clips queued"` — same pattern
- `"+N ready next"` — only shown when N > 0. Hidden (empty string) when N === 0.
- Ready count formula: `max(0, visibleClipsAbove60 - scheduledCount)`
- `"1 clip analyzed"` / `"N clips analyzed"` in learning footer

### Buttons (cyan theme — replaces previous mauve)
- `.dist-cyan-btn` : pill, border cyan 0.4, gradient fill cyan 0.15→0.06, color #7dd3fc, hover glow
- `.dist-cyan-btn.primary` : padding 10px 18px, fill plus opaque, white text, flex: 1
- `.dist-ghost-btn` : pill, border gray 0.18, transparent bg, color #94a3b8, hover cyan 0.4

### Visual Brand (header icon)
- `.dist-icon-mark` uses cyan brand: `linear-gradient(135deg, rgba(56,189,248,.2), rgba(56,189,248,.08))`, border cyan 0.35, color `#7DD3FC`
- No more violet/purple in the Distribution header

---

## Caption Studio (AI Engine) — v9 NEW

### Architecture
- **AI Engine:** `lib/ai/caption-engine.ts` — calls Claude Haiku (`claude-haiku-4-5-20251001`) with 15s timeout
- **API Route:** `POST /api/captions/distribution` — auth, Zod validation, daily rate limit, in-memory cache (24h TTL), DB persist
- **DB Table:** `distribution_captions` — stores all generated captions per clip/user/platforms
- **Fallback:** if AI fails, falls back to `lib/distribution/caption-engine.ts` (template-based block mixing)

### Flow
1. User selects clip + platforms in Distribution
2. Clicks "Generate AI captions"
3. 6-step progress animation plays (fake steps for UX)
4. `POST /api/captions/distribution` called with clipId, transcript (clip title), mood (auto-detected from title), platforms
5. Claude Haiku generates 3 variants per requested platform
6. Response cached in-memory (server: 24h) and client (session ref)
7. Variants displayed as platform-grouped cards with Copy buttons
8. "Regenerate" skips client cache and fetches fresh from API

### Platform constraints (enforced server-side)
| Platform | Caption | Hashtags | Title | Description | Tags |
|---|---|---|---|---|---|
| TikTok | <= 300 chars (UI) / 2200 (API) | 8 | — | — | — |
| Instagram | <= 220 chars | 12 | — | — | — |
| YouTube Shorts | — | — | <= 60 chars | <= 200 chars | 5 |

### Rate limits
- Free plan: 10 generations/day
- Pro/Studio: 100 generations/day
- Uses Upstash Redis sliding window (`captions:{userId}`, 86400s window)

### DB table: `distribution_captions`
```sql
id UUID PK, clip_id TEXT, user_id UUID FK profiles, platforms TEXT[],
variants JSONB, model TEXT, tokens_used INT, created_at TIMESTAMPTZ
```
RLS: SELECT/INSERT where `user_id = auth.uid()`. Indexes on `(clip_id, user_id)` and `(user_id, created_at DESC)`.

### UI
- Platform-grouped variant cards with platform icon + label
- Each variant shows caption/title + hashtags/tags as pills
- Copy button per variant (copies to clipboard + sets as active caption for publish)
- Error state with AlertCircle icon + error message
- Empty state: "Generate AI captions for this clip."

---

## Modals — v8 NEW

### Platform Picker Modal
**Trigger** : click on "Post now" OR on the "Posting to N platforms" line.

```jsx
{showPlatformPicker && (
  <div className="dist-modal-overlay" onClick={close}>
    <div className="dist-modal-card">
      <div className="dist-modal-head">
        <h3>Where to post?</h3>
        <p>Pick the platforms for this clip.</p>
        <button className="dist-modal-close">×</button>
      </div>

      {/* Clip preview */}
      <div className="dist-modal-clip">{thumbnail + title + score}</div>

      {/* Platform list */}
      <div className="dist-modal-platforms">
        {PLATFORMS.map(p => {
          if (comingSoon)  return <div className="soon">...</div>
          if (!isConn)     return <div className="disconnected">...<Connect btn>...</div>
          return (
            <button className={`dist-modal-platform ${isEnabled ? 'enabled' : ''}`}
                    onClick={() => togglePublishTarget(p.id)}>
              <icon> <name + status: "Selected"|"Tap to select"> <checkbox cyan>
            </button>
          )
        })}
      </div>

      <div className="dist-modal-actions">
        <button className="dist-ghost-btn">Cancel</button>
        <button className="dist-cyan-btn primary" onClick={async () => { close(); await handlePublish() }}>
          {activePlatformCount === 0 ? 'Pick at least one platform' : `Post to ${N} platforms`}
        </button>
      </div>
    </div>
  </div>
)}
```

**State** : reuses existing `publishTargets` from store via `togglePublishTarget`. Choices persistent + sync with brain core platforms.

### Clip Picker Modal
**Trigger** : click on selected clip preview OR on empty state in Publish card.

```jsx
{showClipPicker && (() => {
  const bankClips = clipBank                                    // Bank = ALL clips (queue auto-farm)
  const remixClips = clipBank.filter(c => c.source === 'trending')  // Remixes subset
  const visibleClips = clipPickerTab === 'bank' ? bankClips : remixClips
  return (
    <div className="dist-modal-overlay" onClick={close}>
      <div className="dist-modal-card dist-clip-picker-card">
        <h3>Pick a clip</h3>
        <p>Choose what to publish next.</p>

        {/* Tabs cyan */}
        <div className="dist-clip-tabs">
          <button className={`dist-clip-tab ${active}`}><Film /> Bank <span className="tab-count">{N}</span></button>
          <button className={`dist-clip-tab ${active}`}><Sparkles /> Remixes <span className="tab-count">{N}</span></button>
        </div>

        {/* Scrollable list */}
        <div className="dist-clip-picker-list">
          {visibleClips.length === 0 ? (
            <div className="dist-clip-picker-empty">
              <Film />
              <p>No clips queued yet | No remixes yet</p>
              <p>Browse trending or upload your own | Enhance a trending clip…</p>
              <button className="dist-cyan-btn"><Layers /> Browse</button>
            </div>
          ) : (
            visibleClips.map(clip => (
              <button className={`dist-clip-picker-item ${selected}`}
                      onClick={() => { setSelectedClipId(clip.id); close() }}>
                <thumbnail (with score badge if >= 80)>
                <info: title + Score · {scheduled tag if applicable}>
                {selected && <span className="dist-clip-picker-check"><Check /></span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
})()}
```

**Bank vs Remixes** :
- **Bank** = `clipBank` complet (all clips queued for auto-farm posting)
- **Remixes** = `clipBank.filter(c => c.source === 'trending')` (subset remixed from trending)
- Si la majorite des clips sont remixes (workflow typique), Bank et Remixes peuvent overlap presque totalement

### Modal styles
- Overlay : fixed, z-index 1000, `rgba(2,6,23,0.7)` + backdrop-filter blur(8px), fade-in 0.2s
- Card : max-width 460px (clip picker 540px), gradient bg + border cyan 0.22, box-shadow + glow, pop-in animation (translateY+scale)
- Tabs (clip picker) : pills, active = bg cyan 0.12 + text #7dd3fc + count cyan brighter
- List : max-height 360px, scrollbar cyan custom (6px, rgba(56,189,248,0.2)→0.4 hover)

---

## Clip Bank — v8 REDESIGN

### Header
```jsx
<div className="dist-clip-bank-head">
  <h3>
    <span className="dist-clip-bank-dot" />  {/* cyan dot, no longer purple */}
    Clip Bank
    <span className="dist-smart-pill">Synced</span>  {/* cyan pill */}
  </h3>
  <div className="meta">
    <strong>{N} clips</strong> queued
    · <span className="scheduled">{queue.posts.length} scheduled</span>  {/* GREEN */}
    · <span className="priority">{N >= 80} priority</span>                {/* ORANGE */}
  </div>
  <div className="dist-clip-bank-actions">
    <button className="dist-ghost-btn"><Layers /> Sort by score</button>
    <button className="dist-ghost-btn"><Plus /> Add clips</button>
    <button className="dist-ghost-btn">Manage bank</button>
  </div>
</div>
```

**IMPORTANT** : counts coherence with AI core panel — `scheduled` count uses `queue.posts.length` (same source as the brain panel "M scheduled" subtext).

### State hierarchy (mutually exclusive)
```ts
const isBest          = idx === 0
const isScheduled     = clip.status === 'scheduled' && !!clip.scheduledAt
const isPriority      = !isBest && !isScheduled && (clip.score ?? 0) >= 80
const hasThumb        = !!clip.thumbnailUrl && !brokenThumbs.has(clip.id)
const isMissingVideo  = !clip.thumbnailUrl
const isBrokenPreview = !!clip.thumbnailUrl && brokenThumbs.has(clip.id)
const isPlaceholder   = !hasThumb  // dim only if no real thumbnail
const isDraftWithThumb = clip.status === 'draft' && hasThumb && !isBest && !isPriority && !isScheduled
const isReady         = !isBest && !isPriority && !isScheduled && !isDraftWithThumb && hasThumb
```

### Status pills
| Pill | Couleur | Condition | Affichage |
|---|---|---|---|
| Scheduled HH:MM | green/cyan | `isScheduled` (wins everywhere — overrides Best/Priority) | `<Clock /> Scheduled 14:30` |
| ★ Best next | cyan glow gradient | `isBest && !isScheduled` | `★ Best next` |
| Priority | orange gradient | `isPriority` | `<Flame /> Priority` |
| Ready | cyan light | `isReady` | `Ready` |
| Draft | gray muted | `isDraftWithThumb` | `Draft` |
| Needs video | gray foncé | `isMissingVideo && !isBest && !isScheduled` | `Needs video` |
| Preview unavailable | gray foncé | `isBrokenPreview && !isBest && !isScheduled` | `Preview unavailable` |

### Card visuals
- **Real clip (hasThumb)** : pleine opacite, border cyan 0.12, hover lift + cyan glow
  - `.best-next` : border cyan 0.5 + box-shadow cyan glow
  - `.priority-clip` : border orange 0.4 + box-shadow orange glow
  - `.draft-with-thumb` : border gray 0.18, mais opacite reste 1 — overlay subtil sur la thumbnail seulement (`.dist-clip-thumb-overlay` linear-gradient sombre 0.35→0.55, fade au hover)
- **Placeholder card (no thumb)** : `.placeholder-clip` opacity 0.55, border gray 0.1, no box-shadow, hover opacity 0.85
- **Premium placeholder** (`.dist-clip-thumb-placeholder`) : Film icon size=14, opacity 0.55, text 8.5px uppercase color rgba(100,116,139,0.7), background radial-gradient cyan subtle + dark linear-gradient
- **Broken thumbnail handling** : `<img onError={() => setBrokenThumbs(prev => new Set([...prev, clip.id]))} />` → fallback to placeholder
- **Drag prevention** : `user-select: none` + `-webkit-user-drag: none` on .dist-clip * + `pointer-events: none` on img + `draggable={false}` + `onDragStart={e => e.preventDefault()}`

### Remove (X) button
```jsx
<button className="dist-clip-remove" onPointerDown={preventBubble} onClick={(e) => {
  e.stopPropagation(); e.preventDefault()
  setRemovedClipIds(prev => new Set([...prev, clip.id]))
  if (selectedClipId === clip.id) setSelectedClipId(null)
}}>
  <X size={12} />
</button>
```
- 24×24 cercle, top: 8 right: 8, z-index: 10, opacity 0 → 1 on `.dist-clip:hover`
- Hover X : background red `rgba(239,68,68,0.85)` + scale 1.08 + glow red
- **Robust delete approach** : utilise un `removedClipIds: Set<string>` separé du `clipBank` state. Filtrage a l'affichage : `clipBank.filter(c => !removedClipIds.has(c.id)).map(...)`. Counts du header aussi filtres. Resilient aux re-fetch.

### Scrollbar
- Subtle cyan : `rgba(56,189,248,0.2)` → `0.4` hover
- 6px height, Webkit + Firefox

### "+ Add clips" card (last in row)
- Border dashed cyan 0.18, transparent bg cyan 0.02, hover lift + glow cyan
- Plus icon + "Add clips" cyan text
- Onclick → `/dashboard`

### Empty bank state
```jsx
<div className="dist-clip-bank-empty">
  <div className="empty-icon"><Film /></div>      {/* cyan glass circle */}
  <p>No clips ready yet</p>
  <p>Enhance a trending clip or upload your own…</p>
  <button className="dist-cyan-btn"><Sparkles /> Browse trending</button>
  <button className="dist-ghost-btn"><Plus /> Upload</button>
</div>
```

---

## Clip Bank — Interactive Features

### Retrait persisté en DB (v9.3)
- Colonne `render_jobs.removed_from_bank_at TIMESTAMPTZ` : NULL = dans la bank, non-NULL = retiré
- Route API : `PATCH /api/distribution/bank/[clipId]` body `{ action: 'remove' | 'restore' }`
  - `remove` : set `removed_from_bank_at = now()` + cancel toutes les `scheduled_publications` (status='scheduled') pour ce clip
  - `restore` : set `removed_from_bank_at = NULL`
- Chargement bank : query `render_jobs` avec `.is('removed_from_bank_at', null)` — filtrage côté serveur
- UI : optimistic update (retire le clip du state `clipBank` immédiatement), pas de rollback visible (fail silently)
- Migration douce : si `sessionStorage('viral-animal-removed-clips')` contient des IDs au mount, les push vers l'API puis supprime la clé
- **Plus aucun `removedClipIds` en sessionStorage** — la DB est la seule source de vérité
- Migration requise : `supabase/migrations/20260706_clip_bank_removal.sql`

### Anti-double-post (publish manuel → retrait banque + cancel schedule)
- **Apres un publish manuel reussi (mode:'direct' uniquement)** :
  - Le clip est retire de la Clip Bank (carte "Published" ~2s, puis disparait)
  - `PATCH /api/distribution/bank/[clipId]` action=remove → `removed_from_bank_at = now()` + cancel `scheduled_publications` (atomique)
  - Le smart queue store se resynchronise automatiquement (via le useEffect sur `clipBank`)
  - Fonctionne depuis les 3 entry points : Clip Bank rocket, UnifiedPublishDialog, auto-open post-render
- **Mode 'inbox'** : rien ne change — le clip reste en banque, schedule intact (pas reellement publie)
- **Garde-fou cron (defense en profondeur)** :
  - `lib/distribution/execute-publish.ts` : avant de publier, verifie si `published_posts` contient deja une ligne pour ce (user_id, clip_id, platform)
  - `app/api/cron/publish-scheduled/route.ts` : meme check — si deja publie, marque la scheduled_publication 'canceled' avec error_message='already published manually'
  - Protege contre tout etat incoherent passe ou futur

### Click-to-Play Video Preview
- Click on play glyph (or on the video to stop): toggles video playback
- First click: creates a signed URL from Supabase Storage (`clips` bucket) via `storagePath` on the ClipBankItem
- Cached in a `Map<string, string>` ref (no re-fetch on subsequent clicks, signed URL valid 1h)
- Renders `<video autoPlay muted loop playsInline>` overlay on thumb area (object-fit: cover, 9:16 contained)
- Re-click on video: pauses + returns to thumbnail
- Loading state: WolfLoader spinner overlay
- **prefers-reduced-motion does NOT block playback** — user-initiated video play is never a decorative animation
- Fallback chain: `createSignedUrl` → `getPublicUrl` (clips bucket has public read policy) → error state
- Error state: play icon replaced by X for 2.5s, console.warn logged
- If `storagePath` is null: console.warn + brief error indicator (X icon), no crash
- Touch-device friendly (no hover dependency)

### Quick Publish Button (Rocket)
- Visible on hover: absolute **top-right** (shifted left of X button: `right: 36px; top: 8px;`), cyan Rocket icon (28x28px)
- Click behavior:
  1. Sets the clip as selected (`setSelectedClipId`)
  2. Smooth scrolls to `#publish-strip`
  3. After 600ms delay: opens Platform Picker modal
- `e.stopPropagation()` prevents card selection conflict with X remove button

### Scroll-from-Enhance (Place in bank)
- Enhance page navigates to `/dashboard/distribution?scrollTo=bank&highlight={clipId}`
- Distribution reads params on mount via `useEffect`
- If `scrollTo=bank`: auto-scrolls to `#clip-bank-section`
- If `highlight={id}`: adds `dist-clip-highlight` class (cyan ring pulse, 2.5s animation)
- URL params cleaned via `history.replaceState` after reading

## URL Params

| Param | Source | Behavior |
|---|---|---|
| `clip={id}` | Enhance "Distribute Now" | Selects this clip in publish strip |
| `action=publish` | Enhance "Distribute Now" | Auto-opens Platform Picker |
| `scrollTo=bank` | Enhance "Place in bank" | Scrolls to Clip Bank section |
| `highlight={id}` | Enhance "Place in bank" | Highlights the clip card with cyan ring pulse |

---

## OFF state — system coherence

When `aiAutoDistribute === false`:
- **CLIP FARM panel** : title shows "OFF", subtext replaced by hint, pill in OFF inviting state (pulsing)
- **Brain core** : `dist-core-wrap.off` → `grayscale(1)` filter on brain SVG, opacity 0.45, animations paused (outer ring rotation, glow pulse)
- **Connector line** brain→panel : gray gradient instead of cyan, no animation
- **Platform cards** : ALL connected platforms display `● OFF` (gray) regardless of individual `isEnabled` (uses `isActive = isConn && isEnabled && aiAutoDistribute`). Choice preserved in store.
- **Platform→brain flow lines** : all switch to `dim` class (gray, no glow). Particles not rendered (`{isPlatActive(id) && <circle>...}`).
- **Funnel lines** below CLIP FARM panel (going to clip bank) : also switch to `dim`, particles removed
- **Hint visible everywhere** : "Turn on to start distributing your clips" + pulsing pill ring → invites click

### Amber OFF indicators (UX clarity)

These additional changes ensure the user IMMEDIATELY sees that nothing will fire until ON:

| Element | ON state | OFF state |
|---|---|---|
| Next post time | Normal cyan | Amber-400, opacity 70% |
| Next post sub | Platform name | "Paused" (italic, amber) |
| Queue count | Green "N scheduled" | Zinc-500 "N scheduled" |
| Queue sub | "+N ready next" | "Frozen until ON" (amber-500/70) |
| Clip Bank badge | "Synced" (cyan pill) | "Frozen" (amber pill + Pause icon) |
| Clip Bank banner | None | Amber CTA: "Turn on AUTO-DISTRIBUTE above to start posting" (clickable, scrolls to pill) |
| Clip rail opacity | 100% | 70% |
| "Best next" pill | Cyan glow | Amber-400, no glow shadow |
| "Best next" tooltip | None | "Will post when auto-distribute is ON" |
| AI Schedule section | Full opacity | 70% opacity overall |
| AI Schedule "Smart" badge | Cyan pill | Gray "Paused" pill (zinc) |
| Schedule time | Normal | Amber-400 |
| Schedule "in Xh" | Normal | Amber italic + "(paused)" suffix |
| Schedule post cards | Full opacity | 75% opacity |
| Schedule "Post now" buttons | Active | Disabled + cursor-not-allowed + tooltip |
| Schedule footer (mix + reach) | Normal | 60% opacity + "Frozen —" prefix |

### Clip Bank features
- **Sort by score** button removed (clips ordered by AI, not user-sortable)
- **"Ordered by AI"** subtle text in header actions area

### Scroll-to-toggle behavior
Clicking the amber CTA in Clip Bank:
1. Smooth scrolls to the pill toggle (via `pillRef.scrollIntoView`)
2. Adds `dist-pill-pulse-highlight` class (amber box-shadow pulse, 2s)
3. Class auto-removed after 2s via setTimeout

---

## Time / Date formatting

Consistent across the app :
```ts
new Date(scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
// → "14:30" (24h, no AM/PM messy)

// In context, prefixed with "Today":
`Today ${time}`  // → "Today 14:30"
```

Used in : CLIP FARM panel "Next post", Clip Bank scheduled pills, "Scheduled HH:MM" label.

---

## Session Persistence (`lib/distribution/session-persistence.ts`) — unchanged from v6

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
  lastWeekAvgScore: number | null
  weekNumber: number
  bestClipScore: number
  bestClipTitle: string | null
  currentStreak: number
  longestStreak: number
  lastPublishDate: string | null
  lastSessionDate: string | null
  sessionsCount: number
  firstUseDate: string
}
```
Key: `"viral-animal-distribution-stats"`

### "What Worked" Summary (`getWhatWorkedSummary`)
```typescript
{ topTone, topPlatform, bestTimeOfDay, recommendation }
```

---

## Reward Engine (`lib/distribution/reward-engine.ts`) — unchanged from v6

### Milestones / Streaks / Rare Events / Creator Levels
(See unchanged tables — Lv.1 Rookie → Lv.10 Legend, milestones 1/5/10/25/50/100, streak 3/7/14/30, etc.)

---

## Smart Queue Engine (`lib/distribution/smart-queue-engine.ts`) — unchanged from v7

### 5 Layers + 3 Systems
- Timing Engine, Sequencing Engine, Risk Strategy, Learning Loop, Confidence Layer
- Emotional Rotation (-15 same-mood penalty), Momentum Window (1.5x boost), Kill Switch (-20 pattern)
- Breakout Probability formula : `base × timingMultiplier × momentumMultiplier`
- Strategy labels : "Build → Breakout → Capitalize", etc.
- Override Learning : ×1.05/×0.97 affinity adjustments + toast

### Data Storage
- `viral-animal-queue-learning` : LearningData
- `viral-animal-queue-settings` : QueueSettings

---

## Stores

### `stores/distribution-store.ts`
- `accounts: SocialAccount[]`
- `publishTargets: PublishTarget[]` — `[{platform, enabled}]`
- `publishProgress: Record<string, PublishProgress>`
- `isPublishing: boolean`
- Actions : `fetchAccounts`, `togglePublishTarget(platform)`, `publishClip(clipId, caption, hashtags)` (parallel API calls), `resetPublishProgress`

### `stores/queue-store.ts`
- `queue: QueuePreview | null`
- `learning: LearningData`
- `settings: QueueSettings`
- `clipBank: QueueClip[]`
- Actions : `init`, `setClipBank`, `regenerateQueue`, `updateSettings`, `recordResult`, `handleOverride`, `getDoNothingPreview`

---

## Local State (in distribution-hub.tsx)

### Clip selection / publish
- `clipBank: ClipBankItem[]` — fetched from Supabase render_jobs (status='done')
- `selectedClipId: string | null`
- `removedClipIds: Set<string>` — clips manually removed (X button), filtered at display
- `brokenThumbs: Set<string>` — clips whose thumbnail failed to load
- `bankLoading: boolean`

### AI / publish flow
- `aiAutoDistribute: boolean` — master toggle (CLIP FARM ON/OFF)
- `bioText: string`, `bioGenerating`, `bioStep`, `bioVariants`, `selectedVariantId`
- `publishSteps`, `publishSequenceActive`, `publishDone`
- `trackingMetrics: PostMetrics | null`

### Modals
- `showPlatformPicker: boolean`
- `showClipPicker: boolean`
- `clipPickerTab: 'bank' | 'remixes'`

### Connection map (refs)
- `connectionMapRef: HTMLDivElement`
- `brainCoreRef: HTMLDivElement`
- `platTiktokRef`, `platYoutubeRef`, `platInstagramRef`, `platFacebookRef`
- `flowPaths: { tiktok, youtube, instagram, facebook }` — recalculated via `pathTo()` on layout shift

---

## CSS Animations (Distribution-specific)

| Animation | Duree | Usage |
|---|---|---|
| `dist-flow-path` (`stroke-dashoffset`) | 9s | Dashes flowing along platform→brain lines |
| `dist-connector-flow` (`background-position`) | 1.4s | Vertical dashes scrolling on brain→panel connector |
| `dist-pill-breathe` (box-shadow) | 2.4s | OFF pill breathing glow |
| `dist-pill-ring-pulse` (opacity + scale) | 2.4s | OFF pill outer ring |
| `dist-pill-orb-pulse` (opacity + scale) | 1.6s | OFF pill orb breathing |
| `dist-core-ring-rotate` (rotate) | 50s | Brain outer dashed ring slow rotation |
| `dist-bridge-pulse` (opacity) | 4s | Bridges brain↔wolf subtle pulse |
| `dist-breathe` (scale + opacity) | 4s | Brain core glow background pulse |
| `dist-modal-fade-in` / `dist-modal-pop-in` | 0.2s / 0.25s | Modal entrance |
| `dist-hint-fade-in` | 0.4s | OFF hint text under panel title |
| `flowDot`, `pulseGlow`, `stepFade`, `scaleIn` | unchanged | Existing |

---

## Statut par feature (v8)

| Feature | Status |
|---|---|
| Clip bank (Supabase) | WIRED_REAL |
| Clip bank → local removal (X button) | WIRED_LOCAL (Set in component state, not persisted DB) |
| Broken thumbnail fallback | WIRED_LOCAL |
| Social accounts fetch | WIRED_REAL |
| Platform toggles (store sync) | WIRED_REAL |
| Master toggle (CLIP FARM ON/OFF) auto-disables platforms visually | WIRED_REAL |
| Publish API calls | WIRED_REAL |
| Publish → published_posts logging | WIRED_REAL (inserts metadata snapshot on successful publish) |
| Publish progress tracking | WIRED_REAL |
| Platform picker modal (per-clip selection) | WIRED_REAL (uses togglePublishTarget store) |
| Clip picker modal (Bank/Remixes tabs) | WIRED_REAL |
| Caption Studio AI (Claude Haiku, per-platform) | WIRED_REAL (API call, 3 variants/platform, fallback to templates) |
| Caption Engine templates (fallback) | SIMULATED (used when AI fails or no API key) |
| Variant risk/reward metadata | SIMULATED |
| AI Growth Projections | SIMULATED (chaos engine, "Predicted") |
| Strategy Engine | SIMULATED |
| User Memory session | SIMULATED |
| Session Persistence (localStorage) | WIRED_LOCAL |
| Reward Engine | WIRED_LOCAL |
| Creator Levels | WIRED_LOCAL |
| "What Worked" feedback loop | SIMULATED |
| Streak tracking | WIRED_LOCAL |
| Smart labels clips | WIRED_REAL (velocity_score) |
| Recent activity metriques | SIMULATED |
| Smart Queue Engine | WIRED_LOCAL (localStorage learning + real clips) |
| Smart Queue Profile Consumption | WIRED_REAL (consumes LearnedDistributionProfile from /api/analytics/profile) |
| Smart Queue Breakout / Reach / Kill / Mood | SIMULATED |
| AI Brain Core SVG (cyan brain + orange wolf) | UI_ONLY (visual representation of "running" state) |
| CLIP FARM pill toggle | WIRED_REAL (controls aiAutoDistribute) |
| Connection map dynamic flow paths | WIRED_REAL (computed via getBoundingClientRect + ResizeObserver) |
| Animated SVG particles on flow lines | UI_ONLY (visual when active) |
| Brain → panel connector animated dashes | UI_ONLY |
| Time formatting (en-GB, "Today HH:MM") | WIRED_REAL |
| Counts coherence (brain panel ↔ clip bank) | WIRED_REAL (queue.posts.length shared source) |
| Facebook/X | NOT_IMPLEMENTED |

---

## Smart Queue Profile Consumption

The Smart Queue Engine now integrates the `LearnedDistributionProfile` (from `pattern-detector.ts` via `/api/analytics/profile`) to make data-driven scheduling decisions.

### Architecture

```
SmartQueueSection (distribution-hub.tsx)
  |
  | fetch /api/analytics/profile on mount
  v
queue-store.setLearnedProfile(profile)
  |
  v
generateQueue(clips, stats, learning, settings, learnedProfile)
  |
  v
applyLearnedProfile(clip, platform, hour, profile)
  → mood boost (capped ×1.3)
  → timing window boost (capped ×1.2)
  → underperforming penalty (min ×0.7)
  → confidence weighting (early=30%, medium=70%, high=100%)
```

### Confidence weighting

| Profile confidence | Weight applied | Effect |
|---|---|---|
| none / collecting (< 5 posts) | 0% | Profile ignored entirely |
| early (5-14 posts) | 30% | Soft hint — minor reordering |
| medium (15-29 posts) | 70% | Strong influence on queue order |
| high (30+ posts) | 100% | Full reorder based on learned data |

### Boost/penalty caps

| Signal | Max boost | Cap |
|---|---|---|
| Mood match (bestMoodsByPlatform) | +15 priority points | ×1.3 source multiplier |
| Timing window match (bestPostingWindows) | +12 priority points | ×1.2 source multiplier |
| Underperforming pattern match | -15 priority points | ×0.7 source penalty |

### UI indicators

- **Header badge**: "Learning: {confidenceLabel}" shown when profile has 5+ posts. Color: amber (early), blue (medium), emerald (high). Hover tooltip shows post count.
- **Post badge**: Cyan "AI Learned" badge on posts influenced by the profile. Shows first learned reason inline, full list on hover.

### Data flow

```
published_posts (Supabase)
  → pattern-detector.ts (server-side aggregation)
  → /api/analytics/profile (cached 1h)
  → queue-store.learnedProfile (client state)
  → generateQueue() Layer 6 (applyLearnedProfile)
  → ScheduledPost.learnedReasons[]
  → SmartQueueSection UI (badges)
```

---

## Autofarm Executor (v9)

### Flow complet

```
1. User configure les "Auto-post defaults" (TikTok privacy, toggles, disclosure)
   → PUT /api/distribution/settings { auto_post_defaults: {...} }

2. User tourne le toggle Auto-Distribute ON
   → Client POST /api/distribution/autofarm-sync avec les top N posts de la queue
   → Cancel toutes les rows 'scheduled' autofarm precedentes (clean slate)
   → Insert nouvelles rows dans scheduled_publications (source='autofarm', tiktok_options copiees)

3. Queue se regenere (regenerateQueue)
   → Si ON : re-sync vers DB (meme endpoint)

4. User tourne OFF
   → Client DELETE /api/distribution/autofarm-sync
   → Toutes les rows autofarm 'scheduled' passent a 'cancelled'

5. Cron publish-scheduled (toutes les 5-10 min)
   → SELECT scheduled_publications WHERE status='scheduled' AND scheduled_at <= now() LIMIT 5
   → Lock optimiste : UPDATE status='publishing' WHERE status='scheduled' (0 rows = skip)
   → executePublish() : token refresh, signed URL fraiche, TikTok Direct Post
   → Succes → status='published', AWAIT INSERT published_posts (ticker + refresh-post-stats)
   → L'insert published_posts est AWAITED (pas fire-and-forget) pour garantir
     la completion en serverless (Netlify). Enrichi avec trending_clips metadata.
   → Echec → retry_count++ (max 2, +10min delay) ou status='failed'
   → Notification Discord

6. Learning loop : refresh-post-stats cron → pattern-detector → queue regenere
```

### Auto-post defaults (TikTok compliance)

Stockes dans `distribution_settings.auto_post_defaults` (JSONB) :

```json
{
  "privacy_level": "PUBLIC_TO_EVERYONE",
  "disable_comment": false,
  "disable_duet": false,
  "disable_stitch": false,
  "brand_content_toggle": false,
  "brand_organic_toggle": false
}
```

Si `auto_post_defaults` est null → l'autofarm ne schedule PAS (afficher banner "Configure auto-post settings first").

### Fichiers

| Fichier | Role |
|---|---|
| `lib/distribution/execute-publish.ts` | Logique partagee : clip lookup, token refresh, signed URL fraiche, TikTok API, published_posts |
| `app/api/cron/publish-scheduled/route.ts` | Cron executor — lock optimiste, execute, retry, Discord |
| `app/api/distribution/autofarm-sync/route.ts` | Queue → DB bridge — POST (sync), DELETE (pause) |
| `app/api/distribution/settings/route.ts` | Settings avec auto_post_defaults (PUT) |

### Migration

`20260702_autofarm_executor.sql` :
- `scheduled_publications` : +`tiktok_options JSONB`, +`retry_count INT DEFAULT 0`, +`source TEXT DEFAULT 'manual'`
- `distribution_settings` : +`auto_post_defaults JSONB`
- Index `idx_scheduled_publications_due` sur `(scheduled_at) WHERE status='scheduled'`

### Retry

| Tentative | Action |
|---|---|
| 1ere | Execute normalement |
| Echec #1 | status='scheduled', scheduled_at +10min, retry_count=1 |
| Echec #2 | status='scheduled', scheduled_at +10min, retry_count=2 |
| Echec #3 | status='failed', notification Discord |

### Launch scope

**TikTok uniquement** (seule plateforme approved). Le sync endpoint refuse les plateformes != 'tiktok'.
Les signed URLs sont regenerees a chaque execution (jamais celles stockees au scheduling).

### Queue platform filtering (v9.1)

La Smart Queue ne schedule que vers les plateformes reellement connectees ET activees.
- Source de verite : `social_accounts` (connected) + `publishTargets` (enabled)
- `distribution-hub.tsx` passe `activePlatforms` filtre au queue store a chaque sync
- Fallback si aucune plateforme connectee : `['tiktok']`
- Les posts localStorage vers des plateformes non connectees sont re-routes au prochain regenerate

### Estimated reach (honest display)

- < 5 posts reels trackes : "Reach estimates unlock after 5 tracked posts" (pas de chiffre simule)
- >= 5 posts : affiche "Est. X — Y" base sur les vraies moyennes du compte
- Le "do nothing" preview ne montre plus de reach simule

### Platform flags

| Plateforme | Flag | Defaut | Status |
|---|---|---|---|
| TikTok | (toujours actif) | — | APPROVED — seule plateforme active au launch |
| YouTube | (OAuth fonctionnel, UI disabled) | `supported: false` | Coming soon (chip SOON + connect disabled) |
| Instagram | `NEXT_PUBLIC_INSTAGRAM_ENABLED` | `false` | Coming soon (chip SOON + connect disabled) |
| Facebook | — | `false` | Coming soon |

### Cron scheduling

Le cron `publish-scheduled` doit etre schedule dans Railway/cron-job.org (toutes les 5-10 min).
Auth : `x-api-key: CRON_SECRET` (meme pattern que les autres crons).

```
POST /api/cron/publish-scheduled — every 5-10min
```

---

## Systemes connexes

| Systeme | Relation |
|---|---|
| **ENHANCE / Clip Bank** | Les clips rendus alimentent la queue via la bank |
| **Settings OAuth** | Les tokens TikTok sont geres par `token-manager.ts` (refresh auto) |
| **refresh-post-stats** | Met a jour les metriques des posts publies |
| **pattern-detector** | Analyse les stats → nourrit le learning loop → queue se regenere |
| **Discord** | Notifications auto-post succes/echec |
| **AI (mood/hook)** | Le mood et hook type des clips influencent le sequencing de la queue |

---

## Persistance DB (v9.3 — autofarm branché)

Le state de la farm est maintenant persisté en DB (Supabase = source de vérité). Plus aucun état critique en local-only.

### Flux : UI → DB → Cron

```
[Toggle ON] → PUT /api/distribution/settings { auto_distribute_enabled: true }
           → POST /api/distribution/autofarm-sync { posts, tiktok_defaults }
           → INSERT scheduled_publications (source='autofarm', status='scheduled')

[Cron 5min] → SELECT scheduled_publications WHERE status='scheduled' AND scheduled_at <= now()
            → executePublish() → UPDATE status='published' / 'failed'

[Toggle OFF] → PUT /api/distribution/settings { auto_distribute_enabled: false }
            → DELETE /api/distribution/autofarm-sync → UPDATE status='canceled' WHERE source='autofarm'
```

### Tables/colonnes utilisées

| Table | Colonnes clés | Usage |
|---|---|---|
| `distribution_settings` | `user_id`, `auto_distribute_enabled`, `max_posts_per_day`, `auto_post_defaults` | Toggle + réglages auto-distribute |
| `scheduled_publications` | `user_id`, `clip_id`, `platform`, `scheduled_at`, `status`, `source`, `tiktok_options`, `retry_count` | Queue DB réelle (lue par le cron) |
| `published_posts` | `user_id`, `platform`, `published_at` | Ticker activité + historique |
| `render_jobs` | `user_id`, `clip_id`, `status='done'` | Source de la Clip Bank (clips rendus) |

### Chargement au mount

1. `GET /api/distribution/settings` → `auto_distribute_enabled` → set toggle state
2. Clip bank : query `render_jobs` (status=done) + enrichissement depuis `trending_clips`/`videos`
3. Ticker : query `published_posts` (4 derniers events)
4. Queue client (smart-queue-engine) génère les posts → synced to DB si toggle ON

### Sync queue → DB

- Déclenché par un `useEffect` quand `aiAutoDistribute=true` ET que `queue.posts` change
- Appelle `POST /api/distribution/autofarm-sync` avec les 6 premiers posts
- L'API fait un clean slate (cancel existing autofarm rows) puis insert les nouveaux
- Le cron `publish-scheduled` lit ces lignes et publie quand `scheduled_at <= now()`

### Statuts canoniques (v9.4 — CHECK constraints)

| Table | Statuts canoniques |
|---|---|
| `render_jobs` | `pending`, `queued`, `rendering`, `done`, `error`, `failed`, `canceled`, `expired` |
| `scheduled_publications` | `scheduled`, `publishing`, `published`, `failed`, `canceled` |

Orthographe unique : **canceled** (simple L, US English). Migration `20260713_status_normalization.sql` normalise les données existantes et ajoute les CHECK constraints.

### Migrations requises

- `20260706_autofarm_persistence.sql` — `auto_distribute_enabled BOOLEAN` sur `distribution_settings`
- `20260706_clip_bank_removal.sql` — `removed_from_bank_at TIMESTAMPTZ` sur `render_jobs`
- `20260713_status_normalization.sql` — UPDATE 'cancelled'→'canceled' + CHECK constraints sur les deux tables

**Toutes à appliquer manuellement.**

---

## Improvements left (post v9)

1. ~~**Persistent clip removal**~~ — DONE (v9.3, `removed_from_bank_at`)
2. **Mood tagging** — utiliser le mood detector existant pour tagger chaque clip
3. **Hook type detection** — parser titres/transcriptions pour detecter type
4. **Tracking reel** — APIs platforms pour vraies metriques → nourrir learning
5. **Bio generation reelle** — Claude API pour remplacer templates
6. **Persistance Supabase** — migrer learning data localStorage → Supabase cross-device
7. **Drag & drop reorder** — queue posts manual reorder
8. **Queue settings UI** — panel pour maxPerDay, blackoutHours
9. **Brain core analytics overlay** — afficher stats temps reel dans le brain (clips processed, success rate)
10. **Distinct Bank vs Remixes filter** — a clarifier au niveau data model
11. **Multi-platform autofarm** — YouTube/Instagram quand les permissions sont approved

---

## Recent visual evolution

| Version | Changement principal |
|---|---|
| v7 | Smart Queue Engine + Reward Engine + Persistence + initial brain SVG (purple) |
| v8 | Cyan command center direction : nouveau brain (cyan + orange wolf neon emblem), pill toggle premium, connection map dynamique avec corner-targeting et particules, modals platform/clip picker, Clip Bank state hierarchy + X remove, time format unifie, master toggle propage l'etat OFF a tout le systeme |
| v8.1 | TikTok Direct Post compliance : TikTokPublishDialog, creator_info fetch, 7 requirements UX, polling status |
| v9 | Autofarm executor : queue→DB bridge, cron publish-scheduled, execute-publish.ts, auto-post defaults TikTok, retry logic, Discord notifications |
| v9.1 | Queue platform filtering (connected+enabled only), honest reach display, Instagram behind NEXT_PUBLIC_INSTAGRAM_ENABLED flag |
| v9.2 | Living Farm : particules de flux ambre/cyan, onde post-sent, brain breathing 5.5s, node state chips, live countdown, ticker activite, CTA ambre |

---

## Living Farm (v9.2)

Enrichissements visuels pour que le systeme ait l'air vivant en permanence, sans changer le layout.

### Ancrage dynamique des lignes
- Chaque ligne est un SVG `<path>` (cubic bezier) calcule dynamiquement via `getBoundingClientRect`
- **Depart** : midpoint du cote du noeud plateforme qui fait face au cerveau (gauche/droite ou haut/bas selon la geometrie)
- **Arrivee** : point sur le cercle du cerveau (edge, angle vers le noeud via `Math.atan2` + rayon)
- Recalcul automatique sur `ResizeObserver` (container + chaque noeud) + `window.resize` + delais 100ms/500ms pour layout settle
- Les particules suivent ces paths reels via `<animateMotion>`

### Lignes electriques (routes actives)
- Classe `.dist-flow-path.electric` : stroke ambre #fbbf24, dash pattern irregulier `2 6 14 6`
- Animation de courant : `dist-electric-flow` (stroke-dashoffset, 1.2s/cycle, lineaire)
- Scintillement organique : `dist-electric-flicker` (opacity .75→1, 2.8s ease-in-out)
- Glow : drop-shadow ambre (4px tight + 12px diffuse)
- Routes inactives : `.dim` — pointilles statiques faibles (#475569, opacity .25), aucune animation

### Particules de flux
- **Brain → plateformes actives** : particules AMBRE (#fbbf24), 2 par plateforme max, ~3.5s de trajet, via `<animateMotion>` sur les SVG paths dynamiques
- **Clip Bank → brain** (funnel) : particules CYAN (#38BDF8), 2 en transit, meme mecanisme
- Plateformes non connectees : aucune particule
- Max 6 particules total

### Onde post-sent
- Declenchee quand `publishDone` passe a true avec des platforms published
- Brain emet un pulse ring ambre (`.dist-post-pulse`, scale .85→1.6, opacity .9→0, 900ms)
- Noeud plateforme flash ambre (`.post-flash`, box-shadow pulse 900ms)
- Ajout automatique au ticker d'activite

### Respiration du cerveau
- Keyframe `dist-breathe` : scale .94→1.05, opacity .7→1, cycle 5.5s ease-in-out
- Glow de base reduit ~30% (opacites .13/.08 au lieu de .18/.12)
- `prefers-reduced-motion` : glow statique a 50%, aucune animation

### Grammaire des etats de noeuds (chip unique, pas de toggle duplique)
| Etat | Contour | Chip unique |
|---|---|---|
| Connecte/actif | ElectricBorder anime | `● ON · POSTING` (vert, cliquable → toggle off) |
| Connecte/off | Statique | `● OFF` (opacity .5, cliquable → toggle on) |
| Disponible | Statique | `CONNECT` (cliquable → /settings, cyan) |
| Coming soon | Fantome (opacity .35) | `SOON` (gris) |

Chaque noeud = icone + nom + UN SEUL chip. Pas de bouton toggle separe.

### Countdown live
- Dans la carte CLIP FARM panel, stat "NEXT POST" affiche un compte a rebours `HH:MM:SS` qui decompte chaque seconde
- Calcule depuis le vrai `scheduledAt` du premier post visible dans la queue
- Plateforme + heure affichees en sub-label

### Ticker activite
- 4 lignes max dans la carte CLIP FARM panel, fade-in par le haut
- Alimente par les vraies donnees : `published_posts` charges au mount + events de publish en session
- Format : `HH:MM · ● · posted to TikTok`
- Si aucune donnee : `farm heartbeat OK`

### CTA ambre
- Bouton "+ Add clips to the farm" en gradient ambre (#fbbf24→#f59e0b→#d97706, texte #451a03)
- Hover : translateY(-1px) + glow ambre
- Place dans la carte CLIP FARM panel, scrolle vers le Clip Bank au clic

### Pill vs Panel (deduplication)
- Pill header : `● CLIP FARM · RUNNING` (compact, statut global)
- Panel : `AUTO-DISTRIBUTE` titre + donnees (countdown, queue, ticker, CTA)

---

## TikTok Publish Dialog — Content Sharing Guidelines Compliance

> Ref: [TikTok Content Sharing Developer Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines)
> Composant: `components/distribution/tiktok-publish-dialog.tsx`
> Types: `types/tiktok.ts`

### Architecture

| Fichier | Role |
|---|---|
| `components/distribution/tiktok-publish-dialog.tsx` | Dialog TikTok complet avec 7 requirements UX |
| `types/tiktok.ts` | Types TypeScript (CreatorInfo, PrivacyLevel, PublishStatus, etc.) |
| `app/api/tiktok/creator-info/route.ts` | Proxy GET → TikTok `/v2/post/publish/creator_info/query/` |
| `app/api/tiktok/publish-status/route.ts` | Proxy POST → TikTok `/v2/post/publish/status/fetch/` |
| `app/api/publish/[platform]/route.ts` | Publish endpoint — accepte `tiktok_options` avec privacy, toggles, commercial |

### 7 Requirements UX obligatoires

Le dialog "Post to TikTok" contient dans cet ordre :

1. **Nickname TikTok** du createur connecte (avatar + @username) — depuis `creator_info`
2. **Preview video** — thumbnail/player de la video a poster
3. **Champ Caption** — textarea auto-grow, editable, PAS pre-rempli avec watermark/promo, max 300 chars UI (API accepte 2200)
4. **Dropdown Privacy** — options depuis `creator_info.privacy_level_options`, placeholder "Select privacy", PAS de valeur par defaut, selection manuelle obligatoire
5. **Toggles Interaction** — Comment/Duet/Stitch :
   - OFF par defaut (selection manuelle obligatoire)
   - Greyed out si disabled dans les settings du createur (`comment_disabled`, `duet_disabled`, `stitch_disabled`)
6. **Commercial Content Disclosure** :
   - Toggle off par defaut
   - Quand ON → 2 checkboxes : "Your Brand" (promotional) + "Branded Content" (paid partnership)
   - Au moins 1 doit etre cochee pour publier
   - Branded Content + privacy SELF_ONLY = conflit bloque
7. **Declaration legale dynamique** AVANT le bouton Publish :
   - Si commercial OFF ou "Your Brand" seul : "By posting, you agree to TikTok's Music Usage Confirmation"
   - Si "Branded Content" coche : "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation"

### Validations pre-submit

- `privacy_level` doit etre selectionne (pas null)
- Si commercial toggle ON, au moins 1 checkbox cochee
- Si Branded Content + SELF_ONLY → erreur affichee
- Si `clipDurationSeconds > max_video_post_duration_sec` → erreur affichee
- `title` ne doit pas etre vide

### creator_info fetch

Au montage du dialog :
```
GET /api/tiktok/creator-info
  → POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/
  → Retourne : creator_nickname, creator_username, creator_avatar_url,
               privacy_level_options, comment_disabled, duet_disabled,
               stitch_disabled, max_video_post_duration_sec
```

### Publish flow

```
1. User clique "Publish" dans UnifiedPublishDialog OU rocket dans Clip Bank
2. TikTok est TOUJOURS route vers TikTokPublishDialog (tiktok_options obligatoires)
   → le dialog unifie et la distribution hub excluent TikTok de leur boucle de publish
   → TikTokPublishDialog collecte privacy/interactions + publie lui-meme
   → onClose retourne { published: boolean, mode: 'direct' | 'inbox' }
3. POST /api/publish/tiktok avec tiktok_options (privacy, toggles, commercial)
4. Backend → POST /v2/post/publish/video/init/ (PULL_FROM_URL)
5. Retourne publish_id + mode ('direct' | 'inbox')
6. Si mode='direct': polling toutes les 5s via POST /api/tiktok/publish-status
   → POST /v2/post/publish/status/fetch/
7. Statuts : PROCESSING_UPLOAD → PROCESSING_DOWNLOAD → PUBLISH_COMPLETE / FAILED
8. Si mode='inbox': affichage ambre "Sent to TikTok drafts — open the app to finalize"
   → PAS le meme succes vert que Direct Post
```

### Notes importantes

- tiktok_options est OBLIGATOIRE pour publier sur TikTok (Content Sharing Guidelines)
- Sans tiktok_options, la route API fallback en mode inbox (brouillons TikTok)
- Le dialog TikTok (TikTokPublishDialog) est le seul chemin pour publier TikTok
  — UnifiedPublishDialog et DistributionHub delegent a TikTokPublishDialog
- Les toggles interaction sont `disable_*` cote API (inverse du UI `allow_*`)
- `max_video_post_duration_sec` varie selon le compte createur (peut etre 60s, 180s, ou 600s)
