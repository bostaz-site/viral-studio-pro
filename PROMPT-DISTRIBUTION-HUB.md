# PROMPT — Distribution Hub + Analytics + Features

Tu travailles sur Viral Animal, une webapp Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase. Le projet est deja fonctionnel avec : upload de clips, bibliotheque de clips Twitch, enhance (sous-titres, split-screen), render via VPS Railway, et un systeme OAuth + Publish basique vers YouTube/TikTok/Instagram.

## CE QUE TU DOIS CODER

### 1. PAGE DISTRIBUTION HUB — `/dashboard/distribution`

Nouvelle page principale pour gerer toute la distribution. C'est le coeur du produit. Ajoute-la dans la sidebar navigation dans `app/(dashboard)/layout.tsx` avec une icone `Radio` ou `Megaphone` de lucide-react.

**Section A — Comptes connectes**
- Afficher tous les comptes sociaux connectes (TikTok, YouTube, Instagram) avec avatar, username, statut
- Bouton connecter/deconnecter pour chaque plateforme
- Pour les plateformes dont les permissions API ne sont PAS encore approuvees (TikTok et Instagram), afficher un badge "Coming Soon" stylise au lieu du bouton connecter. YouTube fonctionne deja.
- Reutilise la logique existante dans `components/distribution/connect-accounts.tsx` et `stores/distribution-store.ts`

**Section B — Queue de publication (Smart Scheduling)**
- Interface pour ajouter des clips a la queue de publication
- Chaque item dans la queue : thumbnail du clip, titre, plateformes ciblees, heure planifiee, statut (scheduled/published/failed)
- Scheduling intelligent anti-shadowban :
  - Espacement minimum de 3h entre chaque post sur la meme plateforme
  - Variation aleatoire de +/- 30 min sur l'heure planifiee
  - Ne jamais republier le meme clip sur la meme plateforme
  - Rotation entre les comptes si l'user en a plusieurs
- Heures optimales par plateforme (presets) :
  - TikTok : 7h, 12h, 17h, 21h
  - YouTube Shorts : 8h, 14h, 20h
  - Instagram Reels : 9h, 13h, 18h, 21h
- Calendrier visuel (vue semaine) montrant les posts planifies
- Pour les plateformes "Coming Soon", permettre quand meme de scheduler (ca sera publie quand la permission sera approuvee)

**Section C — Historique des publications**
- Liste de toutes les publications passees
- Pour chaque : thumbnail, titre, plateforme, date, statut, lien vers le post
- Filtres par plateforme, par statut, par date

**Section D — Parametres intelligents**
- Parametres par compte : frequence max de publication par jour, hashtags par defaut, caption template
- Bouton "Optimize with AI" qui configure automatiquement les meilleurs parametres selon la niche de l'utilisateur
- Pour le MVP, le bouton "Optimize with AI" peut juste appliquer des presets intelligents (pas besoin d'appeler Claude API)
  - Si niche = gaming : hashtags gaming, heures de publication gaming, frequence 2-3/jour
  - Si niche = IRL/lifestyle : hashtags lifestyle, heures differentes, frequence 1-2/jour
  - Si pas de niche : parametres generiques optimaux

### 2. ANALYTICS DASHBOARD — `/dashboard/analytics`

Nouvelle page pour les stats de performance.

- **Vue d'ensemble** : total publications, total vues estimees, engagement rate, clips publies cette semaine
- **Graphique** : publications par jour (7 derniers jours) — utilise Recharts qui est deja dispo
- **Performance par plateforme** : cards avec stats par TikTok/YouTube/Instagram
- **Viral Score de compte** : score 0-100 base sur :
  - Frequence de publication (regularite)
  - Diversite des plateformes
  - Nombre de clips publies
  - Pour le MVP, c'est un score calcule cote client basé sur les donnees de la table `publications`
- **Top clips** : les 5 clips les plus performants (par nombre de plateformes publiees)

### 3. TABLES SUPABASE A CREER

```sql
-- Table pour les publications schedulees (queue)
CREATE TABLE public.scheduled_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    clip_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    caption TEXT,
    hashtags TEXT[],
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'publishing', 'published', 'failed', 'cancelled')),
    publish_result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour les parametres de distribution par user
CREATE TABLE public.distribution_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    max_posts_per_day INTEGER DEFAULT 3,
    min_hours_between_posts FLOAT DEFAULT 3,
    default_hashtags JSONB DEFAULT '[]',
    caption_template TEXT,
    niche TEXT,
    optimal_hours JSONB DEFAULT '{}',
    ai_optimized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. API ROUTES A CREER

- `app/api/distribution/schedule/route.ts` — CRUD pour les publications schedulees
- `app/api/distribution/settings/route.ts` — GET/PUT pour les parametres de distribution
- `app/api/distribution/analytics/route.ts` — GET stats de publications
- `app/api/distribution/optimize/route.ts` — POST pour appliquer les presets AI

### 5. PWA + RESPONSIVE MOBILE

- Creer `app/manifest.ts` pour le manifest PWA (name: "Viral Animal", theme_color, icons)
- Ajouter un menu hamburger dans le layout mobile (le menu sidebar actuel ne s'adapte pas bien sur mobile)
- Verifier que toutes les nouvelles pages sont responsive (grid cols adaptatifs, padding mobile)

### 6. SIDEBAR NAVIGATION MISE A JOUR

Dans `app/(dashboard)/layout.tsx`, ajouter les nouveaux liens :
```typescript
const navigation = [
    { name: 'Upload', href: '/dashboard/upload', icon: UploadCloud },
    { name: 'Browse', href: '/dashboard', icon: Compass },
    { name: 'Enhance', href: '/dashboard/enhance', icon: Wand2 },
    { name: 'Distribution', href: '/dashboard/distribution', icon: Radio },  // NOUVEAU
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },    // NOUVEAU
]
```

## REGLES DE CODE

- TypeScript strict, pas de `any`
- Noms de fichiers en kebab-case
- Composants React en PascalCase
- Server Components par defaut, Client Components seulement si interactivite
- Dark mode uniquement (le site est full dark)
- Design moderne et clean, coherent avec le reste du site
- Utilise les composants UI existants dans `components/ui/` (Button, Card, Badge, Dialog, Input, etc.)
- Zustand pour le state management (voir les stores existants dans `stores/`)
- Valider les inputs avec Zod dans les API routes
- Verifier l'authentification avec `withAuth` de `lib/api/withAuth.ts`
- Supabase admin client avec `createAdminClient()` de `lib/supabase/admin.ts`
- Gerer les erreurs avec try/catch, pas de console.log en prod
- Loading states et skeletons partout

## STRUCTURE DES FICHIERS A CREER

```
app/(dashboard)/dashboard/distribution/page.tsx    — Page Distribution Hub
app/(dashboard)/dashboard/analytics/page.tsx       — Page Analytics (remplace admin/analytics)
app/api/distribution/schedule/route.ts             — API scheduling
app/api/distribution/settings/route.ts             — API settings
app/api/distribution/analytics/route.ts            — API analytics
app/api/distribution/optimize/route.ts             — API optimize AI
components/distribution/distribution-hub.tsx       — Composant principal hub
components/distribution/schedule-queue.tsx          — Queue de publication
components/distribution/schedule-calendar.tsx       — Calendrier visuel
components/distribution/publication-history.tsx     — Historique
components/distribution/distribution-settings.tsx  — Parametres + AI optimize
components/distribution/viral-score.tsx             — Composant Viral Score
components/analytics/analytics-dashboard.tsx        — Dashboard analytics
components/analytics/platform-stats.tsx             — Stats par plateforme
components/analytics/top-clips.tsx                  — Top clips
stores/schedule-store.ts                            — Store Zustand scheduling
app/manifest.ts                                     — PWA manifest
```

## CE QUI EXISTE DEJA (NE PAS CASSER)

- `components/distribution/connect-accounts.tsx` — UI connexion comptes
- `components/distribution/publish-dialog.tsx` — Dialog de publication
- `stores/distribution-store.ts` — Store avec SocialAccount, PublishTarget, etc.
- `lib/distribution/platforms.ts` — Config des plateformes
- `lib/distribution/token-manager.ts` — Gestion des tokens OAuth
- `app/api/publish/[platform]/route.ts` — API de publication existante
- `app/api/oauth/[platform]/route.ts` — OAuth flow existant
- `app/api/auth/[platform]/callback/route.ts` — OAuth callbacks
- Table `publications` dans Supabase — deja existante avec colonnes: id, clip_id, social_account_id, platform, caption, hashtags, status, platform_post_id, tracking_url, published_at, created_at
- Table `social_accounts` dans Supabase — deja existante

## IMPORTANT

- TikTok et Instagram sont "Coming Soon" — les permissions API ne sont pas encore approuvees. Affiche un badge "Coming Soon" stylise sur ces plateformes mais permets quand meme de configurer les parametres et de scheduler (ca sera publie plus tard).
- YouTube fonctionne deja en mode test (100 users max).
- Le design doit etre DARK MODE, moderne, avec des gradients subtils et des cards avec bordures. Regarde le style existant des autres pages pour rester coherent.
- Commence par creer les migrations SQL, puis les API routes, puis les stores, puis les composants UI, puis les pages.
- Fais un `npm run build` a la fin pour verifier qu'il n'y a pas d'erreurs TypeScript.
