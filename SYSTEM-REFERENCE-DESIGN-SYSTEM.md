# SYSTEM REFERENCE — Design System (v2 — Full Constitution)

> Derniere mise a jour : 2026-07-02.
> Source de verite pour toutes les decisions visuelles de Viral Animal.

---

## 1. Manifesto

Viral Animal is dark, sharp, reward-driven, and gaming-native. Amber is action, money, and reward. Cyan is data, system intelligence, and neutral info. Rank colors are controlled exceptions, not general UI colors. The interface should feel like a clip-farming command center, not a casino. Every visual effect must improve hierarchy, feedback, or motivation. No fake data. No decorative glow without purpose. No unreadable neon. The primary user action should always be obvious within 3 seconds.

---

## 2. Palette

### Dore (Gold) — Action / Success / Money

| Token | Tailwind | Hex | Usage |
|---|---|---|---|
| Primary | `amber-500` | `#f59e0b` | CTAs, buttons default, active states, badges, money |
| Primary hover | `amber-600` | `#d97706` | Button hover |
| Primary text on | `amber-950` | `#451a03` | Text on amber backgrounds |
| Light accent | `amber-400` | `#fbbf24` | Icons, sidebar active, labels |
| Muted accent | `amber-500/15` | — | Badge backgrounds, subtle highlights |

### Cyan — Data / Tech / Info

| Token | Tailwind | Hex | Usage |
|---|---|---|---|
| Data accent | `cyan-400` | `#22d3ee` | Charts, stats, links, info badges, Distribution command center |
| Data bg | `cyan-500/15` | — | Badge backgrounds for data items |
| Chart stroke | `#22d3ee` | — | Recharts line/area strokes |

### Semantic Colors

| Color | Tailwind | Usage |
|---|---|---|
| Red | `red-400` / `red-500` | Errors, destructive, bounces, hostile |
| Green | `green-400` / `emerald-400` | Success, healthy, positive, inbound |
| Orange | `orange-400` / `amber-400` | Warnings (amber overlap intentional) |

### Neutral

| Token | Tailwind | Usage |
|---|---|---|
| Background | `zinc-900` / `zinc-950` | Dark background |
| Card | `zinc-800` | Card backgrounds |
| Border | `zinc-700` / `zinc-800` | Borders, dividers |
| Text primary | `zinc-100` / `zinc-200` | Headings, body text |
| Text muted | `zinc-400` | Secondary text (min for important text) |
| Text dim | `zinc-500` | Hints only (never important content) |

### Regles de contraste

| Combo | Ratio | Verdict |
|---|---|---|
| amber-500 on zinc-950 | ~9.3:1 | OK |
| cyan-400 on zinc-950 | ~11:1 | OK |
| amber-950 on amber-500 | ~7:1 | OK (text on primary button) |
| white on amber-500 | ~2.06:1 | **INTERDIT** — use amber-950 |
| white on cyan-400 | ~1.73:1 | **INTERDIT** — use zinc-900 |
| zinc-500 on zinc-950 | ~4.0:1 | Borderline — **never for important text** (use zinc-400 min) |

### INTERDITS palette

- Texte blanc sur fond plein amber ou cyan
- zinc-500 pour texte important (hints seulement)
- Amber + cyan + violet + green sur une meme carte
- Glow derriere du body text

---

## 3. Typographie

### Fonts

| Font | Variable | Usage |
|---|---|---|
| **Inter** | `--font-sans` | UI text (body, labels, buttons, navigation) |
| **Archivo Black** | `--font-score` | Score numbers, rank labels, hero stats |

Loaded via `next/font/google` in `app/layout.tsx`.

### Echelle

| Token | Size | Line-height | Weight | Usage |
|---|---|---|---|---|
| text-xs | 12px | 16px | 400-500 | Badges, timestamps, footnotes |
| text-sm | 14px | 20px | 400-500 | Body, descriptions, table cells |
| text-base | 16px | 24px | 400-500 | Default body text |
| text-lg | 18px | 28px | 500-600 | Section titles, card headers |
| text-xl | 20px | 28px | 600-700 | Page subtitles |
| text-2xl | 24px | 32px | 700 | Page titles |
| text-3xl | 30px | 36px | 700-800 | Hero subtitles |
| text-4xl | 36px | 40px | 800 | Landing hero text |

### Score font tokens

| Token | Size | Weight | Letter-spacing | Usage |
|---|---|---|---|---|
| score-sm | 32px | 900 | -0.04em | Small score displays |
| score-md | 48px | 900 | -0.04em | Card scores, stat heroes |
| score-lg | 72px | 900 | -0.04em | Landing hero score |
| score-xl | 96px | 900 | -0.04em | Full-screen score reveal |

All score tokens use `font-family: var(--font-score)`, `font-variant-numeric: tabular-nums`.

### Regles

- Max 2 font families + 1 monospace per page
- Max 3 font weights per component
- Archivo Black for scores/ranks ONLY — never for body text or buttons
- **Uppercase + letter-spacing**: reserved for **system labels only** (11px/700/0.14em). Examples: BLOWUP CHANCE, CLIP FARM RUNNING, MANUAL OVERRIDE, LIVE OUTPUT. All section titles and card headers use normal case (15-20px/700).

---

## 4. Espacements

Base unit : **4px**.

| Token | Value | Usage |
|---|---|---|
| space-1 | 4px | Inline icon gap, tight badge padding |
| space-2 | 8px | Button gap, small padding, badge gap 6-8 |
| space-3 | 12px | Input padding, small card padding |
| space-4 | 16px | Card padding mobile, grid gap, section margin |
| space-5 | 20px | Card padding desktop, grid gap desktop |
| space-6 | 24px | Modal padding, page padding tablet |
| space-8 | 32px | Page padding desktop, section spacing |
| space-10 | 40px | Large section spacing |
| space-12 | 48px | Hero spacing |
| space-16 | 64px | Page-level spacing |
| space-20 | 80px | Landing section gap |

### Standards composants

| Element | Mobile | Desktop |
|---|---|---|
| Card padding | 16px | 20px |
| Page padding | 16px | 24-32px |
| Grid gap | 16px | 20px |
| Modal padding | 20px | 24px |
| Button icon gap | 8px | 8px |
| Badge icon gap | 6px | 6px |

---

## 5. Rayons (border-radius)

| Element | Radius | Notes |
|---|---|---|
| Buttons | 12px | Standard across app |
| Inputs | 10px | Slightly tighter |
| Cards | 16px | `--va-radius: 16px` in distribution |
| Feature cards | 20px | Landing page, special sections |
| Modals | 20-24px | |
| Pills / badges | 999px (full) | Always full-round |
| Thumbnails | 8-10px | |

### Ecarts releves (code actuel)

- Distribution hub uses 7-18px radius inconsistently (7px on some sub-elements, 14px on glass cards, 18px on schedule)
- Some buttons at 8px instead of 12px
- See backlog section

---

## 6. Effets

### Glass, Card & Panel classes

| Class | Background | Border | Blur | Shadow | Usage |
|---|---|---|---|---|---|
| `.va-glass` | `rgba(24,24,27,.72)` | `rgba(255,255,255,.08)` | `16px` | `0 4px 24px rgba(0,0,0,.3)` | Floating panels, modals, overlays |
| `.va-card` | `rgb(24,24,27)` / `zinc-900` | `rgba(255,255,255,.07)` | none | `0 1px 3px rgba(0,0,0,.2)` | Static cards, list items |
| `.va-panel` | `rgba(9,9,11,.62)` | `rgba(255,255,255,.08)` | none | `0 16px 48px rgba(0,0,0,.28)` | Accordions, AI cards, empty states, settings panels. Radius 16px, padding 20px. Hover: border `white/14`. |
| `.va-panel-active` | — | `rgba(245,158,11,.20)` | — | — | Feature ON state — amber border accent. Applied with `.va-panel`. |
| `.va-panel-muted` | — | — | — | — | Feature OFF — `opacity: 0.72`. Applied with `.va-panel`. |

### Glow levels (6)

Glow opacity capped at `.22` at rest, `.30` on hover. Reduced ~30% from previous values.

| Class | Spread | Opacity | Color | Usage |
|---|---|---|---|---|
| `.glow-soft-amber` | 24px | .18 | amber-500 | Subtle highlight, label glow |
| `.glow-medium-amber` | 36px | .24 | amber-500 | CTA hover, active state |
| `.glow-soft-cyan` | 24px | .18 | cyan-400 | Data highlight, chart accent |
| `.glow-medium-cyan` | 36px | .24 | cyan-400 | Distribution core, active data |
| `.glow-rank-legendary` | 48px | .28 | amber-400 | Legendary rank cards only |
| `.glow-rank-master` | 60px | .32 | red-500/orange | Master rank cards only |

### Regles glow

- 1 seule couleur de glow par composant
- Glow anime reserve a legendary/master + primary CTA hover
- Jamais derriere du body text
- Distribution cyan theme = exception documentee

---

## 7. Animations

### Durees & easings

| Context | Duration | Easing | Notes |
|---|---|---|---|
| Hover | 120ms | ease-out | Color, opacity, shadow |
| Press / active | 80ms | ease-out | scale(.98) |
| Dropdown / tooltip | 160ms | cubic-bezier(.16,1,.3,1) | Overshoot spring |
| Modal enter | 220ms | ease-out | opacity + scale(.96) + y(8px) |
| Modal exit | 160ms | ease-in | Faster out than in |
| Page transition | 240ms | ease-out | Fade + translateY(4px) |
| Skeleton shimmer | 1200ms | linear, infinite | translateX(-100% → 200%) |
| Rank shimmer | 2400-4000ms | ease-in-out, infinite | Master/legendary only |

### Transforms standards

| Element | Transform | Trigger |
|---|---|---|
| Card hover | `translateY(-2px) scale(1.005)` | :hover |
| Button active | `scale(.98)` | :active |
| Modal enter | `opacity(0→1) scale(.96→1) translateY(8→0)` | mount |
| Badge pop | `scale(0.7→1.08→1)` | appear |

### Regles motion

- Aucune animation permanente sauf skeleton/loading et rank rares (shimmer legendary/master)
- Max 1 animation continue visible par viewport
- `prefers-reduced-motion: reduce` respecte — desactiver toutes les animations non-essentielles
- Pas de tilt/parallax au mobile (performance + nausee)
- Distribution hub blink animations = exception documentee (status indicators)

---

## 8. Iconographie

**Lucide React** = icones fonctionnelles (navigation, actions, statuts).
**SVG custom** (skull, crown, wolf) = identite de marque uniquement.

### Tailles

| Context | Size | Stroke |
|---|---|---|
| Navigation | 18px | 2px |
| Button inline | 16px | 2px |
| Badge | 12px | 2.25px |
| Stat card | 18px | 2px |
| Empty state | 32px | 2px |
| Modal hero | 40px | 1.5px |

### Regles

- Stroke 2px standard, 2.25px pour icones 12-14px (lisibilite)
- Jamais skull/crown pour une action standard (reserve aux ranks)
- Wolf SVG = brand emblem, distribution core seulement

---

## 9. Boutons

### Variantes (tailles)

| Variant | Height | Padding H | Font size | Icon size |
|---|---|---|---|---|
| xs | 28px | 8px | 12px | 14px |
| sm | 32px | 12px | 13px | 15px |
| md (default) | 40px | 16px | 14px | 16px |
| lg | 48px | 20px | 15px | 18px |
| xl | 60px | 24px | 16px | 20px |

### Primary spec

```
background: linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)
color: #451a03 (amber-950)
box-shadow: 0 0 20px rgba(245, 158, 11, .22) (hover: .30)
border-radius: 12px
font-weight: 700
```

This is the ONE gradient for ALL primary action buttons: AI Optimize (Enhance), Publish, "Steal this clip" (Browse), Upgrade (paywall), "Place in bank" (post-render).

### INTERDITS boutons

- Texte blanc sur primary (amber-950 obligatoire)
- Deux boutons primary dans le meme bloc visuel ("1 primary per zone")
- Primary cyan sauf feature purement data-only (ex: chart zoom)

---

## 10. Badges / Pills

| Element | Height | Font | Radius | Style |
|---|---|---|---|---|
| Status badge | 20-24px | 11px 500 | full | bg color/12 + border color/24 + text color-400 |
| Filter pill | 32px | 12px 600 | full | bg color/16 + border color/35 + text color-300 |
| Status indicator | 26px | 12px 600 | full | bg color/12 + border color/24 + text color-400 |

---

## 11. Modals / Drawers

### Largeurs

| Type | Width |
|---|---|
| Alert / confirm | 420px |
| Standard form | 560px |
| Detail view | 720px |
| Full feature | 920px |
| Drawer (desktop) | 420-520px |
| Drawer (mobile) | bottom sheet, 100% width |

### Overlay

```
background: rgba(0, 0, 0, .64)
backdrop-filter: blur(8px) max
```

### Timing

- Enter: 220-240ms ease-out
- Exit: 160-180ms ease-in

---

## 12. Empty States

### Philosophie

Jamais de fake data floutee. L'empty state est un moment de coaching.

### Structure template

```
[Icon 32px zinc-500]

Title (18px / 700 / zinc-100)

Description (14px / 400 / zinc-400 / max-width 520px / text-center)

Checklist (3-5 items de ce qui se debloque):
  ✓ What this unlocks line 1
  ✓ What this unlocks line 2
  ✓ What this unlocks line 3

[CTA Primary button]

Hint: "~60 seconds" / "Setup takes ~2 minutes" (12px zinc-500)
```

---

## 13. Skeletons

- Doivent matcher le layout final (memes dimensions, memes positions)
- Shimmer opacity max `.10`
- Duration: 1200-1600ms linear infinite
- Background: `rgba(63, 63, 70, .45)`
- Pas de faux texte (seulement des blocs de la bonne taille)

---

## 14. Responsive

### Breakpoints

| Name | Width | Usage |
|---|---|---|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Large desktop |
| 2xl | 1440px | Dashboard max-width |

### Regles

- Mobile : 1 colonne + sticky bottom CTA
- Cards : min 280px width
- Dashboards : max-width 1440px
- Landing : max-width 1200px
- Editor preview : sticky seulement >= 1024px
- Distribution hub : max-width 1380px

### Touch targets

- Recommande : 44px (WCAG 2.2)
- Minimum absolu : 24px

---

## 15. Accessibilite

### Contraste

- Texte normal : >= 4.5:1 (WCAG AA)
- Texte large (>=18px bold ou >=24px) : >= 3:1

### Focus ring standard (applied globally)

```css
/* Applied globally to all interactive elements via globals.css */
button:focus-visible, a:focus-visible, input:focus-visible,
select:focus-visible, textarea:focus-visible,
[role="button"]:focus-visible, [tabindex]:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgb(24 24 27), 0 0 0 4px rgb(245 158 11);
}
```

Equivalent Tailwind : `focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950`

Amber focus ring replaces any white/blue default. No additional focus styling needed on components.

### Regles

- Jamais la couleur seule pour communiquer un statut (toujours icone ou texte en complement)
- `aria-label` sur tout bouton icon-only
- `role="dialog"` + `aria-modal="true"` sur tous les modals
- Skip to content link sur les pages principales

---

## 16. Z-Index System

| Layer | Value | Usage |
|---|---|---|
| Base | 0 | Default content |
| Card hover | 10 | Elevated card on hover |
| Sticky header | 30 | Dashboard top nav |
| Dropdown | 50 | Menus, popovers, tooltips |
| Drawer | 70 | Side drawer overlay |
| Modal overlay | 80 | Dark backdrop |
| Modal | 90 | Dialog content |
| Toast | 100 | Notifications, toasts |
| Command menu | 110 | Global command palette |

### Ecarts releves

- Onboarding modals use `z-[100]` (correct — above toasts, intentional)
- Rank cards use z-index 3-10 internally (scoped, not conflicting)
- ElectricBorder uses z-index 0-2 internally (scoped)

---

## 17. Data Visualization

| Element | Color | Notes |
|---|---|---|
| Primary chart line | cyan-400 `#22d3ee` | Default Recharts stroke |
| Revenue / money | amber-400 `#fbbf24` | MRR, commissions |
| Success | emerald-400 `#34d399` | Conversion, growth |
| Error / churn | red-400 `#f87171` | Bounces, failures |
| Grid lines | `rgba(255,255,255,.06)` | Subtle |
| Axis labels | zinc-500 | |
| Tooltip | zinc-900 border white/10, 95% opacity | |

---

## 18. Gouvernance des Rangs

### Couleurs de rang (exceptions controlees)

| Rank | Score | Colors | Ornements |
|---|---|---|---|
| Common | <25 | zinc-600 | none |
| Rare | 25-44 | cyan-500 | none |
| Super Rare | 45-64 | purple-400 | none |
| Epic | 65-79 | **violet-500** | subtle border glow |
| Legendary | 80-94 | **amber-400 / gold** | animated shimmer, glow-rank-legendary |
| Master | 95+ | **red-500 / fire / skull / crown** | glow-rank-master, sparks, flame overlay |

### Regle d'or

Les couleurs et ornements de rang (violet, gold shimmer, fire, skull, crown) ne fuient **JAMAIS** dans l'UI SaaS normale. Ils sont reserves aux :
- Cartes de clip rank (`rank-cards.css`)
- Badges de rank dans les listes
- Score displays dans l'enhance page

### Exception : Distribution cyan theme

Le theme cyan du command center Distribution (`distribution-hub.css`) est une exception documentee. Le cyan y remplace amber comme couleur dominante pour marquer la zone "systeme/intelligence" distincte du reste de l'app. Exception: amber is used ONLY for actions (Publish buttons) on this page. All data/info stays cyan.

### Renaming: AI FIT → Match

"AI FIT 66%" is renamed to "Match 66%" with tooltip "Based on clip strength + timing + account history" to avoid fake-AI perception.

### Exceptions gamification (intentionnelles)

Les cas suivants sont des derogations controlees a la regle "pas de couleur de rang dans l'UI normale" :

| Exception | Couleurs | Raison |
|---|---|---|
| **Cartes de rang Browse** : epic=violet, legendary=or, master=feu | violet-500, amber-400, red-500 | Identite de tiers — ces couleurs SONT le rang. Exemptees de la regle violet→amber. |
| **Theme cyan command-center Distribution** | cyan-400 dominant | Zone "systeme/intelligence" visuellement distincte du produit principal. |
| **Couleurs de moods Enhance** | couleurs variees par mood (rage=red, funny=yellow, etc.) | Les moods ont leur propre palette semantique (6 moods = 6 couleurs). Exemptees de amber/cyan only. |
| **Instagram gradient** (Analytics) | pink-600 → purple-600 | Couleur de marque plateforme, pas un choix design Viral Animal. |

---

## 19. Copy Rules

**Short. Confident. Slightly feral. Never corporate.**

| Good | Bad |
|---|---|
| "Catch this trend before it cools" | "Leverage AI-powered optimization" |
| "3 clips ready to post" | "Your content pipeline has been populated" |
| "This clip is fire" | "High engagement potential detected" |
| "Drop it before everyone else" | "Optimize your publishing cadence" |
| "~60 seconds" | "Estimated completion time" |

### Regles

- Titres : 3-7 mots max
- Descriptions : 1-2 phrases max
- CTAs : verbe + objet ("Generate clip", "Post now", "Browse clips")
- Empty states : coaching, pas d'excuses ("Add your first clip" pas "No content available")

---

## 20. Density Modes

### Creator mode (defaut)

- Cartes grosses, thumbnails prominentes
- Visuels et scores visibles
- Peu de controles visibles (reveal on hover)
- Glow et effets actifs

### Admin mode

- Tables denses, lignes compactes (32-36px row height)
- Boutons petits (xs/sm)
- Moins de glow (pas de rank shimmer, pas de glass effect)
- Data-first : chiffres > visuels

---

## 21. Thumbnail / Overlay Rules

- Scrim noir 35-55% obligatoire derriere tout texte sur thumbnail
- Jamais de petit texte (<14px) sur du gameplay sans scrim
- Score overlay sur thumbnail seulement si contraste >= 4.5:1 (scrim oblige)
- Controles (play, share, remove) : hover reveal desktop / toujours visible mobile
- Aspect ratio : toujours 16:9 pour les clips, `object-cover` pour le remplissage

---

## 22. Les 5 Interdits "Amateur" (Do / Don't)

### 1. Trop de glow

- **DO** : 1 glow par composant, couleur unique, subtil (opacity < .25)
- **DON'T** : 3+ glows superposes, glow arc-en-ciel, glow qui cache le contenu

### 2. Neon illisible

- **DO** : Neon sur fond sombre avec contraste >= 4.5:1
- **DON'T** : Texte blanc sur cyan/amber, texte neon < 14px, glow derriere du body text

### 3. Gamification sans hierarchie

- **DO** : Rank = reward visuel APRES avoir accompli quelque chose
- **DON'T** : Skull/crown sur chaque bouton, fire emoji sur les labels, confetti permanent

### 4. Animations permanentes multiples

- **DO** : 1 animation continue max par viewport (skeleton ou rank shimmer)
- **DON'T** : 5 elements qui pulsent simultanement, particules partout, tilt au scroll

### 5. Rayons et ombres incoherents

- **DO** : Rayons standardises (boutons 12, cards 16, pills full)
- **DON'T** : 7px ici, 18px la, 24px ailleurs sur le meme ecran, ombres de directions differentes

---

## 23. Ecarts releves (backlog polish)

Les ecarts suivants ont ete releves dans le code actuel. NE PAS corriger maintenant — c'est la liste de travail des sessions de polish a venir.

| Fichier | Ecart | Standard |
|---|---|---|
| `distribution-hub.css` | Rayons inconsistants : 7px, 8px, 10px, 12px, 14px, 18px sur le meme ecran | Standardiser : cards 16px, sub-elements 10-12px, pills full |
| `distribution-hub.css` | Blur values varient : 4px, 6px, 8px, 18px, 20px | Standardiser : glass 16px, modal overlay 8px max |
| `distribution-hub.css` | Multiple animations `dist-blink` permanentes (6+ elements qui pulsent) | Reduire a 1-2 indicateurs max par viewport |
| `distribution-hub.css` | Violet legacy tokens (`--va-violet`) encore presents malgre migration amber/cyan | Migrer vers amber/cyan ou supprimer |
| `rank-cards.css` | z-index 3-10 utilises sans systeme, risque de collision | Documenter comme "scoped internal" (deja isole) |
| `globals.css` | ~~Aucun token utilitaire global~~ — **FIXED v2.1**: .va-panel, global focus ring, .va-panel-active/muted added | — |
| Composants generaux | Certains boutons a radius 8px au lieu du standard 12px | Aligner au prochain polish pass |
| Composants generaux | `zinc-500` utilise pour du texte important dans certains endroits | Migrer vers `zinc-400` minimum |

---

*Document version 2.1 — 2026-07-02 — Added .va-panel, uppercase system-labels-only rule, 1 primary per zone, glow -30%, global amber focus ring, AI FIT→Match rename.*
