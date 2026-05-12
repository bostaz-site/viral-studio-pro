# Instantly API Integration

Syncs email account (mailbox) health and campaign metrics from [Instantly](https://instantly.ai) into our admin database.

## Architecture

```
lib/integrations/instantly/
  client.ts           — API v2 wrapper with pagination + rate limiting
  types.ts            — Instantly API + internal sync types
  sync.ts             — Main orchestrator (called by cron + manual trigger)
  sync-mailboxes.ts   — Syncs email accounts → mailboxes + mailbox_daily_stats
  sync-campaigns.ts   — Syncs campaigns → email_campaigns (with analytics)

app/api/cron/sync-instantly/route.ts           — Cron endpoint (every 15min)
app/api/admin/sync/instantly/route.ts          — GET status / POST force-sync
app/(dashboard)/admin/sync/page.tsx            — Admin sync status page
```

## Environment Variables

```env
INSTANTLY_API_KEY=your_api_key_here   # Server-only, never NEXT_PUBLIC_
```

## Usage

### Cron (automatic, every 15 min)
```bash
curl -X POST https://viralanimal.com/api/cron/sync-instantly \
  -H "x-api-key: $CRON_SECRET"
```

### Force sync (admin UI)
Click "Force Sync Now" on `/dashboard/admin/sync`.

### Programmatic
```typescript
import { syncInstantlyStats } from '@/lib/integrations/instantly/sync'

const result = await syncInstantlyStats()
// { success: true, mailboxes_synced: 12, campaigns_synced: 3, errors: [] }
```

## What gets synced

### Mailboxes
- Email, display name, domain, provider
- Status (warming/active/paused/blocked)
- Daily send limit
- Instantly account ID mapping
- Daily stats row in `mailbox_daily_stats`

### Campaigns
- Name, status (mapped to our schema)
- Recipients, sent, opened, replied, bounced, unsubscribed counts
- Instantly campaign ID mapping

## Rate Limiting

- 200ms delay between pagination requests
- 300ms delay between campaign analytics calls
- Sequential processing (no parallel API calls)

## Error Handling

- Per-entity: if one mailbox/campaign fails, others continue
- Errors logged via pino + stored in sync result
- Fatal errors (API key invalid, network down) stop the sync but still persist partial state
