# PROMPT — Systeme Affilies + Landing Cold Email + Admin Dashboard + Docs

Tu travailles sur Viral Animal, une webapp Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase + Stripe. Le projet est deja fonctionnel. Lis le fichier CLAUDE.md pour le contexte complet du projet.

## IMPORTANT — DOCUMENTATION PAR MODULE

Pour CHAQUE feature que tu codes, cree un fichier documentation dans `docs/` a la racine du projet. Chaque fichier doit contenir :
- Description de la feature
- Tables SQL utilisees (avec colonnes)
- API routes (avec methodes et payloads)
- Composants UI (avec props)
- Stores Zustand
- Flow utilisateur
- Notes techniques

Cree aussi un fichier `docs/README.md` qui liste tous les modules avec un lien vers chaque doc.

Documente aussi les features EXISTANTES (celles qui sont deja codees) en creant des fichiers docs pour :
- `docs/auth-oauth.md` — Systeme d'authentification + OAuth social (TikTok, YouTube, Instagram)
- `docs/enhance-render.md` — Enhance page + rendering FFmpeg via VPS Railway
- `docs/distribution-hub.md` — Distribution Hub (scheduling, queue, calendar, settings, anti-shadowban)
- `docs/analytics.md` — Analytics dashboard + Viral Score
- `docs/browse-clips.md` — Bibliotheque de clips Twitch + trending
- `docs/upload.md` — Upload de clips
- `docs/billing-stripe.md` — Plans, Stripe checkout, webhooks

Pour documenter les features existantes, lis les fichiers source pour comprendre ce qu'ils font. Ne les modifie pas.

---

## CE QUE TU DOIS CODER

### 1. SYSTEME AFFILIES COMPLET

#### Tables SQL a creer

```sql
-- Affilies (influenceurs partenaires)
CREATE TABLE public.affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    handle TEXT NOT NULL UNIQUE,          -- ex: "xqc", "pokimane" — utilise dans le lien /ref/[handle]
    platform TEXT,                         -- "twitch", "youtube", "tiktok", "instagram"
    niche TEXT,                           -- "gaming", "irl", "fitness", etc.
    commission_rate FLOAT DEFAULT 0.20,   -- 20% par defaut
    promo_code TEXT UNIQUE,               -- ex: "XQC20" — code promo pour 20% de rabais
    promo_discount_percent INTEGER DEFAULT 20,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
    notes TEXT,                           -- notes internes
    total_clicks INTEGER DEFAULT 0,
    total_signups INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,  -- signups qui deviennent payants
    total_revenue FLOAT DEFAULT 0,        -- revenus generes
    total_commission_earned FLOAT DEFAULT 0,
    total_commission_paid FLOAT DEFAULT 0,
    stripe_account_id TEXT,               -- pour paiement futur Stripe Connect
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals (chaque clic/signup/conversion tracke)
CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('link', 'promo_code')),
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    status TEXT DEFAULT 'clicked' CHECK (status IN ('clicked', 'signed_up', 'converted', 'churned')),
    signed_up_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    revenue_generated FLOAT DEFAULT 0,
    commission_amount FLOAT DEFAULT 0,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payouts (paiements aux affilies)
CREATE TABLE public.affiliate_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    amount FLOAT NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
    payment_method TEXT DEFAULT 'stripe',
    stripe_transfer_id TEXT,
    notes TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

N'oublie pas les indexes, RLS policies (admin only pour affiliates et payouts, user can read own referrals), et les foreign keys.

#### Page Admin — `/admin/affiliates`

Page admin accessible seulement par les admin emails (utilise `isAdminEmail` de `lib/auth/admin-emails.ts` et `withAdmin` de `lib/api/withAdmin.ts`).

**Vue d'ensemble en haut :**
- Total affilies actifs
- Total signups via affilies
- Total conversions
- Total commissions a payer (earned - paid)

**Table des affilies :**
- Colonnes : Nom, Handle, Plateforme, Code Promo, Clics, Signups, Conversions, Revenus, Commission due, Statut, Actions
- Actions : Voir details, Editer, Payer, Desactiver
- Bouton "Add Affiliate" en haut qui ouvre un dialog pour creer un nouvel affilie
- Quand tu crees un affilie, le systeme genere automatiquement :
  - Lien : `viralanimal.com/ref/[handle]`
  - Code promo : `[HANDLE]20` (en majuscules + le pourcentage de rabais)

**Detail d'un affilie** (dialog ou page) :
- Stats detaillees (graph de signups par jour)
- Liste de tous ses referrals avec statut
- Historique des payouts
- Bouton "Pay Now" qui cree un payout pending

#### Page Affilie — `/ref/[handle]`

C'est la landing page quand quelqu'un clique le lien d'un affilie.

**Comportement :**
1. Le handle est extrait de l'URL
2. Un cookie `ref=[handle]` est set pour 30 jours
3. Les UTM params sont aussi stockes dans le cookie si presents
4. Un `referral` est cree dans la DB avec status `clicked`
5. L'utilisateur est redirige vers la landing page principale `/` ou vers `/invite`
6. Quand il s'inscrit, le cookie est lu et le referral est mis a jour vers `signed_up`
7. Quand il paie (webhook Stripe), le referral est mis a jour vers `converted` et la commission est calculee

**IMPORTANT :** Le tracking du cookie doit etre integre dans :
- Le flow de signup (`app/(auth)/signup/page.tsx`) — lire le cookie ref et l'associer au nouveau user
- Le webhook Stripe (`app/api/stripe/webhook/route.ts`) — quand un user paie, checker s'il a un referral et mettre a jour la commission

#### Code Promo dans Stripe Checkout

Quand un user entre un code promo au moment du checkout :
- Verifier que le code existe dans la table `affiliates`
- Appliquer le rabais (utiliser Stripe Coupons/Promotion Codes)
- Associer le signup a l'affilie correspondant
- Le code promo et le lien tracke sont deux entrees vers le meme affilie

**Implementation :**
- Creer un Stripe Coupon via l'API Stripe quand un affilie est cree
- Ajouter un champ "Code promo" dans la page pricing/checkout
- Valider le code cote serveur avant d'appliquer

#### API Routes

- `app/api/admin/affiliates/route.ts` — GET (list all), POST (create affiliate)
- `app/api/admin/affiliates/[id]/route.ts` — GET (detail), PATCH (update), DELETE
- `app/api/admin/affiliates/[id]/payout/route.ts` — POST (create payout)
- `app/api/referral/track/route.ts` — POST (track click from /ref/[handle])
- `app/api/referral/verify-code/route.ts` — POST (verify promo code)

### 2. LANDING PAGE `/invite`

Page de landing dediee pour les liens dans les cold emails. Plus directe et concise que la landing principale.

**Contenu :**
- Hero : "Turn Your Streams Into Viral Clips — Free" avec CTA "Start Free"
- 3 features clees en icones (Captions, Split-Screen, Multi-Platform)
- Social proof : "Join X+ creators" (meme si c'est petit)
- Bouton CTA qui amene vers `/signup`
- Tracking UTM automatique (lire les params de l'URL et les stocker)

### 3. ADMIN DASHBOARD AMELIORE — `/admin/growth`

La page admin/growth existe deja mais doit etre amelioree avec :

- **Signups par jour** (graphique 30 derniers jours)
- **Sources de signups** (direct, referral link, promo code, organic)
- **Conversion rate** (free → paid)
- **Revenue par jour**
- **Top affilies** (les 5 qui generent le plus)
- **Alertes** — notification quand un nouveau signup arrive via un affilie

### 4. ONBOARDING AMELIORE

Quand un nouvel utilisateur s'inscrit (surtout via un lien affilie) :

- Modal de bienvenue qui montre les 3 etapes (Browse → Enhance → Publish)
- Un clip de demo pre-selectionne pour qu'il puisse essayer tout de suite
- Progress bar "Complete your setup" (connecter un compte social, enhancer un premier clip)
- Le modal de bienvenue existe deja dans `components/onboarding/welcome-modal.tsx` — ameliore-le

---

## FICHIERS A CREER

```
-- Pages
app/(dashboard)/admin/affiliates/page.tsx
app/ref/[handle]/page.tsx
app/invite/page.tsx

-- API Routes
app/api/admin/affiliates/route.ts
app/api/admin/affiliates/[id]/route.ts
app/api/admin/affiliates/[id]/payout/route.ts
app/api/referral/track/route.ts
app/api/referral/verify-code/route.ts

-- Components
components/admin/affiliates-dashboard.tsx
components/admin/affiliate-table.tsx
components/admin/affiliate-detail.tsx
components/admin/create-affiliate-dialog.tsx
components/admin/payout-dialog.tsx
components/admin/growth-dashboard.tsx
components/landing/invite-page.tsx
components/onboarding/setup-progress.tsx

-- Stores
stores/affiliate-store.ts

-- Docs (TOUS les modules, existants et nouveaux)
docs/README.md
docs/auth-oauth.md
docs/enhance-render.md
docs/distribution-hub.md
docs/analytics.md
docs/browse-clips.md
docs/upload.md
docs/billing-stripe.md
docs/affiliate-system.md
docs/admin-dashboard.md
docs/landing-pages.md
docs/onboarding.md
```

## REGLES DE CODE

- TypeScript strict, pas de `any`
- Noms de fichiers en kebab-case
- Composants React en PascalCase
- Dark mode uniquement
- Design moderne et clean, coherent avec le reste du site
- Utilise les composants UI existants dans `components/ui/`
- Zustand pour le state management
- Valider les inputs avec Zod dans les API routes
- Pages admin : verifier avec `withAdmin` ou `isAdminEmail`
- Supabase admin client avec `createAdminClient()` de `lib/supabase/admin.ts`
- Loading states et skeletons partout
- Les variables Stripe sont dans `.env.local` : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- Fais un `npx tsc --noEmit` a la fin pour verifier 0 erreurs TypeScript

## CE QUI EXISTE DEJA (NE PAS CASSER)

- Systeme OAuth complet (TikTok, YouTube, Instagram) dans `app/api/oauth/` et `app/api/auth/`
- Distribution Hub dans `app/(dashboard)/dashboard/distribution/`
- Analytics dans `app/(dashboard)/dashboard/analytics/`
- Publish dialog dans `components/distribution/publish-dialog.tsx`
- Stripe checkout dans `app/api/stripe/checkout/route.ts`
- Stripe webhook dans `app/api/stripe/webhook/route.ts`
- Welcome modal dans `components/onboarding/welcome-modal.tsx`
- Admin pages dans `app/(dashboard)/admin/`
- Table `publications` existante
- Table `social_accounts` existante
- Table `scheduled_publications` existante (vient d'etre creee)
- Table `distribution_settings` existante (vient d'etre creee)
- Systeme de referral basique deja present dans `profiles` (referral_code, referred_by, bonus_videos)
