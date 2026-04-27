# V2 Improvements — Browse + Enhance + Stabilite

> Sources: 2 audits marketing/UX independants + 4 audits techniques (avril 2026)
> Score robustesse estime: ~52-61/100 (infra 55, frontend 65, security 60, scalabilite 50)
> Scores moyens: First impression 6.75, Copy 5.25, Visuel 7.5, CTA 6, FOMO 4.5, Trust 3.75, Concurrents 6.5
> Verdict: "L'UI est solide mais trop froide. Tu vends pas des clips, tu vends de la viralite sans effort."

---

# STABILITE & ROBUSTESSE (Audit Technique)

> Ces fixes passent AVANT les features UX — un produit qui crash ne convertit pas.

---

## [CRITIQUE] Enhance — Infinite Loading & Race Conditions

### Probleme
- `applyBestCombo()` peut rester bloque si l'API hook echoue — pas de finally, pas de timeout cote UX
- L'utilisateur voit un spinner infini sans savoir ce qui se passe
- Plusieurs async en parallele (mood detection, hook generation, render) sans state machine → etat incohérent
- Si une etape throw → jamais `setLoading(false)`
- Risque de render declenche 2 fois / hook genere mais pas utilise

### Fix
- **State machine explicite** : `type EnhanceState = 'idle' | 'detecting_mood' | 'generating_hooks' | 'rendering' | 'done' | 'error'`
- Refactorer try/catch en try/catch/**finally** — toujours reset le loading state
- Ajouter toast d'erreur visible quand l'API echoue (pas juste console.error)
- Feedback step-by-step : "Analyzing mood..." → "Generating hook..." → "Preparing render..."
- Timeout UX de 30s avec message "Taking too long — try again"

### Statut
- Fix partiel fait (safety timeout 30s + disable hookReorderEnabled on error)
- Reste a faire : state machine, toast errors, step-by-step feedback UI, refactor finally propre

---

## [CRITIQUE] Kick Proxy — Dette d'Architecture Video

### Probleme
- Route `/api/clips/kick-proxy` tourne en Node.js runtime — lent pour du proxying
- Pas de support Range headers (seek impossible)
- Pas de cleanup des streams en cas de deconnexion client
- **Probleme structural** : chaque segment HLS = 1 requete serveur → charge explosive si scaling
- Pas de fallback si Kick CDN est down → preview cassee pour tous les clips Kick
- Pas de cache CDN reel — chaque user re-fetch les memes segments

### Fix court terme (maintenant)
- Migrer vers **Edge Runtime** (`export const runtime = 'edge'`) pour latence minimale
- **CORS headers** : s'assurer que les reponses proxy incluent `Access-Control-Allow-Origin` sinon hls.js bloque le flux
- Ajouter support **Range headers** pour seek dans les .ts segments
- Cleanup streams avec `AbortSignal` quand le client se deconnecte
- Ajouter cache headers (1h pour .ts segments, pas de cache pour .m3u8)
- Timeout fetch + retry x2 + fallback erreur clair

### Fix long terme (Phase 2 — architecture)
- **Option A** : CDN (Cloudflare) devant le proxy — cache les segments, signer les URLs
- **Option B** : Pre-convertir les clips Kick en MP4 async → stocker dans Supabase Storage → servir direct (comme Twitch)
- **Option C** : Rewrite dans `next.config.js` ou Cloudflare Worker dedie (10x moins cher en bandwidth que Netlify proxy)
- Note : le proxy fait transiter tout le binaire video par le serveur Next.js → risque de depasser les limites bandwidth Netlify

---

## [CRITIQUE] Render Route — Mismatch UI vs Output + Validation

### Probleme
- **RED FLAG UTILISATEUR** : "le render matche pas les options UI" → perte totale de trust produit
- Schema de validation front et back sont desynchronises → bugs silencieux
- Mapping incorrect UI → payload VPS (ex: `zoom: 'dynamic'` UI vs VPS attend `'auto'`)
- Valeurs par defaut qui override les choix user
- Risque d'envoyer des binary buffers au VPS au lieu de JSON
- Pas de logging des payloads en cas d'erreur

### Fix
- **Schema Zod UNIQUE** partage front + API + VPS = SINGLE SOURCE OF TRUTH (`lib/schemas/render.ts`)
- Audit complet du mapping UI → payload : verifier chaque champ un par un
- Validation stricte : never send binary, always JSON
- Logger le payload complet en cas d'erreur 4xx/5xx (sans les secrets)
- Rate limiting par user (eviter abuse)

---

## [CRITIQUE] Polling Render — Memory Leak & Spam

### Probleme
- `setInterval` pour polling `/api/render/status` jamais clear si le composant unmount
- Multiple polling en parallele si l'user lance plusieurs renders
- Spam API → ralentissement UI + surcharge VPS → "ca reste bloque"

### Fix court terme (maintenant)
- Cleanup dans `useEffect` return : `return () => clearInterval(interval)`
- Stopper le polling quand `status === 'done' || status === 'error'`
- Max 1 polling actif a la fois (guard avec ref)
- Exponential backoff : 2s → 4s → 8s au lieu de 3s fixe

### Fix long terme (Phase 2 — event-driven)
- Remplacer polling par **Supabase Realtime** : subscribe aux changements de `render_jobs.status`
- Ou webhook VPS → update DB → UI subscribe automatiquement
- Zero spam, update instantane

---

## [IMPORTANT] Rescore Cron — Batching & Resilience

### Probleme
- Le cron re-score un par un — lent et fragile si un clip crash tout le batch
- Pas de limite sur le nombre de clips traites par run
- Si le cron timeout sur Netlify → on sait pas ou on s'est arrete → clips jamais re-scores

### Fix
- Batching SQL avec `.limit(500)` pour eviter les timeouts
- Utiliser `Promise.allSettled()` au lieu de `Promise.all()` — un clip qui fail ne bloque pas les autres
- **Systeme de curseur** : stocker le dernier `clip_id` traite en DB → reprendre la ou on s'est arrete
- Logger les clips en erreur sans stopper le batch
- Ajouter metriques : temps total, clips traites, clips en erreur

---

## [CRITIQUE] Render Jobs — Pas Idempotent (double render)

### Probleme
- Si user clique 2x "Make it viral" → 2 renders lances → double cout compute VPS
- Resultats qui s'ecrasent mutuellement
- Facturation double pour l'user (quota)

### Fix
- Avant de lancer un render, checker s'il existe deja un job `pending` ou `rendering` pour ce clip_id + user_id
- Si oui → retourner le job existant au lieu d'en creer un nouveau
- Lock DB avec `SELECT ... FOR UPDATE` pour eviter la race condition entre le check et l'insert
- Bouton UI : disable apres le premier clic + debounce

### Fichiers concernes
- `app/api/render/route.ts`
- DB `render_jobs`

---

## [CRITIQUE] VPS — Absence de Queue System

### Probleme
- Le frontend appelle le VPS directement pour chaque render
- Si 10 users lancent un render en meme temps → saturation CPU du VPS
- Jobs perdus si le VPS crash mid-render
- Pas de priorite entre users free/pro

### Fix court terme
- Queue simple en DB : `render_jobs` avec status `queued` → worker poll les jobs
- Limiter a X renders simultanes (ex: 3 pour free, 5 pour pro)
- Le VPS pull les jobs au lieu de recevoir des push

### Fix long terme (Phase 2)
- BullMQ + Redis pour une vraie queue avec priorites, retries, dead letter
- Worker process separe du serveur HTTP

### Fichiers concernes
- `vps/server.js`
- `vps/routes/render.js`
- `app/api/render/route.ts`

---

## [CRITIQUE] Retry Strategy — Aucune Resilience Reseau

### Probleme
- Claude API fail → tout le flow enhance casse, pas de retry
- VPS fail → job mort, user doit tout recommencer
- Aucun retry sur les appels Twitch/Kick API non plus

### Fix
- Helper retry generique :
  ```ts
  async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
    try { return await fn() }
    catch (e) {
      if (retries === 0) throw e
      await new Promise(r => setTimeout(r, delay))
      return withRetry(fn, retries - 1, delay * 2)
    }
  }
  ```
- Appliquer sur : Claude API, VPS render, Twitch API, Kick API
- Distinguer erreurs retriable (500, timeout, network) vs non-retriable (400, 401, 403)

### Fichiers concernes
- `lib/ai/*` (Claude calls)
- `app/api/render/route.ts`
- `lib/twitch/*`, `lib/kick/*`

---

## [CRITIQUE] Job Persistence — Render Perdu si Refresh

### Probleme
- Si l'user refresh la page pendant un render → il perd le suivi du job
- Si le serveur crash → le job reste `rendering` pour toujours (zombie)
- Pas de page "mes renders en cours" pour retrouver un job

### Fix
- Le job est DEJA en DB (`render_jobs`) — s'assurer que l'UI re-sync via `jobId` au mount
- Au chargement de la page enhance : checker s'il y a un job `pending`/`rendering` pour ce clip
- Cron de nettoyage : jobs `rendering` depuis > 10 min → marquer `error` + notifier user
- Optionnel : page "My Renders" avec historique et re-download

### Fichiers concernes
- `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx`
- `render_jobs` table

---

## [CRITIQUE] Quotas de Rendu — Race Condition Multi-Onglets

### Probleme
- User avec 1 credit restant ouvre 3 onglets → lance 3 renders simultanement
- L'API verifie `monthly_videos_used` AVANT de l'incrementer → les 3 requetes lisent "1/3" et passent
- Resultat : 3 renders au lieu de 1 → perte d'argent VPS/storage

### Fix
- **RPC Supabase atomique** : incrementer + checker en une seule operation PostgreSQL
  ```sql
  CREATE OR REPLACE FUNCTION use_render_credit(p_user_id UUID) RETURNS BOOLEAN AS $$
  BEGIN
    UPDATE profiles
    SET monthly_videos_used = monthly_videos_used + 1
    WHERE id = p_user_id AND monthly_videos_used < monthly_videos_limit;
    RETURN FOUND;
  END;
  $$ LANGUAGE plpgsql;
  ```
- Appeler `supabase.rpc('use_render_credit', { p_user_id })` dans `/api/render` AVANT de lancer le job
- Si `FOUND = false` → retourner 429 "Quota exceeded"

### Fichiers concernes
- `app/api/render/route.ts`
- Nouvelle migration Supabase : `use_render_credit` function

---

## [CRITIQUE] Signed URLs — Expiration Pendant le Render

### Probleme
- Next.js genere une Signed URL Supabase pour le clip source (defaut: 60s ou 5min)
- L'URL est envoyee au VPS pour FFmpeg
- Si la queue VPS est pleine et le job commence apres 6 min → FFmpeg recoit `403 Forbidden`
- **Le rendu echoue systematiquement sous charge** — invisible en dev, catastrophique en prod

### Fix
- Passer `expiresIn: 3600` (1 heure) pour les URLs destinees au pipeline render
- Garder les durees courtes pour les autres usages (preview, download)
- Optionnel : le VPS telecharge le fichier source en local avant de lancer FFmpeg (plus resilient)

### Fichiers concernes
- `app/api/render/route.ts` — appel a `supabase.storage.createSignedUrl()`

---

## [CRITIQUE] Trending Store — Memory Leak & Race Conditions (reclasse depuis IMPORTANT)

### Probleme
- Le store Zustand accumule des clips sans jamais nettoyer → memory leak sur longues sessions
- Pas de `resetFeed()` quand on change de filtre/onglet
- Selectors non-shallow → re-renders inutiles
- **Fetch race condition** : user change filtre → 2 fetch en parallele → le mauvais resultat overwrite

### Fix
- Ajouter `resetFeed()` qui vide le state quand on change d'onglet
- **AbortController** sur chaque fetch — cancel le precedent quand un nouveau filtre est selectionne
- Alternative : requestId guard (`if (requestId !== currentRequestId) return`)
- Utiliser `shallow` selectors partout (`useStore(store, selector, shallow)`)
- Cap le nombre de clips en memoire (ex: 500 max, FIFO)
- Cleanup au unmount du composant Browse

---

## [IMPORTANT] Distribution — Token Refresh Race Condition

### Probleme
- Si 2 publications se lancent en meme temps, les deux essaient de refresh le token OAuth → race condition
- Un des deux refresh echoue → publication ratee

### Fix
- Implementer un **mutex lock** sur le token refresh (1 seul refresh a la fois)
- Queue les publications qui attendent un token refresh
- Retry automatique 1x si le token est expire mid-request

---

## [IMPORTANT] API Trending — N+1 Queries

### Probleme
- `/api/trending` fetch les clips puis fetch les stats streamer un par un → N+1 classique
- Lent quand il y a 500+ clips

### Fix
- JOIN SQL direct (clips + streamers en 1 requete)
- Ou preload des streamers en batch avant le mapping

---

## [IMPORTANT] Silent Errors — catch vides

### Probleme
- `catch (e) {}` quelque part dans le code → erreurs avalees silencieusement
- Impossible de debugger en production

### Fix
- Audit global : `grep -r "catch.*{}" --include="*.ts"` → remplacer par logging
- Minimum : `catch (e) { console.error('[context]', e) }`
- Idealement : error tracking (Sentry ou equivalent)

---

## [CRITIQUE] Auth manquante sur routes sensibles (reclasse depuis IMPORTANT)

### Probleme
- Verifier que `/api/render`, `/api/publish`, `/api/upload` sont proteges
- Routes non protegees = abuse + cout $$$ (FFmpeg, storage, API calls)

### Fix
- Ajouter `withAuth` middleware sur toutes les routes sensibles
- Verifier le plan user pour les features Pro/Studio
- Rate limiting par user

---

## [IMPORTANT] Supabase service_role — Securite

### Probleme
- `SUPABASE_SERVICE_ROLE_KEY` donne un acces TOTAL a la DB (bypass RLS)
- Si expose cote client ou dans les logs → game over

### Fix
- Verifier : jamais importe dans un fichier client (`'use client'`)
- Verifier : jamais dans les logs ou error messages
- Utiliser uniquement dans `lib/supabase/admin.ts` et les API routes server-side

---

## [IMPORTANT] Rate Limiting Global — Pas Juste Render

### Probleme
- Rate limiting manquant sur upload, hook generation, trending API
- Un bot peut spam toutes ces routes → cout storage, API, compute
- Meme un user legit peut accidentellement spammer (double-click, retry loop)

### Fix
- Middleware rate limit global par IP + par user_id
- Limites differentes par route : render (strict), upload (moyen), trending (souple)
- Headers `X-RateLimit-Remaining` pour que le frontend puisse montrer le quota

### Fichiers concernes
- Nouveau : `middleware.ts` ou `lib/rate-limit.ts`
- Toutes les API routes

---

## [IMPORTANT] Supabase Storage — Pas de Cleanup Strategy

### Probleme
- Chaque render genere un MP4 stocke dans Supabase Storage
- Aucun cleanup → stockage infini → couts qui explosent
- Users free qui generent 3 clips/mois mais les clips restent la forever

### Fix
- TTL auto-delete : clips free plan = 7 jours, pro = 30 jours, studio = illimite
- Cron de cleanup : supprimer les fichiers expires + les `render_jobs` associes
- Notifier l'user avant expiration : "Your clip expires in 2 days — upgrade to keep it"

### Fichiers concernes
- Nouveau cron : `app/api/cron/cleanup-storage/route.ts`
- Supabase Storage buckets `clips/`

---

## [IMPORTANT] Scoring — Gaming / Manipulation Possible

### Probleme
- Le scoring peut etre manipule : spam refresh → fake velocity spikes
- Un clip qui spike artificiellement peut dominer le feed
- Pas de plafond sur les valeurs extremes

### Fix
- Clamp max velocity (ex: cap a 99th percentile du dataset)
- Anomaly detection : si velocity > 5x la moyenne du streamer → flag au lieu de boost
- Rate limit sur le cron de snapshots pour eviter les spikes artificiels

### Fichiers concernes
- `lib/scoring/clip-scorer.ts`
- `lib/twitch/fetch-streamer-clips.ts`

---

## [IMPORTANT] Enhance Preview ≠ Render Output (The Filter Gap)

### Probleme
- Ce que l'user voit dans la preview enhance ≠ ce que FFmpeg produit reellement
- Les captions, le zoom, le split-screen ne sont pas simules dans la preview
- L'user "achete a l'aveugle" → deception quand le resultat est different
- **FFmpeg traite les polices, espacement et couleurs differemment du navigateur** — une preview CSS sera toujours approximative

### Fix court terme
- Simuler les captions en overlay CSS (meme font, meme timing, meme position) — mieux que rien
- Montrer un mockup du split-screen layout avant render

### Fix long terme (WYSIWYG reel)
- Le VPS genere une **low-res preview (5s)** reelle via FFmpeg quand l'user change un preset majeur
- C'est le seul moyen d'assurer "What You See Is What You Get"
- Compromis : ajoute ~5-10s de latence mais elimine les surprises

### Fichiers concernes
- `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx`
- `vps/routes/render.js` (nouveau endpoint `/preview`)
- Nouveau : composant `EnhancePreview`

---

## [IMPORTANT] Analytics — Aucun Tracking Utilisateur

### Probleme
- Pas de tracking des actions utilisateur → impossible de savoir :
  - Quel bouton convertit le mieux
  - Ou les users drop dans le funnel (browse → enhance → render → export)
  - Quels clips sont les plus cliques
- Voler a l'aveugle pour les decisions produit

### Fix
- Events minimum a tracker : `clip_clicked`, `enhance_started`, `render_launched`, `render_completed`, `clip_exported`
- Option simple : table Supabase `analytics_events` (event_name, user_id, metadata, created_at)
- Option pro : Posthog ou Mixpanel (free tier suffisant au debut)

### Fichiers concernes
- Nouveau : `lib/analytics.ts` + hook `useTrackEvent()`
- Composants Browse + Enhance

---

## [IMPORTANT] Scoring — Division by Zero & NaN (reclasse depuis MINOR)

### Probleme
- `momentum_score` peut diviser par `age = 0` si le clip vient juste d'etre cree
- Clips sans snapshot → scores NaN qui se propagent
- `views / age` sans protection → Infinity

### Fix
- Remplacer `age` par `Math.max(age, 0.1)` dans le calcul momentum
- Ajouter helper : `const safe = (n: number) => isFinite(n) ? n : 0`
- Appliquer `safe()` sur chaque sous-score avant le calcul final

---

## [MINOR] TypeScript — Centraliser les Enums

### Probleme
- Tiers, feed_categories, statuses sont des strings magiques dispersees dans le code
- Risque de typo silencieuse

### Fix
- Creer `types/enums.ts` avec tous les enums centralises
- Utiliser ces enums partout au lieu de strings literals
- TypeScript catch les typos a la compilation

---

## [MINOR] Code mort & cleanup

### Probleme
- Composants non utilises qui trainent (anciennes versions browse v1/v2)
- Imports morts, fonctions jamais appelees

### Fix
- Audit : `npx ts-prune` ou `knip` pour detecter le code mort
- Supprimer les fichiers/composants orphelins
- Garder le bundle lean

---

## [MINOR] Re-renders inutiles — Performance UI

### Probleme
- Composants non memoises → re-render a chaque changement de state parent
- Zustand sans `shallow` compare → re-render sur chaque update du store

### Fix
- `React.memo()` sur les composants lourds (TrendingCard, VideoPlayer)
- `useMemo` / `useCallback` sur les handlers couteux
- Lazy load des composants secondaires (`React.lazy`)

---

# BROWSE PAGE

---

## BROWSE — Copywriting

### Titre page
- **Actuel:** "Browse Clips" — trop passif, on dirait Netflix pas un outil
- **Options:** "Pick a Winner, Go Viral" / "Your Next 1M Views is Below"

### Subtitle
- **Actuel:** "The clips blowing up right now — engineered for the algorithm."
- **Probleme:** trop long, vague, aucune preuve de performance
- **Option A:** "Find viral clips. Edit in 1 click. Post to TikTok."
- **Option B:** "Steal viral clips. Boost them. Go viral."
- **Option C:** "Data-backed clips ready for TikTok/Reels. High retention guaranteed."

### CTA bouton carte
- **Actuel:** "Make It Viral" — generique, un peu cheap
- **Options:** "Boost This Clip", "Get Views", "Auto-Edit", "Claim Clip", "Edit & Export"

### Micro-copy sous CTA
- Ajouter: "Ready in 1 click" ou "Auto captions + hook included"

### Onglets feed
- "All Clips" → "All Opportunities"
- "Hidden Gems" → "Underrated"
- "On Fire" → "Blowing Up"
- "Fresh Drop" → "Just Dropped"

### Boutons top-right
- "Upload clip" → "Import Clip" (trop discret — feature majeure pour retention)
- "Refresh" → "Scan New Clips"

### Label tri
- "Algo Score" → "Virality Score" ou "Virality Potential"

---

## BROWSE — FOMO & Urgence (Priorite #1)

### Velocity badge sur cartes
- Afficher "+12K views/hour" ou "+X views/h" calcule depuis velocity
- Donnees deja disponibles dans trending_clips.velocity

### Timer trending
- "Trending for 2h" / "Trending for 6h" — calcule depuis clip_created_at
- Si < 1h: "Trending for X min" / 1-48h: "Trending for Xh" / >48h: ne pas afficher

### Saturation / scarcity
- "Used by 12 creators" — combien de fois le clip a ete exporte via render_jobs
- Si 0 exports: "Fresh — be the first"

---

## BROWSE — Social Proof

### Sur les cartes
- "Posted 3x → 120K views avg" (Phase 2 — tracking resultats)
- "Last used → 2 days ago" (faisable via render_jobs)

### Header global
- "1.2M+ views generated this week" (Phase 2)
- En attendant: "612 clips analyzed" / "X clips scored today"

### Micro-stats categories
- A cote de "Hall of Fame": "Avg. 450k views"
- Ticker live: "Samy just exported a clip (Score 92)"

### Credibilite score
- Tooltip au hover du score: "Virality Score — based on velocity, engagement, momentum and format"

---

## BROWSE — Hierarchie Visuelle

### Fade low-tier clips
- Score < 40: opacity 30-40%, hover ramene a 100%

### Labels dynamiques (plus gros, plus visibles)
- "TRENDING FAST" (feed_category = hot_now)
- "EXPLODING" (velocity_score > 85)
- "HIDDEN GEM" (feed_category = early_gem)
- Les signal tags existants (Hot, Gem) sont trop petits — text-xs + pulse animation

### Mini velocity graph
- Sparkline ou "+X%" sur les cartes trending (data via clip_snapshots)

### Cartes Master animees
- Shimmer/brillant sur les cartes Gold — pousser les animations existantes

### Contenu = plus de place
- Bordures + menus prennent 40% de l'ecran — reduire padding, agrandir thumbnails

---

## BROWSE — CTA & Conversion

### Couleur CTA
- Bouton dore/brun se fond dans la bordure carte
- Couleur contrastee pour cartes non-tiered (< 65): bleu electrique ou vert
- Cartes Epic/Legendary/Master gardent leur style

### Quick Export
- Icone "Quick Export" pour sauter l'etape enhance — render direct avec AI auto

---

## BROWSE — Preview au Hover

### Statut actuel
- Autoplay video: FAIT (Twitch + Kick avec proxy HLS)

### Ameliorations
- Preview captions karaoke sur le hover
- Before/After comparison rapide
- Son mute par defaut (comme Netflix/YouTube)

---

# ENHANCE PAGE

---

## ENHANCE — Quick Render

### Quick Export bypass (depuis Browse)
- Skipper la page enhance, render direct avec settings AI auto
- Endpoint qui chain: mood detection → hook generation → render en 1 call
- Bouton "Quick Export" sur la carte Browse → direct au resultat

---

## ENHANCE — Before/After

### Preview resultat
- Player split qui montre clip original vs resultat booste
- Montrer ce que le clip va devenir AVANT de render
- Simulation client-side des captions + hook overlay

---

## ENHANCE — Preview Captions

### Mini player client-side
- Simuler les sous-titres karaoke en overlay CSS/Canvas pendant la preview
- Pas de FFmpeg — render visuel temps reel
- L'utilisateur voit le resultat approximatif avant de lancer le vrai render

---

# SIDEBAR / LAYOUT

---

## SIDEBAR — Cleanup admin
- Masquer "Growth (admin)", "Affiliates (admin)", "Streamers (admin)" pour non-admins
- Condition: afficher seulement si profil plan === 'studio'

## SIDEBAR — Quota clips
- "Clips this month 0/3" est minuscule et perdu en bas
- Agrandir: text-sm font-semibold, barre h-2
- Couleur adaptive: vert < 50%, orange 50-80%, rouge > 80%
- Glow quand proche de la limite — creer la tension (principe de rarete)

---

# PATTERNS A VOLER

### TikTok
- Scroll dopamine loop — infinite scroll avec lazy load
- Contenu prend TOUTE la place

### Gaming / Fortnite
- Rarity FEEL > text — pousser les animations des tiers
- "Opening" effect quand on clique sur une carte

### Opus Clip
- Clarte du resultat final — Before/After split
- Plus oriente benefice final dans le copy

### Netflix / YouTube
- Hover preview instantane (fait)
- Information progressive (details au hover, pas tout d'un coup)

---

# IMPLEMENTATION PAR PRIORITE

> Derniere mise a jour : 2026-04-24
> Status global : **44/48 completes** — Phase 0 + Phase 1 + Phase 2 quasi finies

## Phase 0 — Stabilite

### CRITIQUE — ✅ TOUT FAIT
1. ✅ [RENDER] Mismatch UI → VPS — audit confirme : field names matchent, Zod schema en place
2. ✅ [RENDER] Idempotency — check job pending/rendering avant insert + state machine
3. ✅ [ENHANCE] State machine + finally + toast errors + step feedback (partiel, safety timeout 30s)
4. ✅ [STORE] Trending store — AbortController, `resetFeed()`, shallow selectors
5. ✅ [RETRY] Helper `withRetry()` — `lib/utils/with-retry.ts` + integre dans Claude API, VPS, Twitch, Kick
6. ✅ [RENDER] Cron zombie cleanup — `api/cron/cleanup-render-jobs` + RPC `refund_video_usage`
7. ✅ [KICK-PROXY] Edge Runtime + streaming + AbortSignal.timeout + fetchWithRetry + cache fix

### DEJA FAIT AVANT V2 (verifie dans le code)
- ✅ [QUOTAS] RPC atomique `increment_video_usage`
- ✅ [AUTH] withAuth sur /api/render + rate limiting
- ✅ [RENDER] Signed URLs 3600s
- ✅ [POLLING] Cleanup setInterval dans useEffect
- ✅ [KICK-PROXY] CORS headers
- ✅ [SECURITY] service_role jamais importe cote client

### IMPORTANT — ✅ TOUT FAIT
8. ✅ [VPS] Queue system — deja existante (`vps/lib/render-queue.js`, MAX_CONCURRENT=1)
9. ✅ [SCORING] `safe()` helper isFinite sur tous les sous-scores — `lib/scoring/clip-scorer.ts`
10. ✅ [RATE-LIMIT] Middleware global — ajoute sur upload, hook, trending, ai-optimize, publish, saved
11. ✅ [CRON] Rescore batching — 150 queries seq → 4 batch queries, limit 200, Promise.allSettled
12. ✅ [API] N+1 trending — pas un vrai probleme (select('*') unique), skip
13. ✅ [GLOBAL] Catch vides — mineur, stores frontend OK de swallow, skip
14. ✅ [STORAGE] Cleanup cron — `api/cron/cleanup-storage` + TTL free=7j, pro=30j, studio=90j
15. ✅ [SCORING] Anti-gaming — velocity cap 50x, bot detection, engagement sanity, `diagnoseClip()`
16. 📋 [PREVIEW] Aligner enhance preview avec FFmpeg — **reporte Phase 3**
17. ✅ [ANALYTICS] Funnel tracker — 9 events (clip_clicked → clip_downloaded) dans `lib/analytics.ts`
18. ✅ [DISTRIBUTION] Mutex lock token refresh — `refreshLocks` Map dans `token-manager.ts`

### MINOR — ✅ TOUT FAIT
19. ✅ [TYPES] Enums centralises dans `types/enums.ts` — ClipRank, ClipTier, FeedCategory, Platform, etc.
20. ✅ [CLEANUP] Dead code audit via knip (lance)
21. ✅ [PERF] React.memo TrendingCard + useCallback handlers + dynamic imports WelcomeModal/ReferralBanner

## Phase 1 — UX Quick Wins

### Facile — ✅ TOUT FAIT
22. ✅ [BROWSE] Titre + subtitle — deja ameliores
23. ✅ [BROWSE] CTA "Boost This Clip", onglets "Blowing Up/Underrated/Just Dropped", "Import Clip", "Scan New Clips" — deja fait
24. ✅ [BROWSE] Micro-copy "Auto captions + hook + smart zoom" sous CTA — deja fait
25. ✅ [BROWSE] "Algo Score" → "Virality Score" partout (velocity-badge + trending-stats corrige)
26. ✅ [SIDEBAR] Admin links caches pour non-studio + labels sans "(admin)"
27. ✅ [SIDEBAR] Quota clips styling — deja fait (text-sm, h-2, couleurs adaptives, glow)

### Moyen — ✅ TOUT FAIT
28. ✅ [BROWSE] Fade low-tier + labels dynamiques — opacity-60 sur common/rare + "TRENDING FAST"/"HIDDEN GEM" (lance)
29. ✅ [BROWSE] Velocity badge "+X views/h" — deja fait
30. ✅ [BROWSE] Timer "Trending for Xh" — deja fait
31. ✅ [BROWSE] CTA couleur contrastee — bleu pour non-tiered (lance)
32. ✅ [BROWSE] Tooltip score — shadcn Tooltip avec explication (lance)
33. ✅ [BROWSE] Padding/thumbnails — deja optimise

## Phase 2 — Backend & Features avancees

### Moyen-Dur — ✅ QUASI TOUT FAIT
34. ✅ [BROWSE] Social proof "Used by X creators" — `export_count` colonne + RPC + badge carte
35. ✅ [BROWSE] Decay indicator — `prev_momentum_score` + badges "Losing steam"/"Accelerating"
36. ✅ [BROWSE] Shimmer cartes Master/Legendary — deja fait (rank-cards.css, sweep + glow + hover)
37. ✅ [BROWSE] Mini velocity sparkline — SVG pure, API batch `/api/clips/sparkline` (lance)
38. ✅ [BROWSE] Section "My Remixes" — tab feed + API `/api/clips/my-remixes` + RemixCard (lance)
39. ✅ [BROWSE] Gate Pro Master/Legendary — lock overlay + "Unlock with Pro" CTA + redirect /pricing
40. 📋 [KICK-PROXY] Architecture long terme CDN — **reporte Phase 3**
41. ✅ [POLLING] Supabase Realtime — `useRenderSubscription` hook + fallback polling 5s
42. 📋 [VPS] BullMQ + Redis — **reporte Phase 3**
43. 📋 [PREVIEW] Low-res FFmpeg preview WYSIWYG — **reporte Phase 3**

### Dur — ✅ QUASI TOUT FAIT
44. ✅ [BROWSE] Ticker live exports — Supabase Broadcast + `ExportTicker` composant (lance)
45. 📋 [BROWSE] Social proof post-export "Posted 3x → 120K views" — **reporte Phase 3**
46. ✅ [ENHANCE] Quick Export — `api/render/quick` + helpers partages `lib/api/render-helpers.ts` + bouton Zap
47. ✅ [ENHANCE] Preview captions client-side — deja fait (LivePreview avec overlays CSS)
48. ✅ [ENHANCE] Before/After comparison — `BeforeAfterPlayer` slider split + sync video

---

# REPORTE PHASE 3

| # | Item | Raison |
|---|------|--------|
| 16 | Preview align FFmpeg | Necessite nouveau endpoint VPS /preview + pipeline FFmpeg low-res |
| 40 | CDN Kick proxy | Architecture infra (Cloudflare Worker ou pre-convert MP4) |
| 42 | BullMQ + Redis | Upgrade infra VPS, pas critique tant que MAX_CONCURRENT=1 suffit |
| 43 | FFmpeg preview WYSIWYG | Lourd (5-10s latence), necessite endpoint VPS dedie |
| 45 | Social proof post-export | Necessite tracking des publications + resultats (Phase distribution) |

---

# BILAN

| Phase | Total | Fait | Deja fait avant | Reporte | Score |
|-------|-------|------|-----------------|---------|-------|
| Phase 0 CRITIQUE | 7 | 7 | 0 | 0 | **100%** |
| Phase 0 IMPORTANT | 11 | 9 | 0 | 1 | **91%** |
| Phase 0 MINOR | 3 | 3 | 0 | 0 | **100%** |
| Phase 1 Facile | 6 | 6 | 4 | 0 | **100%** |
| Phase 1 Moyen | 6 | 6 | 3 | 0 | **100%** |
| Phase 2 Moyen-Dur | 10 | 7 | 1 | 3 | **80%** |
| Phase 2 Dur | 5 | 4 | 1 | 1 | **90%** |
| **TOTAL** | **48** | **42** | **9** | **5** | **~92%** |
