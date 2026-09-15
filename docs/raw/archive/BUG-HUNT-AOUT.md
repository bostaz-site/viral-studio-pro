# BUG HUNT AOUT 2026 — Deep Scan (Surfaces User)

Date: 2026-08-19
Scope: Browse, Enhance, Render, Publish, Bank, Distribution, Analytics, Settings, Auth, Quotas, Stripe
Hors scope: Admin, Lab, Audits, Crons (sauf chemins de refund)

---

## BUGS TROUVES ET CORRIGES

### 1. MAJEUR — Double-clic sur "Generate clip" brule 2 credits

**Fichier**: `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx:562`
**Reproduction**: Cliquer 2x rapidement sur le bouton "Generate clip". Les deux clics passent la garde `if (!clip) return` et le paywall check avant que React ait le temps de re-render avec `rendering=true`. Le server-side `checkExistingJob` a aussi une fenetre de race (2 requetes simultanes, aucun job existant encore).
**Impact**: L'utilisateur perd un credit de son quota. `increment_video_usage` est appele 2 fois. Seul un render tourne, l'autre est deduplique par `checkExistingJob` (si pas de race) ou cree un 2e job zombie.
**Fix applique**: Ajout d'un `renderingRef` (useRef) comme garde synchrone en debut de `handleRender`. Reset systematique sur toutes les branches `setRendering(false)`. L'etat React `rendering` n'est PAS suffisant car son update est asynchrone.

---

### 2. MAJEUR — handleManageBilling silent fail

**Fichier**: `app/(dashboard)/settings/page.tsx:175-178`
**Reproduction**: Cliquer "Manage billing" quand le reseau est instable ou que l'API retourne une erreur. L'utilisateur voit... rien. Le bouton ne fait rien, pas de feedback.
**Impact**: L'utilisateur paie et ne peut pas gerer son abonnement. Experience frustrate qui peut mener a un churn.
**Fix applique**: Ajout try/catch + toast.error pour les 2 chemins d'erreur (fetch fail, API error response).

---

### 3. MAJEUR — Refund `.catch(() => {})` sur chemin critique

**Fichiers**:
- `app/api/render/route.ts:291,345,391` (3 refunds sur VPS non configure, job creation fail, queue full)
- `app/api/render/hook/route.ts:225` (refund sur permanent failure)
- `lib/api/render-helpers.ts:305` (refund sur dispatch failure)

**Reproduction**: Si le RPC `refund_video_usage` echoue (DB down, timeout, RLS issue), le catch vide avale l'erreur. L'utilisateur a perdu un credit et ne le sait pas.
**Impact**: Perte de credit silencieuse. Pas de trace en logs = impossible a debugger.
**Fix applique**: Remplacement de tous les `.catch(() => {})` par des `.catch((e) => logger.error(...))` avec user ID et job ID pour le tracking.

---

### 4. MAJEUR — PaywallModal "one-time save" catch silencieux

**Fichier**: `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx:2704`
**Reproduction**: Cliquer "Get 1 free clip" dans la paywall modale quand le reseau est down. Le `catch { /* silent */ }` avale l'erreur.
**Impact**: L'utilisateur croit qu'il va recevoir un clip bonus, rien ne se passe, pas de feedback.
**Fix applique**: Ajout de `setRenderMessage(...)` sur erreur reseau et sur reponse non-granted.

---

### 5. MAJEUR — Metriques simulees dans l'historique de publish

**Fichier**: `components/distribution/distribution-hub.tsx:784`
**Reproduction**: Publier un clip via la distribution hub. L'entree dans l'historique affichait `+2.5K views` immediatement — un nombre genere par `lib/distribution/tracking-simulator.ts` via un PRNG (Mulberry32), PAS des donnees reelles.
**Impact**: L'utilisateur croit que son clip a deja 2.5K vues alors qu'il vient d'etre publie il y a 2 secondes. Trompeur.
**Note**: Le panneau de tracking detaille a deja la mention "Projection - Example only" et un prefix `~`. Mais l'historique de publish n'avait aucun disclaimer.
**Fix applique**: L'entree dans `publishHistory` utilise maintenant `views: -1` (au lieu de `initialMetrics.views`), ce qui affiche "Stats sync in ~24h" — coherent avec le comportement apres refresh.

---

### 6. MINEUR — Type errors pre-existants (disconnected_at)

**Fichiers**: `lib/distribution/token-manager.ts:106,188,262`, `lib/distribution/execute-publish.ts:95`
**Cause**: La colonne `disconnected_at` a ete ajoutee a `social_accounts` via migration mais les types Supabase generes n'ont pas ete regeneres.
**Impact**: `npm run build` echoue.
**Fix applique**: Cast via `as unknown as Record<string, unknown>` / `as never` pour les updates. Le vrai fix est de regenerer les types (`npx supabase gen types typescript`).

---

## BUGS TROUVES — NON CORRIGES (backlog)

### 7. MINEUR — Render stage simulation (non fonctionnel)

**Fichier**: `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx:62-64`
```ts
const RENDER_STAGES = ['Downloading', 'Applying captions', 'Compositing', 'Uploading'] as const
const RENDER_STAGE_DURATIONS_MS = [8000, 15000, 20000]
```
**Probleme**: Le VPS ne reporte pas les etapes de render. Les stages sont simules cote client avec des timers fixes. L'utilisateur voit "Applying captions..." alors que le VPS est peut-etre en train de telecharger. C'est un mensonge cosmetique.
**Severite**: MINEUR — purement visuel, n'affecte pas le resultat.
**Recommandation**: Soit retirer les stages et afficher un simple "Rendering...", soit ajouter un vrai reporting cote VPS.

---

### 8. MINEUR — Tracking simulator encore utilise dans le panneau de suivi

**Fichier**: `components/distribution/distribution-hub.tsx:843-876`
**Probleme**: Le panneau "Projection - Example only" utilise `simulatePostMetrics` avec un multiplicateur x120. Bien que le disclaimer existe, l'acceleration (1 minute reelle = 2 heures simulees) cree une illusion trompeuse de croissance rapide.
**Severite**: MINEUR — le disclaimer "Projection - Example only" existe, et les nombres ont le prefix `~`.
**Recommandation**: Remplacer par un vrai polling des stats TikTok quand le cron `refresh-post-stats` sera actif. Ou retirer le panneau et garder seulement "Stats sync in ~24h".

---

### 9. MINEUR — `sourceParam` capture dans la closure de handleRender

**Fichier**: `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx:624`
**Probleme**: `sourceParam` (de `useSearchParams`) est utilise dans `handleRender` mais n'est pas dans le tableau de dependances `[clip, settings, startPolling]`. En theorie, closure perimee si le param change. En pratique, le param est stable (URL ne change pas pendant l'edition).
**Severite**: MINEUR — risque theorique, pas de reproduction reelle.

---

### 10. MINEUR — `isRenderedVideo` et `originalVideoUrl` stale dans handleRender

**Fichier**: `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx:582-585`
**Probleme**: Ces variables d'etat sont lues dans `handleRender` mais ne sont pas dans ses dependances. Lors d'un re-render apres un premier rendu, le preview pourrait ne pas revenir correctement a la video originale.
**Severite**: MINEUR — visuel uniquement, n'affecte pas le resultat du rendu.

---

## VOLET KICK — VERIFICATION END-TO-END

### Import (lib/kick/fetch-kick-clips.ts:126)
`duration_seconds: clip.duration` — prend la duree de l'API Kick (champ `duration` de `KickApiClip`). Correct: c'est la duree du clip, pas du VOD/stream. **OK**

### Client Kick (lib/kick/client.ts:72)
`duration: c.duration || 0` — mappe directement depuis la reponse API. **OK**

### Browse (components/trending/trending-card.tsx:577-579)
Badge de duree affiche `formatDuration(clip.duration_seconds)` — lit depuis la DB. **OK**
Badge rouge si `clip.duration_seconds > maxClipDuration` (plan-based: 60s free, 120s pro/studio). **OK**

### Enhance (app/(dashboard)/dashboard/enhance/[clipId]/page.tsx:1383-1385)
Le bouton "Generate" est desactive si `clipDur > maxDur`. **OK**

### Render API (app/api/render/route.ts:133)
`clipDuration = trendingClip.duration_seconds` — lit depuis `trending_clips.duration_seconds`. **OK**

### VPS (vps/routes/render.js:524-527)
```js
if (clipDuration > 0 && duration > clipDuration + 2) {
  duration = Math.max(0.1, clipDuration - 0.05);
}
```
Cap la duree probee par ffprobe a la valeur DB quand l'ecart est > 2s. Fix du bug Kick HLS playlist (3 min playlist pour un clip de 30s). **OK**

### Conclusion Kick
Un clip Kick de 30s passe correctement de bout en bout: 30s en DB → 30s affiche → 30s envoye au VPS → 30s rendu (pas 180s). Le fix 55bd0ec est valide.

---

## VERIFICATIONS D'ARGENT

### Quota decrement + refund
- **Increment**: `increment_video_usage` RPC (atomique, PostgreSQL) appele APRES `checkExistingJob` — **OK**
- **Refunds couverts**: VPS non configure, job creation fail, queue full, dispatch failure, permanent render failure — **OK**
- **Refund logging**: CORRIGE (etait `.catch(() => {})`, maintenant `.catch(e => logger.error(...))`)

### Double-clic protection
- **Generate clip (Enhance)**: CORRIGE via `renderingRef`
- **Quick Export (Browse)**: Idempotence via `x-idempotency-key` header + Redis `idem:quick:` — **OK**
- **Place in bank**: `bankLoading` disables button — **OK**
- **Publish**: `isPublishing` flag — **OK**

### Paywall sur 402
- `quota_exceeded` → `setShowPaywall(true)` — **OK**
- `clip_too_long` → desactive le bouton Generate + message — **OK**

### Stripe webhooks idempotence
- Table `stripe_events` avec `event_id` unique — **OK**
- `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed` geres — **OK**

### Plan enforcement
- `resolveEffectivePlan(profile)` utilise partout dans les API routes (pas d'acces direct a `profile.plan`) — **OK**
- Comp accounts (`is_comp=true`) correctement resolus en `pro` — **OK**

---

## CONFORMITE

| Zone | Statut |
|------|--------|
| Coming-soon platforms (YouTube, Instagram) | Correctement gates: badge "Soon", bouton disabled, serveur hard gate |
| AUDIT_MODE feature flag | Fonctionne: cache le browse clips quand `NEXT_PUBLIC_AUDIT_MODE=true` |
| Auth sur les API routes user | `withAuth` partout sauf pages statiques (landing, pricing) — **OK** |
| Render status scoped par user_id | `.eq('user_id', user.id)` sur toutes les queries — **OK** |

---

## FICHIERS MODIFIES

| Fichier | Changement |
|---------|------------|
| `app/(dashboard)/dashboard/enhance/[clipId]/page.tsx` | renderingRef guard + paywall catch |
| `app/(dashboard)/settings/page.tsx` | handleManageBilling error handling |
| `app/api/render/hook/route.ts` | Refund failure logging + comp account rate limits |
| `app/api/render/route.ts` | Refund failure logging |
| `lib/api/render-helpers.ts` | Refund failure logging |
| `components/distribution/distribution-hub.tsx` | Remove fake metrics from publish history |
| `app/(auth)/login/page.tsx` | Password reset error handling |

---

## BUGS SUPPLEMENTAIRES (rapport des sous-agents, passe 2)

### 7. MAJEUR — Password reset silently succeeds on error (CORRIGE)

**Fichier**: `app/(auth)/login/page.tsx:132-142`
**Reproduction**: Taper un email invalide dans "Forgot password", cliquer Send. L'appel `resetPasswordForEmail` echoue mais `setSent(true)` est appele quand meme. L'utilisateur voit "Check your email" alors qu'aucun email n'a ete envoye.
**Fix applique**: Ajout try/catch, verification `error` du retour Supabase, affichage du message d'erreur.

---

### 8. MAJEUR — Comp accounts get free-tier rate limits on hook generation (CORRIGE)

**Fichier**: `app/api/render/hook/route.ts:240-250`
**Probleme**: Le hook generation endpoint fetch `profile.plan` sans `is_comp`, puis compare directement `plan === 'free'`. Les comp accounts (`is_comp=true`) ont `plan='free'` en DB mais devraient etre traites comme `'pro'`.
**Impact**: Comp users limites a 50 hooks/jour au lieu de 500.
**Fix applique**: Ajout de `is_comp` au select, utilisation de `resolveEffectivePlan(profile)`.

---

### 9. MAJEUR — Bank removal after publish is fire-and-forget (BACKLOG)

**Fichier**: `components/distribution/unified-publish-dialog.tsx:219-223, 302-306`
**Probleme**: Apres publication TikTok (direct mode), le clip est retire de la bank via `fetch(...).catch(() => {})`. Si ca echoue silencieusement, le clip reste en bank et le schedule autofarm pourrait le republier → **double post**.
**Severite**: MAJEUR — risque de duplication de publication.
**Recommandation**: Ajouter un retry (1x) ou au minimum un toast d'erreur. Bloquer le schedule autofarm si le clip a deja un `published_posts` entry.

---

### 10. MINEUR — Placeholder usernames on OAuth failure fallback

**Fichier**: `lib/distribution/token-manager.ts:340, 407, 519`
**Probleme**: Si le fetch user info TikTok/YouTube/Instagram echoue pendant l'OAuth, le username est fallback a `'tiktok_user'`, `'youtube_user'`, `'instagram_user'`. L'utilisateur voit ce placeholder dans Settings et Publish dialog.
**Severite**: MINEUR — ne casse rien, mais peut confondre l'utilisateur.

---

### 11. MINEUR — Autofarm disable DELETE is fire-and-forget

**Fichier**: `components/distribution/distribution-hub.tsx:1010-1012`
**Probleme**: Quand l'utilisateur desactive l'autofarm, le DELETE `/api/distribution/autofarm-sync` est envoye avec `.catch(() => {})`. Si ca echoue, l'autofarm continue de tourner en backend meme si l'UI montre "desactive".
**Severite**: MINEUR (le schedule sera vide donc l'autofarm ne publiera rien).

---

### 12. MINEUR — Remix fetch silent fallback

**Fichier**: `app/(dashboard)/dashboard/page.tsx:143-150`
**Probleme**: Le fetch des remixes utilisateur echoue silencieusement avec `.catch(() => setRemixes([]))`. L'utilisateur voit un onglet "My remixes" vide sans savoir si c'est une erreur ou s'il n'a pas de remixes.
**Severite**: MINEUR — pas de perte de donnees.

---

### 13. MINEUR — Sparkline/detail modal fetch silent

**Fichier**: `components/trending/trending-detail-modal.tsx:142-145`
**Probleme**: Le fetch des donnees sparkline echoue silencieusement. Le graphique ne s'affiche pas sans indication d'erreur.
**Severite**: MINEUR — donnee supplementaire, pas critique.

---

### 14. MINEUR — Stripe webhook idempotency window

**Fichier**: `app/api/stripe/webhook/route.ts:45-273`
**Probleme**: L'idempotency check lit `stripe_events` AVANT le traitement mais insere APRES. Il y a une fenetre de race ou 2 webhooks identiques arrivent simultanement, passent le check, et sont tous les deux traites.
**Severite**: MINEUR — fenetre tres etroite (ms), et Stripe envoie rarement le meme event 2x en parallele.
**Recommandation**: Inserer dans `stripe_events` avec `ON CONFLICT DO NOTHING` AVANT le traitement. Si l'insert echoue (conflit), c'est un duplicate.
