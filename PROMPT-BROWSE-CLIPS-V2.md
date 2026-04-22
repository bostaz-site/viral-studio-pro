# PROMPT — Browse Clips V2 (Systeme de decouverte intelligent + Kick + Scoring avance)

Tu travailles sur Viral Animal, une webapp Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase. Le projet est deja fonctionnel. Lis le fichier CLAUDE.md pour le contexte complet du projet.

## CONTEXTE

Le systeme Browse Clips actuel fonctionne mais a des limites :
- Seulement 9 streamers Twitch IRL hardcodes
- Pas de support Kick
- Scoring reactif (detecte les clips APRES qu'ils explosent, pas avant)
- Pas de feeds intelligents (tout dans une seule liste)
- Pas de favoris/bookmarks
- Pagination limitee a 100 clips
- Pas de filtre par duree
- Preview video refetchee a chaque hover sans cache
- Pas d'admin panel pour gerer les streamers

On upgrade tout ca.

## IMPORTANT — DOCUMENTATION

A la fin, mets a jour le fichier `docs/browse-clips.md` avec TOUT le nouveau systeme :
- Nouveau scoring (5 facteurs)
- Les 3 feeds intelligents
- Integration Kick
- Tous les nouveaux streamers
- Systeme de favoris
- Admin streamers
- Anomaly detection
- Early signal detection
- Tables SQL
- API routes
- Composants
- Flow complet

Mets aussi a jour `docs/README.md` si necessaire.

---

## CE QUE TU DOIS CODER

### 1. NOUVEAUX STREAMERS — Liste complete

#### Twitch IRL (garder les existants + ajouter)
Existants a garder :
- kaicenat, ishowspeed, xqc, adinross, jynxzi, sketch, amouranth, hasanabi, marlon

Nouveaux a ajouter :
- stabletronaldo
- plaborttv (plaqueboymax)
- dukedennis
- faborttv (fanum)
- lacyfn (lacy)
- yourragegaming
- thefoufou
- iamtherealak
- zackttg
- jasontheween
- caseoh_
- dd_osama
- Agent00
- BruceDropEmOff

#### Kick IRL (nouveaux)
- neon (n3on)
- clavicular
- adin (adin ross stream aussi sur kick)
- braden
- samf (sam frank)
- fousey
- sneako
- johnnysomali
- suspendedceo
- vitaly

**IMPORTANT** : Tous ces streamers doivent etre inseres dans la table `streamers` via le fichier de migration SQL. Ajoute une colonne `kick_login` a la table `streamers` si elle n'existe pas deja. Chaque streamer a : display_name, twitch_login (ou NULL si kick only), kick_login (ou NULL si twitch only), niche='irl', priority (top streamers = 10, autres = 5), active=true.

### 2. INTEGRATION KICK

Kick n'a pas d'API officielle documentee, mais on peut utiliser leur API non-officielle.

#### `lib/kick/client.ts`
Cree un client Kick qui :
- Fetch les clips d'un channel : `GET https://kick.com/api/v2/channels/{username}/clips`
- Pas besoin d'auth pour les clips publics
- Extraire : title, thumbnail, view_count, duration, clip_url, created_at, channel_name
- Gerer les erreurs (rate limit, channel not found)
- Timeout de 10 secondes par requete

#### `lib/kick/fetch-kick-clips.ts`
Meme pattern que `lib/twitch/fetch-streamer-clips.ts` :
1. Charger les streamers actifs avec `kick_login` non-null
2. Pour chaque streamer, fetch les clips recents
3. Upsert dans `trending_clips` avec platform='kick'
4. Creer des snapshots dans `clip_snapshots`
5. Calculer les scores (meme formule que Twitch)

**Note** : Si l'API Kick ne repond pas ou change, le systeme doit gracefully fallback sans crasher. Wrap tout dans try/catch, log l'erreur, et continue avec les autres streamers.

### 3. NOUVEAU SCORING — 5 facteurs

#### Modifier `lib/twitch/fetch-streamer-clips.ts` et creer `lib/scoring/clip-scorer.ts`

Le scoring doit etre dans un fichier separe `lib/scoring/clip-scorer.ts` pour etre reutilise par Twitch ET Kick.

```typescript
interface ClipScoreInput {
    view_count: number
    like_count: number
    clip_age_hours: number           // heures depuis creation du clip
    clip_age_minutes: number         // minutes depuis creation (pour early detection)
    velocity: number                 // vues par heure (depuis snapshots)
    streamer_avg_views: number       // moyenne de vues des clips de ce streamer
    streamer_avg_velocity: number    // velocity moyenne de ce streamer
}

interface ClipScoreOutput {
    final_score: number              // 0-100
    velocity_score: number           // 0-100
    viral_ratio_score: number        // 0-100
    recency_score: number            // 0-100
    early_signal_score: number       // 0-100
    anomaly_score: number            // 0-100
    tier: 'mega_viral' | 'viral' | 'hot' | 'rising' | 'normal' | 'dead'
    feed_category: 'hot_now' | 'early_gem' | 'proven' | 'normal'
}
```

#### Les 5 facteurs :

**1. Velocity Score (35% du score final)**
Ce qu'on a deja mais ameliore :
```
velocity = delta_views / heures_ecoulees (depuis dernier snapshot)
velocity_score = 15 * log10(max(1, velocity)) + 10
Normalise a 0-100
```

**2. Viral Ratio (20% du score final)**
Croissance relative a la taille :
```
viral_ratio = velocity / (view_count + 1)
viral_ratio_score = min(100, viral_ratio * 10000)
```

**3. Recency Boost (15% du score final)**
Les clips frais sont priorises :
```
Si age < 2h : recency = 100
Si age 2-6h : recency = 80 - ((age - 2) / 4 * 30)   → 80 a 50
Si age 6-24h : recency = 50 - ((age - 6) / 18 * 30)  → 50 a 20
Si age 24-48h : recency = 20 - ((age - 24) / 24 * 20) → 20 a 0
Si age > 48h : recency = 0
```
Plus granulaire que l'ancien (qui etait lineaire 0-48h).

**4. Early Signal Score (15% du score final) — NOUVEAU**
Detecte les clips qui VONT exploser :
```
Si age < 120 minutes (2h) :
    views_per_minute = view_count / max(1, age_minutes)
    early_signal = min(100, views_per_minute * 50)
    
    // Boost si le ratio likes/vues est eleve (signal d'engagement fort)
    if like_count > 0 && view_count > 0:
        like_ratio = like_count / view_count
        if like_ratio > 0.10: early_signal *= 1.3   // >10% likes = fort
        if like_ratio > 0.15: early_signal *= 1.5   // >15% likes = tres fort
    
    early_signal = min(100, early_signal)
Sinon:
    early_signal = 0   // Pas pertinent pour les vieux clips
```
Ce score est SEULEMENT actif pour les clips de moins de 2 heures. C'est ce qui detecte les "early gems".

**5. Anomaly Score (15% du score final) — NOUVEAU**
Compare le clip aux performances moyennes de SON streamer :
```
if streamer_avg_views > 0:
    view_ratio = view_count / streamer_avg_views
    velocity_ratio = velocity / max(1, streamer_avg_velocity)
    
    // Un clip qui fait 3x la moyenne du streamer = anomalie forte
    anomaly = min(100, ((view_ratio - 1) * 30) + ((velocity_ratio - 1) * 40))
    anomaly = max(0, anomaly)  // Pas de score negatif
else:
    anomaly = 50  // Pas assez de data, score neutre
```

#### Score final :
```
final_score = velocity_score * 0.35
            + viral_ratio_score * 0.20
            + recency_score * 0.15
            + early_signal_score * 0.15
            + anomaly_score * 0.15

final_score = min(100, max(0, final_score))
```

#### Tiers :
```
score >= 90 → 'mega_viral'
score >= 75 → 'viral'
score >= 60 → 'hot'
score >= 40 → 'rising'
score >= 15 → 'normal'
score < 15  → 'dead'
```

#### Feed categories :
```
Si age < 2h ET early_signal_score >= 60 → 'early_gem'
Si velocity_score >= 70 ET age < 6h → 'hot_now'
Si score >= 60 ET age > 6h → 'proven'
Sinon → 'normal'
```

### 4. MOYENNES PAR STREAMER

Pour que l'anomaly detection fonctionne, il faut stocker les moyennes par streamer.

#### Ajouter des colonnes a la table `streamers` :
```sql
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS avg_clip_views FLOAT DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS avg_clip_velocity FLOAT DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS total_clips_tracked INTEGER DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS kick_login TEXT;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS fetch_interval_minutes INTEGER DEFAULT 15;
```

A chaque cron run, apres avoir fetch les clips d'un streamer, recalculer sa moyenne :
```
avg_clip_views = moyenne des view_count de ses 50 derniers clips
avg_clip_velocity = moyenne des velocity de ses 50 derniers clips
total_clips_tracked = nombre total de clips dans trending_clips pour ce streamer
```

Les top streamers (priority >= 10) ont un `fetch_interval_minutes` de 5-10.
Les autres ont 15-20.

### 5. CRON ADAPTATIF

#### Modifier `app/api/cron/fetch-twitch-clips/route.ts`

Au lieu de tout fetcher d'un coup :
1. Charger tous les streamers actifs
2. Pour chaque streamer, checker `last_fetched_at` vs `fetch_interval_minutes`
3. Ne fetcher QUE ceux dont l'interval est depasse
4. Apres fetch, mettre a jour `last_fetched_at`
5. Fetch les clips Twitch (existant) + Kick (nouveau) dans le meme cron

Le cron lui-meme peut tourner toutes les 5 minutes, mais chaque streamer n'est fetch que selon SON interval.

### 6. LES 3 FEEDS INTELLIGENTS

#### Modifier le dashboard `app/(dashboard)/dashboard/page.tsx`

Remplacer les quick filter tabs actuels (All, Trending Now, High Potential, Recent) par :

**Nouveaux tabs :**
1. **All** — Tous les clips, trie par score final DESC
2. **Hot Right Now** 🔥 — Clips en train d'exploser MAINTENANT (feed_category = 'hot_now'). Clips recents (< 6h) avec velocity elevee. Badge flamme animee.
3. **Early Gems** 💎 — Clips recents (< 2h) avec fort potentiel mais peu de vues encore (feed_category = 'early_gem'). C'est le feed le plus valuable — l'user trouve les clips AVANT qu'ils explosent. Badge diamant.
4. **Proven Viral** ✅ — Clips qui ont deja fait leurs preuves (feed_category = 'proven'). Safe a reposter, deja valide par l'algo. Badge checkmark.
5. **Recent** — Trie par date, les plus recents en premier

Chaque feed doit afficher le nombre de clips entre parentheses.

### 7. SYSTEME DE FAVORIS

#### Nouvelle table SQL :
```sql
CREATE TABLE IF NOT EXISTS public.saved_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    clip_id UUID REFERENCES public.trending_clips(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, clip_id)
);
```

RLS : users can manage their own saved clips.

#### UI :
- Bouton bookmark (icone Bookmark de lucide-react) sur chaque `TrendingCard` (coin bas-gauche ou en hover)
- Clic = toggle save/unsave
- Bookmark rempli si sauvegarde, outline si non
- Nouveau tab "Saved" (icone Bookmark) dans les filters ou un bouton separe en haut
- Page/section qui montre tous les clips sauvegardes avec la date de sauvegarde
- L'user peut ajouter une note courte a un clip sauvegarde (optionnel, via le detail modal)

#### API :
- `app/api/clips/saved/route.ts` — GET (list saved), POST (save clip)
- `app/api/clips/saved/[id]/route.ts` — DELETE (unsave)

#### Store :
Ajouter dans `stores/trending-store.ts` :
```typescript
savedClipIds: Set<string>
savedClips: SavedClip[]
fetchSavedClips: () => Promise<void>
toggleSaveClip: (clipId: string) => Promise<void>
```

### 8. FILTRE PAR DUREE

Ajouter dans `TrendingFilters` :

Pilules de duree :
- **Short** (< 30s) — ideal TikTok
- **Medium** (30-60s) — YouTube Shorts
- **Long** (60s+) — YouTube / compilations

Le champ `duration_seconds` existe deja dans `trending_clips`, il faut juste l'utiliser dans le filtre cote client ET cote API.

Ajouter `duration` dans les filtres du store :
```typescript
interface TrendingFiltersState {
    search: string
    games: string[]
    platforms: string[]          // ajouter 'kick' en plus de 'twitch'
    sort: 'velocity' | 'date'
    duration: 'all' | 'short' | 'medium' | 'long'   // NOUVEAU
    feed: 'all' | 'hot_now' | 'early_gem' | 'proven' | 'recent' | 'saved'  // NOUVEAU
}
```

### 9. AFFICHER LES DONNEES CACHEES

#### Sur `TrendingCard` :
- Afficher la duree du clip en bas (ex: "0:24" ou "1:02")
- Afficher le vrai `clip_created_at` au lieu de `scraped_at` (quand le clip a ete cree, pas quand on l'a trouve)
- Badge de tier visible : mega_viral = badge dore anime, viral = badge rouge, hot = badge orange, rising = badge vert
- Badge de feed category : 💎 pour early gem, 🔥 pour hot now (petit badge en plus du velocity badge)
- Badge de plateforme : icone Twitch (violet) ou Kick (vert) en haut a gauche

#### Sur `TrendingDetailModal` :
- Afficher TOUS les scores individuels (velocity, viral ratio, recency, early signal, anomaly) en plus du score final
- Montrer la moyenne du streamer vs ce clip (ex: "This clip has 3.2x more views than average for this streamer")
- Afficher la duree
- Afficher le feed category avec explication

### 10. PAGINATION INFINIE

#### Modifier le store et l'API :
- L'API `/api/trending` supporte deja `limit` et `offset`
- Dans le store, ajouter :
  - `hasMore: boolean`
  - `loadingMore: boolean`
  - `loadMore: () => Promise<void>` — fetch le prochain batch (50 clips) et append aux clips existants
- Dans la page dashboard, ajouter un bouton "Load more" en bas de la grille (ou intersection observer pour infinite scroll)
- Le bouton affiche combien de clips restent : "Load more (156 remaining)"

### 11. CACHE DES PREVIEWS VIDEO

#### Modifier `app/api/clips/video-url/route.ts` (ou creer si n'existe pas) :
- Quand on fetch l'URL MP4 d'un clip Twitch/Kick, stocker l'URL dans un cache en memoire (Map) avec un TTL de 24h
- Si l'URL est en cache et pas expiree, retourner directement sans appeler Twitch/Kick
- Cle du cache : clip_id, valeur : { url, expires_at }
- Fallback : si le cache miss, fetch normalement

### 12. ADMIN PANEL STREAMERS

#### `app/(dashboard)/admin/streamers/page.tsx`
Page admin (protegee par `isAdminEmail`) pour gerer les streamers :

- Table de tous les streamers avec : nom, plateforme (Twitch/Kick/Both), niche, priority, status (active/inactive), dernier fetch, nombre de clips, moyenne de vues
- Bouton "Add Streamer" — dialog avec champs : display_name, twitch_login, kick_login, niche, priority
- Actions par streamer : editer, activer/desactiver, supprimer, "Fetch Now" (trigger un fetch immediat)
- Stats en haut : total streamers, actifs, total clips, derniere mise a jour

#### API :
- `app/api/admin/streamers/route.ts` — GET (list), POST (create)
- `app/api/admin/streamers/[id]/route.ts` — PATCH (update), DELETE
- `app/api/admin/streamers/[id]/fetch/route.ts` — POST (trigger fetch immediat)

Ajouter le lien "Streamers" dans la sidebar admin (dans `app/(dashboard)/layout.tsx`).

---

## FICHIERS A CREER

```
supabase/migrations/20260421_browse_clips_v2.sql    -- Migration: saved_clips + alter streamers + alter trending_clips
lib/kick/client.ts                                    -- Client API Kick
lib/kick/fetch-kick-clips.ts                         -- Fetch + score clips Kick
lib/scoring/clip-scorer.ts                           -- Scoring unifie (5 facteurs)
app/api/clips/saved/route.ts                         -- API favoris (GET + POST)
app/api/clips/saved/[id]/route.ts                    -- API unsave (DELETE)
app/api/admin/streamers/route.ts                     -- API admin streamers (GET + POST)
app/api/admin/streamers/[id]/route.ts                -- API admin streamer (PATCH + DELETE)
app/api/admin/streamers/[id]/fetch/route.ts          -- API trigger fetch
app/(dashboard)/admin/streamers/page.tsx              -- Page admin streamers
```

## FICHIERS A MODIFIER

```
lib/twitch/fetch-streamer-clips.ts                   -- Utiliser le nouveau scorer, calculer moyennes streamer
app/api/cron/fetch-twitch-clips/route.ts             -- Cron adaptatif + Kick + moyennes
app/api/trending/route.ts                            -- Supporter filtres: duration, feed, platform 'kick'
app/(dashboard)/dashboard/page.tsx                    -- Nouveaux feeds (Hot Now, Early Gems, Proven), pagination
components/trending/trending-card.tsx                 -- Duree, badges tier/feed, bookmark, plateforme Kick
components/trending/trending-filters.tsx              -- Filtre duree, plateforme Kick, feed selector
components/trending/trending-detail-modal.tsx         -- Scores detailles, anomaly, duree
components/trending/trending-stats.tsx                -- Stats Kick, feeds counts
stores/trending-store.ts                             -- Favoris, feeds, pagination, filtres
app/(dashboard)/layout.tsx                           -- Lien admin Streamers dans sidebar
docs/browse-clips.md                                 -- Documentation complete mise a jour
docs/README.md                                       -- Ajouter lien si necessaire
```

---

## MIGRATION SQL

Le fichier `supabase/migrations/20260421_browse_clips_v2.sql` doit contenir :

```sql
-- 1. Ajouter colonnes a streamers
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS avg_clip_views FLOAT DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS avg_clip_velocity FLOAT DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS total_clips_tracked INTEGER DEFAULT 0;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS kick_login TEXT;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ;
ALTER TABLE public.streamers ADD COLUMN IF NOT EXISTS fetch_interval_minutes INTEGER DEFAULT 15;

-- 2. Ajouter colonnes de scoring a trending_clips
ALTER TABLE public.trending_clips ADD COLUMN IF NOT EXISTS early_signal_score FLOAT;
ALTER TABLE public.trending_clips ADD COLUMN IF NOT EXISTS anomaly_score FLOAT;
ALTER TABLE public.trending_clips ADD COLUMN IF NOT EXISTS feed_category TEXT DEFAULT 'normal';

-- 3. Table saved_clips
CREATE TABLE IF NOT EXISTS public.saved_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    clip_id UUID REFERENCES public.trending_clips(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, clip_id)
);

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_saved_clips_user_id ON public.saved_clips(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_clips_clip_id ON public.saved_clips(clip_id);
CREATE INDEX IF NOT EXISTS idx_trending_feed_category ON public.trending_clips(feed_category);
CREATE INDEX IF NOT EXISTS idx_trending_early_signal ON public.trending_clips(early_signal_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_streamers_kick_login ON public.streamers(kick_login);

-- 5. RLS saved_clips
ALTER TABLE public.saved_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own saved clips"
    ON public.saved_clips FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. Inserer les nouveaux streamers Twitch
INSERT INTO public.streamers (display_name, twitch_login, niche, priority, active, fetch_interval_minutes) VALUES
    ('StableTronaldo', 'stabletronaldo', 'irl', 5, true, 15),
    ('PlaqueBoyMax', 'plaborttv', 'irl', 5, true, 15),
    ('Duke Dennis', 'dukedennis', 'irl', 5, true, 15),
    ('Fanum', 'faborttv', 'irl', 5, true, 15),
    ('Lacy', 'lacyfn', 'irl', 5, true, 15),
    ('YourRAGE', 'yourragegaming', 'irl', 5, true, 15),
    ('TheFouFou', 'thefoufou', 'irl', 5, true, 15),
    ('iamtherealak', 'iamtherealak', 'irl', 5, true, 15),
    ('ZackTTG', 'zackttg', 'irl', 5, true, 15),
    ('JasonTheWeen', 'jasontheween', 'irl', 5, true, 15),
    ('CaseOh', 'caseoh_', 'irl', 5, true, 15),
    ('DD Osama', 'dd_osama', 'irl', 5, true, 15),
    ('Agent00', 'agent00', 'irl', 5, true, 15),
    ('BruceDropEmOff', 'brucedropemoff', 'irl', 5, true, 15)
ON CONFLICT (twitch_login) DO NOTHING;

-- 7. Mettre a jour les streamers existants avec priority haute et interval rapide
UPDATE public.streamers SET priority = 10, fetch_interval_minutes = 8
WHERE twitch_login IN ('kaicenat', 'ishowspeed', 'xqc', 'adinross', 'jynxzi', 'sketch');

-- 8. Inserer les streamers Kick
INSERT INTO public.streamers (display_name, kick_login, niche, priority, active, fetch_interval_minutes) VALUES
    ('N3on', 'neon', 'irl', 8, true, 10),
    ('Clavicular', 'clavicular', 'irl', 5, true, 15),
    ('Adin Ross Kick', 'adin', 'irl', 8, true, 10),
    ('Braden', 'braden', 'irl', 5, true, 15),
    ('Sam Frank', 'samf', 'irl', 5, true, 15),
    ('Fousey', 'fousey', 'irl', 5, true, 15),
    ('Sneako', 'sneako', 'irl', 5, true, 15),
    ('Johnny Somali', 'johnnysomali', 'irl', 5, true, 15),
    ('SuspendedCEO', 'suspendedceo', 'irl', 5, true, 15),
    ('Vitaly', 'vitaly', 'irl', 5, true, 15)
ON CONFLICT DO NOTHING;
```

**Note pour les INSERT Kick** : la table `streamers` a une contrainte UNIQUE sur `twitch_login` mais pas sur `kick_login`. Il faudra peut-etre adapter le ON CONFLICT. Verifie la contrainte existante et adapte.

---

## REGLES DE CODE

- TypeScript strict, pas de `any`
- Noms de fichiers en kebab-case
- Composants React en PascalCase
- Dark mode uniquement
- Design moderne et clean, coherent avec le reste du site (cards avec bordures, gradients subtils)
- Utilise les composants UI existants dans `components/ui/`
- Zustand pour le state management
- Valider les inputs avec Zod dans les API routes
- Verifier l'authentification avec `withAuth` pour les routes user, `withAdmin`/`isAdminEmail` pour les routes admin
- Supabase admin client avec `createAdminClient()` pour les operations cron/admin
- Loading states et skeletons partout
- Gerer les erreurs avec try/catch
- Le systeme Kick doit etre resilient — si l'API Kick fail, on continue avec Twitch normalement
- Les feeds intelligents doivent fonctionner MEME avec peu de clips (fallback graceful si un feed est vide)
- Fais `npx tsc --noEmit` a la fin pour verifier 0 erreurs TypeScript

## CE QUI EXISTE DEJA (NE PAS CASSER)

- `lib/twitch/client.ts` — Client Twitch API (tokens, fetch)
- `lib/twitch/fetch-streamer-clips.ts` — Pipeline de fetch + scoring (A MODIFIER mais pas casser)
- `lib/twitch/fetch-clips.ts` — Ancien fetch par game (peut etre ignore/deprecie)
- `stores/trending-store.ts` — Store Zustand (A MODIFIER pour ajouter feeds, favoris, pagination)
- `components/trending/trending-card.tsx` — Card clip (A MODIFIER pour badges, bookmark, duree)
- `components/trending/trending-filters.tsx` — Filtres (A MODIFIER pour duree, kick, feeds)
- `components/trending/trending-detail-modal.tsx` — Modal detail (A MODIFIER pour scores)
- `components/trending/trending-stats.tsx` — Stats bar (A MODIFIER pour Kick)
- `components/trending/velocity-badge.tsx` — Badge velocity (garder tel quel)
- `app/(dashboard)/dashboard/page.tsx` — Page browse (A MODIFIER pour feeds)
- `app/api/trending/route.ts` — API trending (A MODIFIER pour filtres)
- `app/api/cron/fetch-twitch-clips/route.ts` — Cron (A MODIFIER pour Kick + adaptatif)
- Table `trending_clips` — Existante (on ajoute des colonnes)
- Table `streamers` — Existante (on ajoute des colonnes)
- Table `clip_snapshots` — Existante (pas de changement)
