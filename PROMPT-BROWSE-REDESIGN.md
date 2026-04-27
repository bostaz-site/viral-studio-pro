# PROMPT — Browse Clips Card Ranking Visual Redesign

## OBJECTIF
Refaire complètement le système visuel des cartes dans Browse Clips. 3 niveaux visuels seulement : **Gold** (Master 95+ / Legendary 80-94), **Violet** (Epic 65-79), **Neutral** (tout sous 65). Basé sur un mockup HTML validé.

## FICHIERS À MODIFIER

1. `app/rank-cards.css` — RÉÉCRIRE COMPLÈTEMENT avec le nouveau système
2. `components/trending/rank-badge.tsx` — Le score devient un gros chiffre Archivo Black dans le thumbnail, plus un petit badge
3. `components/trending/trending-card.tsx` — Restructurer le card layout, ajouter les frames/ornements par tier

## FONT À AJOUTER
Ajouter dans `app/layout.tsx` ou le `<head>` : Google Fonts **Archivo Black** (pour les scores).
```
Archivo Black 900
```

---

## SYSTÈME DE TIERS (3 niveaux visuels)

Les ranks `common`, `rare`, `super_rare` sont TOUS traités comme **NEUTRAL** visuellement (identiques).

| Tier | Ranks | Score | Couleur score | Taille score | Bordure carte | CTA |
|------|-------|-------|---------------|-------------|---------------|-----|
| **NEUTRAL** | common, rare, super_rare | 0-64 | `#9CA3AF` | 42px, weight 700 | `1px solid #181C26` | Gris `bg:#161B27 border:#22283A color:#9CA3AF` opacity 0.75 |
| **EPIC** | epic | 65-79 | `#A78BFA` (violet) | 48px, weight 700 | `rgba(139,92,246,.18)` | Violet gradient `from #7C3AED to #6D28D9`, color `#F5F3FF`, opacity 0.7 |
| **LEGENDARY** | legendary | 80-94 | `#D4B06E` (or mat) | 68px, weight 800 | 2px gradient border gold (voir CSS) | Or doux gradient `from #D4B06E to #B08A3E`, color `#3A2808`, height 34px |
| **MASTER** | master | 95+ | `#FFE066` (or vif) | 104px, weight 900 | 2.5px conic-gradient rotatif | Noir+or avec shimmer animé, height 42px, skull icon |

---

## LE SCORE — GROS CHIFFRE DANS LE THUMBNAIL

Le score n'est PLUS un badge en haut à droite. C'est un **gros chiffre Archivo Black** positionné `absolute top-right` dans le thumbnail.

```css
.score {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 5;
  font-family: 'Archivo Black', 'Archivo', sans-serif;
  font-weight: 900;
  font-size: 52px; /* base — override par tier */
  line-height: .85;
  letter-spacing: -.05em;
  color: #9CA3AF;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 10px rgba(0,0,0,.7);
}
```

### Score par tier :
- **Neutral** : `color:#9CA3AF; font-size:42px; font-weight:700`
- **Epic** : `color:#A78BFA; font-size:48px; font-weight:700; text-shadow:0 2px 8px rgba(0,0,0,.6)`
- **Legendary** : `color:#D4B06E; font-size:68px; font-weight:800; text-shadow:0 2px 6px rgba(0,0,0,.55); letter-spacing:-.05em`
- **Master** : `color:#FFE066; font-size:104px; font-weight:900; top:2px; text-shadow: 0 0 28px rgba(255,210,60,.95), 0 0 12px rgba(255,240,180,.85), 0 0 4px #FFD84A, 0 4px 12px rgba(0,0,0,.7); letter-spacing:-.06em; line-height:.95`

---

## DECORATIVE FRAMES (Epic / Legendary / Master)

Les frames sont des overlays `position:absolute;inset:0;pointer-events:none;z-index:4` dans le thumbnail.

### Epic — Violet corner brackets (CSS only)
Petits brackets violets dans les 4 coins. Pas de SVG. Pas d'edges.
```css
/* Corner bracket: 16x16, border-top + border-left 1.5px solid #A78BFA, opacity .8 */
/* Les coins TR/BL/BR sont mirrorés avec scaleX(-1), scaleY(-1), scale(-1,-1) */
```

### Legendary — Gold edges + Diamond SVG corners
- **Edges** : lignes 1.5px le long des bords avec gradient gold `transparent 8% → #FCD34D 28% → #FEF9C3 50% → #FCD34D 72% → transparent 92%` + box-shadow `0 0 8px rgba(252,211,77,.7)`
- **Corners** : 44x44px, SVG diamant facetté (octogone or avec facettes brillantes + spark). Le SVG dans le coin TL est orienté normalement, les autres coins sont mirrorés via CSS transform.

### Master — Thick gold double-band + Ornate filigree SVG corners + Crown + Skull + Sparks
- **Edges** : 3px d'épaisseur, gradient `#FCD34D → #B45309 → #FCD34D` + `box-shadow: 0 0 0 1px #1A0F03, 0 0 12px rgba(255,180,40,.6)`. Edges offset de 24px des coins.
- **Corners** : 34x34px SVG filigree noir+or avec mini skull cameo
- **Crown pediment** : SVG couronne ornée 110x44px, centrée en haut du thumbnail (left:34%, translateX(-50%)), z-index:8, avec glow radial derrière et drop-shadow
- **Skull mark** : Badge rond 34x34px, gradient radial or `#FFF4B8 → #FCD34D → #92400E`, positionné top:42px left:10px, avec animation bob (3s)
- **Sparks** : 5 particules absolues (petits cercles lumineux) autour du score, animation spark (3.2s staggered)

---

## CARTE — BORDER ET EFFETS PAR TIER

### Neutral (common/rare/super_rare)
```css
border: 1px solid #181C26;
/* Hover: translateY(-2px) scale(1.01) brightness(1.05), border-color:#2A3145 */
```

### Epic
```css
border-color: rgba(139,92,246,.18);
/* Hover: translateY(-2px), border-color:rgba(139,92,246,.4) */
```

### Legendary
```css
border: 2px solid transparent;
background:
  linear-gradient(#0E1117,#0E1117) padding-box,
  linear-gradient(135deg,#FFE58A 0%,#FBBF24 30%,#F59E0B 55%,#FCD34D 80%,#FFE58A 100%) border-box;
box-shadow: 0 0 0 1px rgba(255,215,0,.15), 0 14px 40px -18px rgba(0,0,0,.6);
/* Hover: translateY(-3px) scale(1.02), box-shadow plus intense */
```

### Master
```css
border: 2.5px solid transparent;
background:
  linear-gradient(#120B06,#0E1117) padding-box,
  conic-gradient(from var(--rot,0deg),
    #FFD700 0deg, #FFAF38 60deg, #FF5722 130deg,
    #FFD700 200deg, #FFE066 280deg, #FFD700 360deg
  ) border-box;
animation: masterRotate 10s linear infinite, masterPulse 5.5s ease-in-out infinite;
box-shadow:
  0 0 0 1px rgba(255,170,40,.4),
  0 0 60px -4px rgba(255,140,0,.7),
  0 0 120px -20px rgba(255,80,0,.5),
  0 20px 70px -20px rgba(255,120,0,.7);
/* Hover: translateY(-5px) scale(1.03) */
```

**Master external halo** (::after sur la carte) :
```css
content:''; position:absolute; inset:-28px; border-radius:28px; pointer-events:none; z-index:-1;
background:
  radial-gradient(ellipse at center,rgba(255,150,0,.28),transparent 60%),
  radial-gradient(ellipse at center,rgba(255,60,0,.12),transparent 75%);
animation: haloBreathe 5s ease-in-out infinite;
```

**Master thumbnail shimmer** (::before sur le thumb) :
```css
background: linear-gradient(110deg, transparent 25%, rgba(255,215,0,.22) 42%, rgba(255,255,255,.38) 50%, rgba(255,140,0,.22) 58%, transparent 75%);
background-size: 230% 100%;
animation: masterShimmer 4.5s ease-in-out infinite;
mix-blend-mode: screen;
```

**Master meta warm tint** :
```css
background: radial-gradient(ellipse at top,rgba(255,140,0,.08),transparent 60%), #0E1117;
```

---

## ANIMATIONS (toutes dans rank-cards.css)

```css
@property --rot { syntax:'<angle>'; initial-value:0deg; inherits:false }
@keyframes masterRotate { to { --rot:360deg } }
@keyframes masterPulse {
  0%,100% { filter:brightness(1) }
  50%     { filter:brightness(1.12) }
}
@keyframes masterShimmer {
  0%,100% { background-position:140% 0 }
  50%     { background-position:-40% 0 }
}
@keyframes ctaShimmer {
  0%,100% { background-position:140% 0 }
  50%     { background-position:-40% 0 }
}
@keyframes haloBreathe {
  0%,100% { opacity:.8; transform:scale(1) }
  50%     { opacity:1; transform:scale(1.04) }
}
@keyframes skullBob {
  0%,100% { transform:translateY(0) }
  50%     { transform:translateY(-2px) }
}
@keyframes spark {
  0%,100% { opacity:0; transform:translateY(0) scale(.6) }
  50%     { opacity:1; transform:translateY(-4px) scale(1.1) }
}
```

### Reduced motion
```css
@media (prefers-reduced-motion:reduce) {
  .r-master, .r-master .thumb::before, .r-master::after, .master-skull,
  .master-sparks span, .r-legendary .thumb::before { animation:none !important }
}
```

---

## CTA BUTTON — "Make It Viral"

### Neutral
```css
background: #161B27; border: 1px solid #22283A; color: #9CA3AF;
opacity: .75; /* hover: opacity 1, bg:#1B2132, color:#E4E4E7, border:#2E3650 */
```

### Epic
```css
background: linear-gradient(180deg, #7C3AED 0%, #6D28D9 100%);
border: 1px solid rgba(167,139,250,.5);
color: #F5F3FF;
box-shadow: 0 2px 0 rgba(76,29,149,.4), inset 0 1px 0 rgba(196,181,253,.4);
opacity: .7; /* hover: bg from #8B5CF6 to #7C3AED, opacity 1 */
```

### Legendary
```css
background: linear-gradient(180deg, #D4B06E 0%, #B08A3E 100%);
border: 1px solid rgba(212,176,110,.5);
color: #3A2808; font-weight: 700; height: 34px; font-size: 11.5px;
text-shadow: 0 1px 0 rgba(255,255,255,.2);
box-shadow: inset 0 1px 0 rgba(255,240,200,.3);
opacity: .85; /* hover: opacity 1 */
```

### Master
```css
background:
  radial-gradient(ellipse at top,rgba(255,180,40,.2),transparent 70%),
  linear-gradient(180deg,#1A0F03 0%,#0A0704 100%);
border: 1.5px solid transparent;
color: #FFE58A; font-weight: 800; letter-spacing: .04em; font-size: 11.5px; height: 42px;
text-shadow: 0 0 10px rgba(255,200,60,.6);
box-shadow:
  0 0 0 1.5px #D97706,
  0 0 0 2.5px #FCD34D,
  0 0 0 3px #A16207,
  0 4px 20px -4px rgba(255,150,0,.6),
  inset 0 1px 0 rgba(255,220,100,.2);
/* ::before = shimmer sweep animation (ctaShimmer 4s) */
/* ::after = inner glow gradient */
/* Icon: Skull au lieu de Sparkles */
/* Hover: box-shadow plus intense */
```

---

## PLAY BUTTON

Cercle 44px, `bg:rgba(0,0,0,.7)`, border `rgba(255,255,255,.18)`, centré dans le thumbnail.
- **Caché par défaut** (opacity 0), visible au hover (opacity 1)
- **Master et Legendary** : forcé `opacity:0 !important`, mais au hover `opacity:.9 !important`

---

## SIGNAL TAGS (Hot now / Hidden gem)

Cachés par défaut (`opacity:0, max-height:0`), révélés au hover de la carte avec transition slide-up.
```css
.signal { opacity:0; transform:translateY(-2px); max-height:0; overflow:hidden; }
.clip:hover .signal { opacity:1; transform:translateY(0); max-height:24px; }
```
- **Hot** : `color:#FDA4AF; bg:rgba(239,68,68,.1); border:rgba(239,68,68,.22)` + Flame icon
- **Gem** : `color:#86EFAC; bg:rgba(34,197,94,.1); border:rgba(34,197,94,.22)` + Gem icon

---

## SVG COMPONENTS À CRÉER

### 1. DiamondCorner (pour Legendary)
Octogone facetté 32x32 or+blanc avec glow radial et spark. Utilisé dans les 4 coins (mirrored via CSS).

### 2. MasterCorner (pour Master)
Filigree noir+or 34x34 avec shield sombre, scroll acanthus doré, rosette, et mini skull cameo.

### 3. MasterCrown (pour Master pediment)
Couronne ornée 78x32 viewBox, 5 pointes avec gemmes, band filigree, arches entre les pointes.

Les SVGs complets sont dans le fichier `Browse Clips v5.html` dans le dossier uploads — copier le JSX tel quel.

---

## STRUCTURE HTML/JSX DE LA CARTE

```jsx
<article className={`clip r-${rank}`}>
  <div className="thumb">
    {/* Thumbnail image/video */}
    
    <span className={`pill-platform ${platform}`}>{platform}</span>
    
    {rank === 'master' && <MasterMarks />}  {/* skull badge */}
    
    {/* Frame overlay — Epic/Legendary/Master */}
    {(rank === 'epic' || rank === 'legendary' || rank === 'master') && (
      <div className="frame">
        <div className="edge top/bottom/left/right" />
        <div className="corner tl/tr/bl/br">{CornerSVG}</div>
      </div>
    )}
    
    {rank === 'master' && <MasterCrownPediment />}
    
    <span className="score">{score}</span>
    
    {rank === 'master' && <MasterSparks />}  {/* 5 spark particles */}
    
    <span className="pill-duration">{duration}</span>
    <div className="play-btn"><PlayIcon/></div>
  </div>
  
  <div className="meta">
    <h4 className="title">{title}</h4>
    <div className="author">
      <span className="av" /> <b>@{handle}</b> · {game}
    </div>
    {signal && <span className={`signal ${signal}`}>...</span>}
    <button className="cta">
      {rank === 'master' ? <SkullIcon/> : <SparklesIcon/>}
      Make It Viral
    </button>
  </div>
</article>
```

---

## CE QU'IL FAUT SUPPRIMER

1. L'ancien `RankBadge` component (le petit badge pill en haut droite) — remplacé par le gros score
2. L'ancien `getRankCardClass` qui retourne `card-champion`/`card-diamond`/`card-gold` — remplacé par `r-master`/`r-legendary`/`r-epic`
3. Les classes CSS `card-diamond`, `card-champion`, `card-gold` dans rank-cards.css — tout remplacer
4. Les labels de rank textuels ("Legendary", "Epic") — plus de texte, juste le score
5. Le message "🔥 Master — ready to blow up" sous les cartes — supprimé

## CE QU'IL FAUT GARDER

1. Video preview on hover (fetch Twitch clip URL + play)
2. Platform badge (top-left, style existant OK)
3. Duration pill (bottom-left)
4. Bookmark + External link buttons (bottom-right, hover only)
5. Toute la logique de `clipRank()` et les seuils dans `clip-scorer.ts`
6. Le streamer avatar gradient fallback
7. La grid 4 colonnes

---

## NOTES IMPORTANTES

- Utiliser des **classes CSS pures** dans `rank-cards.css` (pas Tailwind pour les effets complexes)
- Les classes Tailwind de base peuvent rester pour le layout simple
- Le `@property --rot` est nécessaire pour la rotation conic-gradient de Master — vérifier que Next.js/PostCSS le supporte, sinon utiliser un fallback
- Background du body/page : `#0B0E14`
- Font body : Inter (déjà dans le projet)
- Garder `overflow:hidden` sur la carte pour que les frames ne dépassent pas
- Le halo Master (`::after` avec `inset:-28px`) nécessite que la carte ait `overflow:visible` ou que le halo soit clippé autrement — attention au conflit avec `overflow:hidden` de la carte. Solution : mettre le halo sur un wrapper parent ou utiliser `outline` + `box-shadow` à la place.
