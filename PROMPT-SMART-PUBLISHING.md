# PROMPT — Smart Publishing System (Systeme de publication intelligent adaptatif)

Tu travailles sur Viral Animal, une webapp Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase. Le projet est deja fonctionnel. Lis le fichier CLAUDE.md pour le contexte complet du projet.

## CONTEXTE

Le systeme de distribution actuel fonctionne mais est **statique** — il applique des presets fixes par niche (gaming, fps, moba, irl). On veut le transformer en systeme **adaptatif intelligent** qui prend des decisions en temps reel basees sur la performance des clips publies.

## IMPORTANT — DOCUMENTATION

A la fin, cree/mets a jour le fichier `docs/smart-publishing.md` qui documente TOUT ce systeme :
- Chaque phase (test, optimisation, scaling)
- Les regles de decision
- Les seuils et parametres
- Les tables SQL
- Les API routes
- Les composants
- Le flow complet
- Notes techniques

Mets aussi a jour `docs/README.md` pour ajouter le lien vers ce nouveau doc.

---

## CE QUE TU DOIS CODER

### 1. NOUVELLE TABLE SQL — Performance tracking

```sql
-- Tracking de performance par publication
CREATE TABLE IF NOT EXISTS public.publication_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    scheduled_publication_id UUID REFERENCES public.scheduled_publications(id) ON DELETE SET NULL,
    clip_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    
    -- Metriques collectees
    views_1h INTEGER DEFAULT 0,          -- vues apres 1 heure
    views_2h INTEGER DEFAULT 0,          -- vues apres 2 heures
    views_6h INTEGER DEFAULT 0,          -- vues apres 6 heures
    views_24h INTEGER DEFAULT 0,         -- vues apres 24 heures
    views_48h INTEGER DEFAULT 0,         -- vues apres 48 heures
    views_total INTEGER DEFAULT 0,       -- vues totales (derniere maj)
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    watch_time_avg FLOAT,                -- secondes moyennes de visionnage
    retention_rate FLOAT,                -- % de retention
    
    -- Metadata
    posted_at TIMESTAMPTZ NOT NULL,
    day_of_week INTEGER,                 -- 0=dimanche, 6=samedi
    hour_of_day INTEGER,                 -- 0-23
    niche TEXT,
    has_captions BOOLEAN DEFAULT FALSE,
    has_split_screen BOOLEAN DEFAULT FALSE,
    clip_duration_seconds FLOAT,
    
    -- Performance calculee
    performance_score FLOAT,             -- score 0-100 calcule
    is_viral BOOLEAN DEFAULT FALSE,      -- flagge si ca explose
    velocity FLOAT,                      -- vues/heure dans les premieres heures
    
    -- Statut
    last_checked_at TIMESTAMPTZ,
    check_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compte intelligence (apprentissage par compte)
CREATE TABLE IF NOT EXISTS public.account_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    platform TEXT NOT NULL,
    
    -- Phase du compte
    phase TEXT DEFAULT 'testing' CHECK (phase IN ('testing', 'optimizing', 'scaling')),
    total_posts INTEGER DEFAULT 0,
    
    -- Meilleurs creneaux decouverts
    best_hours JSONB DEFAULT '[]',              -- ex: [{"hour": 21, "day": 2, "avg_score": 78}]
    worst_hours JSONB DEFAULT '[]',
    
    -- Frequence optimale decouverte
    optimal_posts_per_day FLOAT,
    optimal_min_hours_between FLOAT,
    
    -- Patterns detectes
    best_clip_duration_range JSONB,              -- ex: {"min": 15, "max": 30}
    captions_boost_percent FLOAT,                -- ex: +35% avec captions
    split_screen_boost_percent FLOAT,            -- ex: +20% avec split-screen
    
    -- Etat actuel
    last_post_performance TEXT,                   -- 'hot', 'warm', 'cold', 'dead'
    last_post_at TIMESTAMPTZ,
    consecutive_flops INTEGER DEFAULT 0,
    consecutive_hits INTEGER DEFAULT 0,
    current_momentum TEXT DEFAULT 'neutral',      -- 'rising', 'neutral', 'declining'
    
    -- Seuils adaptes
    hot_threshold FLOAT DEFAULT 75,               -- score au-dessus = hot
    viral_threshold FLOAT DEFAULT 90,             -- score au-dessus = viral
    flop_threshold FLOAT DEFAULT 25,              -- score en-dessous = flop
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Cree le fichier migration `supabase/migrations/20260421_smart_publishing.sql`.
N'oublie pas les indexes (user_id, platform, posted_at, day_of_week, hour_of_day) et les RLS policies (users can manage their own data).

### 2. LOGIQUE INTELLIGENTE — Le cerveau du systeme

Cree `lib/distribution/smart-publisher.ts` — le fichier principal qui contient TOUTE la logique de decision.

#### Phase Detection
```typescript
// Determine la phase du compte automatiquement
function detectPhase(totalPosts: number): 'testing' | 'optimizing' | 'scaling' {
    if (totalPosts < 15) return 'testing'      // Pas assez de data
    if (totalPosts < 50) return 'optimizing'   // On a des patterns
    return 'scaling'                            // On scale intelligemment
}
```

#### Regles par phase

**Phase Testing (0-15 posts) — Explorer**
- Poster 2-4 fois par jour
- Varier les horaires systematiquement : matin (10h-12h), apres-midi (15h-17h), soir (19h-23h)
- Tester chaque slot au moins 2-3 fois pour avoir de la data
- Espacement minimum de 3h (deja en place)
- Objectif : decouvrir QUAND ton audience reagit le plus

**Phase Optimizing (15-50 posts) — Affiner**
- Analyser les resultats : calculer le score moyen par creneau horaire
- Garder les 2 meilleurs slots, dropper les autres
- Reduire la frequence a 2 posts/jour
- Commencer a detecter les patterns :
  - Quel jour de la semaine performe le mieux ?
  - Quelle duree de clip performe le mieux ?
  - Captions vs no captions — quel impact ?
  - Split-screen vs no split-screen — quel impact ?
- Ajuster les seuils hot/flop selon les donnees du compte

**Phase Scaling (50+ posts) — Maximiser**
- Regles de momentum :
  - Si la derniere video est HOT (score > hot_threshold) :
    - NE PAS reposter immediatement
    - Attendre 6-12h pour laisser l'algo pousser la video
    - La prochaine video beneficie du momentum
  - Si la derniere video est un FLOP (score < flop_threshold) :
    - Reposter plus vite (reduit le spacing a 2h)
    - Changer de type de contenu (clip different)
    - 3 flops consecutifs → passer en mode "recovery" (1 post/jour pendant 2 jours)
  - Si la derniere video est VIRALE (score > viral_threshold) :
    - STOP total pendant 12-24h
    - Laisser l'algo maximiser la portee
    - Reprendre doucement apres
- Regles de frequence dynamique :
  - Momentum rising → maintenir le rythme, ne rien changer
  - Momentum neutral → poster normalement
  - Momentum declining → ralentir, poster moins mais mieux
  - 3+ flops d'affilee → mode recovery

#### Calcul du performance score
```typescript
function calculatePerformanceScore(perf: PublicationPerformance): number {
    // Poids par metrique
    const weights = {
        velocity: 0.35,         // Vitesse de croissance des vues (le plus important)
        engagement: 0.25,       // (likes + comments + shares) / views
        retention: 0.20,        // Watch time moyen / duree du clip
        volume: 0.20,           // Vues totales normalisees
    }
    
    // Velocity = vues 2h / 2 (vues par heure dans les premieres heures)
    const velocity = (perf.views_2h || 0) / 2
    const velocityScore = Math.min(100, velocity / expectedVelocity * 100)
    
    // Engagement rate
    const totalEngagement = (perf.likes || 0) + (perf.comments || 0) * 3 + (perf.shares || 0) * 5
    const engagementRate = perf.views_total > 0 ? totalEngagement / perf.views_total : 0
    const engagementScore = Math.min(100, engagementRate / 0.10 * 100) // 10% = score 100
    
    // Retention
    const retentionScore = (perf.retention_rate || 0.5) * 100
    
    // Volume (log scale pour pas que les gros comptes ecrasent)
    const volumeScore = Math.min(100, Math.log10(Math.max(1, perf.views_total)) / 5 * 100)
    
    return velocityScore * weights.velocity 
         + engagementScore * weights.engagement 
         + retentionScore * weights.retention 
         + volumeScore * weights.volume
}
```

#### Recommendation engine
```typescript
interface PublishRecommendation {
    should_post_now: boolean
    reason: string                          // Explication pour l'UI
    recommended_time: Date | null           // Quand poster si pas maintenant
    wait_hours: number                      // Combien attendre
    recommended_frequency: number           // Posts par jour recommandes
    confidence: 'low' | 'medium' | 'high'  // Confiance dans la recommendation
    tips: string[]                          // Conseils contextuels
}

function getPublishRecommendation(
    intelligence: AccountIntelligence,
    performances: PublicationPerformance[],
    platform: string,
    currentTime: Date
): PublishRecommendation
```

La fonction `getPublishRecommendation` doit :
1. Verifier la phase du compte
2. Checker le momentum actuel
3. Checker la derniere performance
4. Determiner si c'est le bon moment de poster
5. Sinon, recommander quand poster
6. Donner des tips contextuels (ex: "Ton dernier clip a explose, laisse l'algo travailler")

### 3. REGLES PAR PLATEFORME

Dans `lib/distribution/platform-rules.ts`, definir les regles specifiques :

```typescript
interface PlatformRules {
    name: string
    max_safe_posts_per_day: number           // Maximum safe
    min_posts_per_day: number                // Minimum pour rester actif
    optimal_posts_per_day: number            // Sweet spot
    min_hours_between_posts: number          // Espacement minimum
    critical_window_hours: number            // Fenetre critique apres publication
    viral_cooldown_hours: number             // Attente apres un viral
    flop_recovery_hours: number              // Attente avant retry apres flop
    hashtag_impact: 'high' | 'medium' | 'low'
    best_clip_duration: { min: number, max: number }
    algo_push_duration_hours: number         // Combien de temps l'algo push
    
    // Horaires par defaut (avant d'avoir de la data)
    default_optimal_hours: number[]
}

const PLATFORM_RULES: Record<string, PlatformRules> = {
    tiktok: {
        name: 'TikTok',
        max_safe_posts_per_day: 3,
        min_posts_per_day: 1,
        optimal_posts_per_day: 2,
        min_hours_between_posts: 3,
        critical_window_hours: 2,           // Les 2 premieres heures sont critiques
        viral_cooldown_hours: 12,           // Attendre 12h si viral
        flop_recovery_hours: 4,             // Attendre 4h si flop
        hashtag_impact: 'low',              // TikTok se fie plus au contenu
        best_clip_duration: { min: 15, max: 45 },
        algo_push_duration_hours: 6,        // TikTok push pendant ~6h
        default_optimal_hours: [12, 17, 21],
    },
    youtube: {
        name: 'YouTube Shorts',
        max_safe_posts_per_day: 3,
        min_posts_per_day: 1,
        optimal_posts_per_day: 2,
        min_hours_between_posts: 4,
        critical_window_hours: 4,           // YouTube est plus lent a juger
        viral_cooldown_hours: 24,           // YouTube push longtemps, faut pas interrompre
        flop_recovery_hours: 6,
        hashtag_impact: 'medium',
        best_clip_duration: { min: 15, max: 60 },
        algo_push_duration_hours: 48,       // YouTube peut push pendant 48h+
        default_optimal_hours: [14, 20],
    },
    instagram: {
        name: 'Instagram Reels',
        max_safe_posts_per_day: 1,          // Reels = max 1/jour
        min_posts_per_day: 1,
        optimal_posts_per_day: 1,
        min_hours_between_posts: 24,        // 1 par jour = 24h spacing
        critical_window_hours: 6,           // Instagram est lent
        viral_cooldown_hours: 24,
        flop_recovery_hours: 24,
        hashtag_impact: 'high',             // Hashtags comptent encore sur IG
        best_clip_duration: { min: 15, max: 30 },
        algo_push_duration_hours: 72,       // Reels peut push pendant 3 jours
        default_optimal_hours: [13, 18, 21],
    },
}
```

### 4. UPGRADE DU COMPOSANT SETTINGS

Modifie `components/distribution/distribution-settings.tsx` pour ajouter :

**Section "Smart Publishing" en haut :**
- Badge de la phase actuelle (Testing / Optimizing / Scaling) avec couleur
- Indicateur de momentum (Rising / Neutral / Declining) avec icone fleche
- Derniere performance : Hot / Warm / Cold / Dead avec couleur
- Nombre de posts analyses
- Confiance du systeme (Low / Medium / High)

**Bouton "Optimize with AI" ameliore :**
- En Phase Testing : applique les presets par niche (comme maintenant) + active le mode test (varier les horaires)
- En Phase Optimizing : analyse les performances et recommande les meilleurs creneaux
- En Phase Scaling : ajuste le momentum et les regles dynamiquement
- Affiche un message different selon la phase : 
  - Testing: "Setting up test schedule to discover your best posting times..."
  - Optimizing: "Analyzing your {X} posts to find optimal patterns..."
  - Scaling: "Fine-tuning your strategy based on momentum..."

**Section "Insights" (nouveau) :**
- "Best performing time slots" — les 3 meilleurs creneaux decouverts
- "Best clip duration" — la duree optimale decouverte
- "Captions impact" — +X% avec captions
- "Split-screen impact" — +X% avec split-screen
- "Recommendation" — texte dynamique (ex: "Your account is in a hot streak. Consider spacing posts more to maximize reach.")
- Si pas assez de data : "Post X more clips to unlock insights" avec progress bar

### 5. UPGRADE DE LA QUEUE

Modifie `components/distribution/schedule-queue.tsx` pour ajouter :

- **Indicateur de recommendation** sur chaque item dans la queue :
  - Icone verte : "Great timing" (le creneau match un best slot)
  - Icone jaune : "OK timing" (creneau neutre)
  - Icone rouge : "Poor timing" (creneau dans un worst slot)
- **Alerte momentum** en haut de la queue :
  - Si la derniere video est hot/viral : banniere "Your last clip is performing well! Consider waiting before posting again." avec countdown
  - Si 3+ flops : banniere "Your account momentum is declining. Quality > quantity right now."

### 6. WIDGET DASHBOARD

Cree `components/distribution/smart-insights-widget.tsx` — un widget compact pour le dashboard principal qui montre :
- Phase du compte
- Momentum actuel
- "Next recommended post" avec countdown
- Quick stat : "X/Y posts this week"
- Mini graph des performances des 7 derniers posts (sparkline)

### 7. API ROUTES

#### `app/api/distribution/performance/route.ts`
- **GET** : recuperer les performances des publications d'un user (avec filtres par plateforme, date range)
- **POST** : enregistrer/mettre a jour les metriques d'une publication (appele quand on fetch les stats depuis les API plateformes, ou manuellement)

#### `app/api/distribution/intelligence/route.ts`
- **GET** : recuperer l'intelligence du compte (phase, momentum, best hours, insights)
- **POST** : trigger une analyse complete (recalcule les patterns, met a jour la phase, ajuste les seuils)

#### Upgrade `app/api/distribution/optimize/route.ts`
- Actuellement : applique des presets fixes par niche
- Nouveau : en plus des presets, integre les donnees de `account_intelligence` et `publication_performance` pour donner des recommendations basees sur la data reelle
- Si pas assez de data (phase testing), fallback sur les presets actuels
- Si assez de data (phase optimizing/scaling), utilise les patterns decouverts

#### Upgrade `app/api/distribution/schedule/route.ts`
- Avant de scheduler, appeler `getPublishRecommendation()` pour verifier que le timing est bon
- Si le timing est mauvais, retourner un warning (pas un blocage) avec la recommendation
- Le user peut quand meme forcer le schedule s'il veut

### 8. STORE ZUSTAND

Cree `stores/smart-publishing-store.ts` ou ajoute dans `stores/schedule-store.ts` :

```typescript
interface SmartPublishingState {
    // Intelligence du compte
    intelligence: AccountIntelligence | null
    performances: PublicationPerformance[]
    recommendation: PublishRecommendation | null
    
    // UI state
    loading: boolean
    insightsLoading: boolean
    
    // Actions
    fetchIntelligence: (platform: string) => Promise<void>
    fetchPerformances: (platform: string, days?: number) => Promise<void>
    getRecommendation: (platform: string) => Promise<void>
    recordPerformance: (data: Partial<PublicationPerformance>) => Promise<void>
    triggerAnalysis: (platform: string) => Promise<void>
}
```

---

## FICHIERS A CREER / MODIFIER

### Creer :
```
supabase/migrations/20260421_smart_publishing.sql
lib/distribution/smart-publisher.ts          -- Cerveau du systeme (logique de decision)
lib/distribution/platform-rules.ts           -- Regles par plateforme
app/api/distribution/performance/route.ts    -- API performance tracking
app/api/distribution/intelligence/route.ts   -- API account intelligence
components/distribution/smart-insights-widget.tsx  -- Widget insights dashboard
stores/smart-publishing-store.ts             -- Store Zustand
docs/smart-publishing.md                     -- Documentation complete du systeme
```

### Modifier :
```
components/distribution/distribution-settings.tsx  -- Ajouter section Smart Publishing + Insights
components/distribution/schedule-queue.tsx          -- Ajouter indicateurs timing + alertes momentum
app/api/distribution/optimize/route.ts              -- Integrer data reelle si disponible
app/api/distribution/schedule/route.ts              -- Ajouter warning si mauvais timing
docs/README.md                                      -- Ajouter lien vers smart-publishing.md
```

---

## REGLES DE CODE

- TypeScript strict, pas de `any`
- Noms de fichiers en kebab-case
- Composants React en PascalCase
- Dark mode uniquement
- Design moderne et clean, coherent avec le reste du site
- Utilise les composants UI existants dans `components/ui/`
- Zustand pour le state management
- Valider les inputs avec Zod dans les API routes
- Verifier l'authentification avec `withAuth`
- Supabase admin client avec `createAdminClient()` pour les operations admin
- Loading states et skeletons partout
- Gerer les erreurs avec try/catch
- Le systeme doit fonctionner MEME SANS DATA de performance (fallback sur les presets actuels)
- Les recommendations sont des SUGGESTIONS, jamais des blocages — le user peut toujours forcer

## IMPORTANT

- Le systeme de performance tracking est "future-proof" : les colonnes pour views, likes, etc. sont la mais seront remplies quand les API plateformes seront approuvees (TikTok et Instagram en review, YouTube en mode test). Pour l'instant, le user peut entrer ses stats manuellement OU le systeme utilise les presets.
- La logique smart doit etre 100% cote serveur dans `lib/distribution/smart-publisher.ts` pour pouvoir etre reutilisee partout
- Le fichier `docs/smart-publishing.md` doit etre COMPLET et servir de reference pour toute iteration future
- Fais `npx tsc --noEmit` a la fin pour verifier 0 erreurs TypeScript
