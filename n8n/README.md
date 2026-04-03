# n8n Workflows — Viral Studio Pro

## Import

1. Ouvrir n8n → **Workflows** → **Import from file**
2. Sélectionner le fichier `.json` correspondant
3. Configurer les credentials (voir ci-dessous)
4. Activer le workflow

---

## The Hunter (`the-hunter.json`)

**Objectif :** Scraper automatiquement les clips viraux toutes les 3h et alimenter le dashboard Trending.

### Déclencheur
- Schedule Trigger : toutes les **3 heures**

### Pipeline

```
Every 3h → [YouTube | TikTok | Instagram] → Calculate Velocity Score → Save to Supabase → IF viral > 80 → Slack Notification
```

### Nodes

| Node | Type | Description |
|------|------|-------------|
| Every 3 Hours | Schedule Trigger | Cron toutes les 3h |
| YouTube Shorts Trending | HTTP Request | YouTube Data API v3 — `chart=mostPopular&videoDuration=short` |
| TikTok Trending | HTTP Request | TikTok Research API v2 |
| Instagram Reels Trending | HTTP Request | Graph API Instagram |
| Calculate Velocity Score | Code | `velocity = views / heures_depuis_publication` → normalisé 0-100 |
| Save to Supabase | HTTP Request | POST `/api/trending/scrape` avec `x-api-key` header |
| Viral Clips Found? | IF | `viral_count > 0` |
| Slack Notification | HTTP Request | Webhook Slack avec liste des clips viraux |
| Log — No Viral | No-op | Log de fin si aucun viral détecté |

### Velocity Score

```javascript
rawVelocity = view_count / hours_since_publication
velocityScore = min(100, (rawVelocity / 500_000) * 100)
```

- Score ≥ 80 → Viral (notification Slack)
- Score ≥ 50 → Hot
- Score ≥ 20 → Rising
- Score < 20 → Slow

### Variables d'environnement requises dans n8n

```
APP_URL=https://your-app.netlify.app
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Credentials à configurer

| Credential | Type | Utilisation |
|------------|------|-------------|
| `Viral Studio API Key` | HTTP Header Auth | Header `x-api-key` = `process.env.N8N_API_KEY` |
| YouTube Data API | HTTP Query Auth | `key` = YouTube API Key |
| TikTok Research API | HTTP Header Auth | `Authorization: Bearer <token>` |
| Instagram Graph API | HTTP Query Auth | `access_token` = Instagram Token |
| Slack Webhook | HTTP Request (no auth) | URL directe dans le node |

### Niche Detection (auto)

Le Code node détecte automatiquement la niche depuis le titre/caption :

- **science** — physique, biologie, espace, NASA, quantum…
- **business** — entrepreneur, argent, investissement, startup…
- **fitness** — sport, musculation, régime, running, gym…
- **comedy** — humour, drôle, rire, prank…
- **tech** — IA, ChatGPT, code, programmation…
- **lifestyle** — voyage, nourriture, mode, beauté…
- **gaming** — jeu vidéo, PlayStation, Xbox, streamer…
- **education** — apprendre, tutoriel, cours, astuces…

---

---

## The Speaker (`the-speaker.json`) — Sprint 5

**Objectif :** Publier automatiquement les clips planifiés sur TikTok, Instagram et YouTube.

### Déclencheur
- Schedule Trigger : toutes les **5 minutes**

### Pipeline

```
Every 5min
  → Get publications (status=scheduled, scheduled_at<=now)
  → Has publications? (IF)
  → Process each (SplitInBatches)
      → Set status: publishing
      → Get clip storage URL
      → Get social account tokens
      → Switch by platform
          → TikTok  : POST /v2/post/publish/video/init/
          → Instagram: Create Reels container
          → YouTube  : POST /api/publish (délégation Next.js)
      → Merge results
      → Set status: published + platform_post_id
```

### Credentials à configurer dans n8n

| Credential | Type | Utilisation |
|---|---|---|
| `Supabase API` | Supabase | Lecture/écriture tables publications, clips, social_accounts |

### Variables d'environnement n8n requises

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_APP_URL=https://your-app.netlify.app
```

### Import

1. n8n → **Workflows** → **Import from file** → `the-speaker.json`
2. Configurer les credentials Supabase
3. Activer le workflow

---

## The Hunter Import v3 (`the-hunter-import-v3.json`)

Version améliorée du Hunter avec support multi-catégories étendu et gestion des erreurs.
Même pipeline que `the-hunter.json`, mêmes credentials requises.

---

## Architecture

```
n8n (cloud/self-hosted)
    ↓ POST /api/trending/scrape (avec x-api-key)
Next.js API Route
    ↓ upsert
Supabase (trending_clips table)
    ↓ read
Dashboard Trending (frontend)
```

---

## Guide de Setup Complet

### Prérequis

- **n8n** (cloud sur [n8n.cloud](https://n8n.cloud) ou self-hosted via Docker)
- **Clés API** pour les plateformes cibles (voir ci-dessous)
- L'application Viral Studio Pro déployée et accessible via URL publique

### Étape 1 — Lancer n8n

**Option A — n8n Cloud (recommandé pour commencer) :**
1. Créer un compte sur [n8n.cloud](https://n8n.cloud)
2. L'instance est prête, passer à l'étape 2

**Option B — Self-hosted (Docker) :**
```bash
docker run -d --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=your_password \
  n8nio/n8n
```
Accéder à `http://localhost:5678`.

### Étape 2 — Importer les workflows

1. Ouvrir n8n → **Workflows** → **Import from file**
2. Importer dans cet ordre :
   - `the-hunter.json` (ou `the-hunter-import-v3.json`)
   - `the-speaker.json`
3. Chaque workflow importé s'affiche dans la liste — ne pas encore activer

### Étape 3 — Configurer les credentials

Dans n8n → **Settings** → **Credentials**, créer :

| Credential | Type | Valeur |
|---|---|---|
| `Viral Studio API Key` | Header Auth | `x-api-key: <votre N8N_API_KEY de .env.local>` |
| `YouTube Data API` | HTTP Query Auth | `key: <votre Google API Key>` |
| `TikTok Research API` | Header Auth | `Authorization: Bearer <TikTok API token>` |
| `Instagram Graph API` | HTTP Query Auth | `access_token: <Instagram token>` |
| `Slack Webhook` | (aucun) | URL directe dans le node HTTP Request |

### Étape 4 — Configurer les variables d'environnement n8n

Dans n8n → **Settings** → **Variables** (ou via les variables d'environnement Docker) :

```
APP_URL=https://your-app.netlify.app
N8N_API_KEY=<même valeur que dans .env.local>
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
```

### Étape 5 — Tester puis activer

1. Ouvrir `the-hunter` → cliquer **Execute Workflow** (test manuel)
2. Vérifier que les données apparaissent dans le dashboard Trending
3. Si OK → activer le toggle **Active** en haut à droite
4. Répéter pour `the-speaker`

### Étape 6 — Alternative au Speaker : cron API

Au lieu d'utiliser le workflow n8n `the-speaker`, vous pouvez appeler
le endpoint cron intégré à l'application :

```bash
# Toutes les 5 minutes via crontab, GitHub Actions, ou cron-job.org
curl -X POST https://your-app.netlify.app/api/cron/publish-scheduled \
  -H "x-api-key: $CRON_SECRET"
```

Ce endpoint publie automatiquement toutes les publications dont
`status = 'scheduled'` et `scheduled_at <= now()`.

---

## Obtenir les clés API des plateformes

### YouTube Data API
1. Aller sur [Google Cloud Console](https://console.cloud.google.com)
2. Créer un projet → Activer **YouTube Data API v3**
3. Créer une **API Key** (pas OAuth — c'est pour la lecture publique)

### TikTok Research API
1. Aller sur [TikTok for Developers](https://developers.tiktok.com)
2. Créer une app → Demander l'accès **Research API**
3. Récupérer le Bearer token

### Instagram Graph API
1. Aller sur [Meta for Developers](https://developers.facebook.com)
2. Créer une app → Ajouter le produit **Instagram Graph API**
3. Générer un token d'accès long-durée

### Slack Webhook (optionnel — pour les notifications)
1. Aller sur [Slack API](https://api.slack.com/apps)
2. Créer une app → **Incoming Webhooks** → Activer
3. Créer un webhook URL pour le channel de notifications
