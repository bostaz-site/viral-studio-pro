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
