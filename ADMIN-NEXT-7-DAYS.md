# 🎬 ADMIN — Next 7 Days v2 (Realistic)

> Plan d'action jour par jour pour la **Vague 1 Semaine 1** de l'Admin Hub.
>
> **v2 changes** : Découpe réaliste 7 jours. L'attribution + Stripe ledger + reply composer sont déplacés en Semaine 2 (voir doc séparé à créer après J7).
>
> 8-10h/jour de dev. Pas de polish UI. **Source de vérité + compliance + structure.**

---

## 📌 Pré-requis (à faire avant Jour 1)

- [ ] Lire `ADMIN-MEGA-PLAN.md` v2.0 en entier (30 min)
- [ ] Lire `ADMIN-DATABASE-SCHEMA.md` sections v2.0 + v2.1 (30 min)
- [ ] Décider officiellement le scope coupé pour Semaine 1 :
  - ❌ Pas d'attribution + commission ledger (Semaine 2)
  - ❌ Pas de Stripe webhook complet (Semaine 2)
  - ❌ Pas de reply composer/envoi (Semaine 2)
  - ❌ Pas de sequence builder (Vague 3)
  - ❌ Pas d'AI automation (Vague 2)
  - ❌ Pas d'affiliate dashboard côté affilié (Vague 2)
  - ✅ Seulement : Schema + CRM + Suppression + Webhook ingest + Inbox read-only + Campaign export basic + Activation events
- [ ] Backup Supabase prod avant migrations
- [ ] Créer branche `feature/admin-v2-wave1`
- [ ] Créer un environnement staging Supabase (branch) si pas déjà fait

---

## 🗓️ JOUR 1 (Lundi) — Schema STAGING seulement

**Objectif** : Toutes les migrations Vague 1 appliquées sur **staging** uniquement. PAS prod le même jour.

### Tâches

#### 1.1 Préparer les migrations
Crée les fichiers dans `supabase/migrations/` dans l'ordre :

```
20260513_admin_users_roles.sql
20260513_permission_helpers.sql        ← capability-based helpers
20260513_suppression_list.sql          ← avec CITEXT
20260514_webhook_events.sql
20260514_campaign_recipients.sql
20260515_email_events.sql
20260515_affiliate_clicks.sql          ← ip_hash, pas ip raw
20260516_commission_ledger.sql          ← service_role only
20260516_fraud_flags.sql
20260517_payout_holds.sql
20260517_ai_calls.sql
20260518_import_batches.sql
20260518_domains_mailbox_stats.sql
20260519_lead_enrichment.sql
20260519_unsubscribe_tokens.sql        ← URL token, pas email
20260519_product_activation_events.sql ← NEW pour Signal 3
20260520_citext_email_migration.sql    ← convert email TEXT → CITEXT
20260520_v2_indexes.sql
20260521_rls_revised.sql               ← permissions + RPC functions
```

SQL complet dans `ADMIN-DATABASE-SCHEMA.md` sections v2.0 + v2.1.

#### 1.2 Apply sur STAGING uniquement
```bash
# Via Supabase MCP — créer branch staging
# Ou via CLI :
supabase db push --linked --branch staging
```

#### 1.3 Smoke tests SQL sur staging

Run dans Supabase SQL Editor (staging) :

```sql
-- Test 1 : toutes les tables existent
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'admin_users', 'suppression_list', 'webhook_events',
    'campaign_recipients', 'email_events', 'affiliate_clicks',
    'affiliate_commission_ledger', 'fraud_flags', 'payout_holds',
    'ai_calls', 'import_batches', 'domains', 'mailbox_daily_stats',
    'lead_enrichment_snapshots', 'unsubscribe_tokens',
    'product_activation_events'
  );
-- Devrait retourner 16 rows.

-- Test 2 : helper functions existent
SELECT proname FROM pg_proc WHERE proname IN (
  'can_view_crm', 'can_manage_crm', 'can_view_finance',
  'can_manage_payouts', 'is_owner', 'auth_role'
);
-- Devrait retourner 6 rows.

-- Test 3 : RLS activé sur toutes les nouvelles tables
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
  AND tablename IN (
    'admin_users', 'suppression_list', 'affiliate_commission_ledger'
  );

-- Test 4 : RPC functions VA
SELECT proname FROM pg_proc WHERE proname IN (
  'update_influencer_status', 'update_influencer_notes',
  'add_influencer_tag', 'add_to_suppression',
  'create_manual_ledger_adjustment'
);
```

#### 1.4 Seed `admin_users` (staging)
```sql
INSERT INTO admin_users (user_id, role)
VALUES (auth.uid(), 'owner');  -- à adapter selon ton user_id staging
```

#### 1.5 NE PAS push prod aujourd'hui
Si tout est vert sur staging → push prod **demain matin** après revue.

**Definition of done J1** : Staging a toutes les tables/helpers/RPC. Tous les smoke tests passent. Aucune erreur RLS.

---

## 🗓️ JOUR 2 (Mardi) — Admin Shell + Auth + Smoke tests prod

**Objectif** : Push prod (matin) + admin route + role guard fonctionnel.

### Tâches

#### 2.1 Matin : push prod
Si J1 staging OK :
```bash
supabase db push --linked --project-ref <prod-ref>
```

Re-run les 4 smoke tests SQL sur prod. Si tout vert → continuer.

#### 2.2 Seed prod admin_users
```sql
INSERT INTO admin_users (user_id, role)
SELECT id, 'owner' FROM auth.users WHERE email = 'samycloutier30@gmail.com';
```

#### 2.3 Admin layout
Fichier : `app/dashboard/admin/layout.tsx`

```typescript
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AdminSidebar } from './_components/admin-sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/admin')

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!adminUser) redirect('/dashboard')

  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={adminUser.role} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
```

#### 2.4 Sidebar navigation par rôle
Fichier : `app/dashboard/admin/_components/admin-sidebar.tsx`

```typescript
const NAV_ITEMS = [
  { href: '/dashboard/admin', label: 'Dashboard', roles: ['owner','ops','va','finance','readonly'] },
  { href: '/dashboard/admin/influencers', label: 'Influencers', roles: ['owner','ops','va','readonly'] },
  { href: '/dashboard/admin/inbox', label: 'Inbox', roles: ['owner','ops','va'] },
  { href: '/dashboard/admin/campaigns', label: 'Campaigns', roles: ['owner','ops'] },
  { href: '/dashboard/admin/suppression', label: 'Suppression', roles: ['owner','ops'] },
  { href: '/dashboard/admin/affiliates', label: 'Affiliates', roles: ['owner','finance'] },
  { href: '/dashboard/admin/payouts', label: 'Payouts', roles: ['owner','finance'] },
  { href: '/dashboard/admin/audit', label: 'Audit Log', roles: ['owner'] },
]
```

#### 2.5 Helper côté serveur
Fichier : `lib/admin/auth.ts`

```typescript
export async function requireAdminRole(
  minCapability: 'view_crm' | 'manage_crm' | 'view_finance' | 'manage_payouts' | 'owner'
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!adminUser) throw new Error('Not an admin')

  // Capability checks (mêmes règles que SQL)
  const CAPABILITIES = {
    view_crm: ['owner','ops','va','readonly'],
    manage_crm: ['owner','ops','va'],
    view_finance: ['owner','finance'],
    manage_payouts: ['owner','finance'],
    owner: ['owner'],
  }
  if (!CAPABILITIES[minCapability].includes(adminUser.role)) {
    throw new Error(`Permission denied: requires ${minCapability}`)
  }
  return { user, role: adminUser.role }
}
```

#### 2.6 Audit log helper
Fichier : `lib/admin/audit.ts` — INSERT INTO admin_audit_log avec actor, action, resource.

#### 2.7 RLS smoke tests
Crée un user test (non-admin) → essaie de query `influencers` → doit échouer.
Crée un test VA via `INSERT INTO admin_users` avec role='va' → essaie de DELETE influencer → doit échouer.

**Definition of done J2** : Prod a le schema. Tu peux te logger sur `/dashboard/admin`. Sidebar affiche les bonnes sections selon rôle. Non-admin redirigé.

---

## 🗓️ JOUR 3 (Mercredi) — Influencer CRM (list + detail)

**Objectif** : Lire les influencers, voir leur fiche, changer status via RPC.

### Tâches

#### 3.1 Page liste
Fichier : `app/dashboard/admin/influencers/page.tsx`

Features minimum :
- Table avec colonnes : Email, Display name, Platform, Status (badge), Lead Score, Last Contact, Tags
- Search par email/name (debounced)
- Filter par status (dropdown)
- Filter par platform
- Pagination (50 par page)
- Click row → `/dashboard/admin/influencers/[id]`

Stack : shadcn DataTable + TanStack Table.

#### 3.2 Page détail
Fichier : `app/dashboard/admin/influencers/[id]/page.tsx`

Tabs :
- **Overview** : info perso, audience size, niche, lead score
- **Notes** : markdown editor
- **Tags** : chips avec add/remove
- **Audit log** : timeline des changements (depuis `admin_audit_log`)

Sidebar quick actions :
- Change status (dropdown → appelle RPC `update_influencer_status`)
- Add tag → RPC `add_influencer_tag`
- Update notes → RPC `update_influencer_notes`
- Suppress → RPC `add_to_suppression`
- Block

#### 3.3 RPC calls côté client
Fichier : `lib/admin/influencer-actions.ts`

```typescript
export async function updateInfluencerStatus(id: string, newStatus: string) {
  const supabase = createBrowserClient()
  const { error } = await supabase.rpc('update_influencer_status', {
    p_influencer_id: id,
    p_new_status: newStatus,
  })
  if (error) throw error
}
// idem pour update_influencer_notes, add_influencer_tag, etc.
```

#### 3.4 Test RLS via VA
Insert un admin_user role='va' (de test). Login as that user. Vérifier :
- Peut voir liste influencers ✅
- Peut update status via RPC ✅
- NE PEUT PAS update directement via Supabase JS client ❌ (RLS bloque)
- NE PEUT PAS delete ❌

**Definition of done J3** : Tu peux naviguer la liste, ouvrir une fiche, changer status via RPC. Les RPC sont audit-logged. VA test confirme les permissions.

---

## 🗓️ JOUR 4 (Jeudi) — CSV Import + Suppression Enforcement

**Objectif** : Importer 100-1000 leads avec dedupe + suppression check + batch tracking.

### Tâches

#### 4.1 Page import
Fichier : `app/dashboard/admin/influencers/import/page.tsx`

Flow :
1. Upload CSV (drag & drop, max 10MB)
2. Parse client-side avec Papaparse (preview 10 first rows)
3. Map columns (email obligatoire, name/platform/niche optionnels)
4. POST `/api/admin/influencers/import` avec parsed rows
5. Show progress : "X / Y rows processed"
6. Result page : { imported, duplicates, suppressed, failed }

#### 4.2 API route import
Fichier : `app/api/admin/influencers/import/route.ts`

```typescript
export async function POST(req: NextRequest) {
  await requireAdminRole('manage_crm')
  const { rows } = await req.json()

  const admin = createAdminClient()

  // 1. Create import batch
  const { data: batch } = await admin
    .from('import_batches')
    .insert({
      imported_by: userId,
      source: 'csv_upload',
      rows_total: rows.length,
      status: 'processing'
    })
    .select()
    .single()

  let imported = 0, duplicates = 0, suppressed = 0, failed = 0

  // 2. Process par batch de 100
  for (const chunk of chunks(rows, 100)) {
    // Check suppression list en batch
    const emails = chunk.map(r => r.email.toLowerCase())
    const { data: suppressedRows } = await admin
      .from('suppression_list')
      .select('email')
      .in('email', emails)
    const suppressedSet = new Set(suppressedRows?.map(s => s.email))

    // Filter
    const allowed = chunk.filter(r => !suppressedSet.has(r.email.toLowerCase()))
    suppressed += chunk.length - allowed.length

    // Insert avec ON CONFLICT
    for (const row of allowed) {
      const { error } = await admin
        .from('influencers')
        .insert({
          email: row.email,
          display_name: row.name,
          primary_platform: row.platform,
          niche: row.niche,
          source: 'csv_import',
          import_batch_id: batch.id,
        })
      if (error?.code === '23505') duplicates++  // unique violation
      else if (error) failed++
      else imported++
    }

    // Update batch progress
    await admin.from('import_batches').update({
      rows_imported: imported,
      rows_skipped_duplicate: duplicates,
      rows_skipped_suppression: suppressed,
      rows_failed: failed,
    }).eq('id', batch.id)
  }

  // 3. Mark batch completed
  await admin.from('import_batches').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', batch.id)

  return NextResponse.json({ batch_id: batch.id, imported, duplicates, suppressed, failed })
}
```

#### 4.3 Suppression list page
Fichier : `app/dashboard/admin/suppression/page.tsx`

- Table de la suppression list
- Search par email/domain
- Filter par reason
- Bulk add (paste 1 email per line)
- Remove from list (rare — log dans audit)

#### 4.4 Add column `import_batch_id` à influencers (si pas déjà)
```sql
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id);
CREATE INDEX idx_influencers_import_batch ON influencers(import_batch_id);
```

**Definition of done J4** :
- Tu importes un CSV de 500 leads
- Tu vois progress en temps réel
- Result page montre breakdown (imported / duplicates / suppressed / failed)
- L'`import_batches` row est complet
- Tu peux drill-down depuis la batch vers les influencers importés

---

## 🗓️ JOUR 5 (Vendredi) — Public Unsubscribe + Privacy

**Objectif** : Public unsubscribe route avec signed token (pas d'email dans URL).

### Tâches

#### 5.1 Token generation côté serveur
Fichier : `lib/admin/unsubscribe-token.ts`

```typescript
import crypto from 'crypto'

export async function generateUnsubscribeToken(email: string, campaignId?: string) {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const admin = createAdminClient()
  await admin.from('unsubscribe_tokens').insert({
    token_hash: tokenHash,
    email,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    source_campaign_id: campaignId ?? null,
  })

  return token  // À mettre dans l'URL : /unsubscribe?t=<token>
}
```

À appeler lors de la génération des emails (Vague 1.5 / Semaine 2 quand on enverra).

#### 5.2 Public route
Fichier : `app/unsubscribe/page.tsx` (PAS dans admin, public)

```typescript
export default async function UnsubscribePage({ searchParams }: { searchParams: { t?: string } }) {
  const token = searchParams.t
  if (!token) return <div>Lien invalide</div>

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from('unsubscribe_tokens')
    .select('email, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .single()

  if (!tokenRow) return <div>Lien invalide ou expiré</div>
  if (tokenRow.used_at) return <div>Vous êtes déjà désabonné(e)</div>
  if (new Date(tokenRow.expires_at) < new Date()) return <div>Lien expiré</div>

  // Add to suppression
  await admin.from('suppression_list').insert({
    email: tokenRow.email,
    reason: 'unsubscribe',
    source: 'public_unsubscribe_link',
  })

  // Mark token used
  await admin.from('unsubscribe_tokens').update({
    used_at: new Date().toISOString()
  }).eq('token_hash', tokenHash)

  // Mark influencer
  await admin.from('influencers').update({
    unsubscribed: true,
    unsubscribed_at: new Date().toISOString(),
  }).eq('email', tokenRow.email)

  return <div>Vous avez été désabonné(e) avec succès.</div>
}
```

#### 5.3 Privacy hardening
- Crée env var `AFFILIATE_IP_PEPPER` (random secret)
- Helper `lib/admin/ip-hash.ts` : `sha256(ip + pepper)`
- À utiliser pour tout insert dans `affiliate_clicks`

#### 5.4 Trigger cleanup tokens expirés
Pas urgent, mais ajoute un Inngest scheduled job ou cron :
```sql
DELETE FROM unsubscribe_tokens
WHERE expires_at < now() - interval '30 days';
```

**Definition of done J5** :
- Tu génères un token, visites `/unsubscribe?t=<token>` → tu es ajouté à suppression_list
- URL ne contient JAMAIS d'email en clair
- Token expire après 1 an
- Token marqué `used_at` après utilisation

---

## 🗓️ JOUR 6 (Samedi) — Webhook Events Ingestion (Instantly)

**Objectif** : Recevoir webhooks Instantly avec idempotency. Pas tout traiter — juste les events critiques.

### Tâches

#### 6.1 Endpoint webhook
Fichier : `app/api/admin/webhooks/instantly/route.ts`

```typescript
export async function POST(req: NextRequest) {
  // Vérif signature Instantly si disponible (HMAC sur le payload)
  const payload = await req.json()
  const eventId = payload.id || payload.event_id || `${payload.event_type}_${payload.timestamp}`
  const eventType = payload.event_type
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')

  const admin = createAdminClient()

  // 1. INSERT FIRST avec ON CONFLICT DO NOTHING (idempotency)
  const { data: webhookEvent, error } = await admin
    .from('webhook_events')
    .insert({
      provider: 'instantly',
      event_id: eventId,
      event_type: eventType,
      payload,
      payload_hash: payloadHash,
      processing_status: 'processing',
    })
    .select()
    .single()

  if (!webhookEvent) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // 2. Process
  try {
    await processInstantlyEvent(admin, webhookEvent.id, eventType, payload)
    await admin.from('webhook_events').update({
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    }).eq('id', webhookEvent.id)
  } catch (err) {
    logger.error('[webhook/instantly]', err)
    await admin.from('webhook_events').update({
      processing_status: 'failed',
      error_message: String(err),
    }).eq('id', webhookEvent.id)
  }

  return NextResponse.json({ ok: true })
}
```

#### 6.2 Event processors — SEULEMENT 4 events pour Semaine 1
Fichier : `lib/admin/webhooks/instantly-processor.ts`

```typescript
export async function processInstantlyEvent(admin, webhookEventId, eventType, payload) {
  switch (eventType) {
    case 'email_sent':
      // INSERT email_events + update influencer.last_contacted_at
      break
    case 'email_replied':
      // INSERT email_messages (the reply) + INSERT email_events + update influencer.status='replied'
      break
    case 'email_bounced':
      // INSERT email_events + INSERT INTO suppression_list (reason='hard_bounce')
      break
    case 'email_unsubscribed':
      // INSERT email_events + INSERT INTO suppression_list (reason='unsubscribe')
      break
    default:
      // Stocké dans webhook_events mais pas processé — Semaine 2+
      break
  }
}
```

#### 6.3 Webhook health page
Fichier : `app/dashboard/admin/webhooks/page.tsx`

Vue simple :
- Liste les 100 derniers webhooks (sorted by received_at)
- Filter par provider / status / event_type
- Click row → voir payload + processed_at + error
- Retry button pour `failed`

#### 6.4 Configure Instantly
Va dans Instantly dashboard → Webhooks → ajoute :
- URL : `https://viralanimal.com/api/admin/webhooks/instantly`
- Events : email_sent, email_replied, email_bounced, email_unsubscribed

#### 6.5 Test end-to-end
1. Envoie un test email via Instantly à un email test
2. Vérifie : webhook_events row inséré (status='completed')
3. Vérifie : email_events row inséré (type='sent')
4. Reply au test
5. Vérifie : email_events row inséré (type='replied') + email_messages row inséré + influencer.status='replied'

**Definition of done J6** :
- Webhooks Instantly arrivent dans `webhook_events` (idempotent — duplicate ignored)
- Les 4 events (sent/replied/bounced/unsubscribed) sont processés
- Bounce hard → auto-ajout à suppression_list
- Unsubscribe → idem

---

## 🗓️ JOUR 7 (Dimanche) — Inbox Read-Only + Campaign Export Basic

**Objectif** : Voir les replies dans un inbox unifié + lancer une campagne basique avec export suppression-aware.

### Tâches

#### 7.1 Inbox page (READ-ONLY pour Semaine 1)
Fichier : `app/dashboard/admin/inbox/page.tsx`

Layout 2 colonnes :
- Gauche : liste threads (sorted by last_event_at DESC)
- Droite : thread détail

Filters :
- Unread / Read / All
- Star / No star
- By campaign

Thread list items :
- Influencer name + email
- Subject
- Last message preview (60 chars depuis `v_email_messages_safe`)
- Status badge
- Time ago

Thread detail :
- Timeline complète (sent + replies)
- Sidebar context influencer (status, lead score, tags)
- **PAS de composer** pour Semaine 1 (Semaine 2)

Actions disponibles :
- Mark as hot (tag)
- Star
- Archive
- Mark as read

#### 7.2 Campaign basic + recipients export
Fichier : `app/dashboard/admin/campaigns/page.tsx`

Liste des campaigns existantes (depuis `email_campaigns`).

Nouvelle campaign :
- Form : name, target_niche, target_platform_filter, mailbox_id
- Selectionner influencers à inclure (filter par status + niche + tags)
- Preview : "X influencers selected, Y suppressed, Z duplicates"
- Click "Export to Instantly" :
  - Filter via `suppression_list`
  - INSERT INTO `campaign_recipients` (one row per included influencer)
  - Generate CSV avec email + first_name + custom vars
  - Save snapshot dans storage (`/campaign-exports/{campaign_id}/recipients.csv`)
  - Display CSV download link
- (L'envoi réel se fait dans Instantly avec ce CSV — pas notre job pour Semaine 1)

Fichier : `app/api/admin/campaigns/[id]/export/route.ts`

```typescript
export async function POST(req, { params }) {
  await requireAdminRole('manage_campaigns')
  const campaignId = params.id

  // 1. Get selected influencers
  const { data: influencers } = await admin.from('influencers')
    .select('id, email, display_name, first_name')
    .in('id', selectedIds)
    .eq('unsubscribed', false)

  // 2. Filter via suppression
  const emails = influencers.map(i => i.email)
  const { data: suppressed } = await admin.from('suppression_list')
    .select('email').in('email', emails)
  const suppressedSet = new Set(suppressed.map(s => s.email))
  const allowed = influencers.filter(i => !suppressedSet.has(i.email))

  // 3. INSERT campaign_recipients
  const rows = allowed.map(i => ({
    campaign_id: campaignId,
    influencer_id: i.id,
    status: 'queued',
    sequence_step: 0,
  }))
  await admin.from('campaign_recipients').insert(rows)

  // 4. Generate CSV
  const csv = generateCSV(allowed)
  // Save to Supabase storage
  await admin.storage.from('campaign-exports').upload(
    `${campaignId}/recipients-${Date.now()}.csv`,
    csv,
    { contentType: 'text/csv' }
  )

  return NextResponse.json({
    total: influencers.length,
    suppressed: suppressedSet.size,
    exported: allowed.length,
    csv_url: '...',
  })
}
```

#### 7.3 Product activation events — instrumentation initiale
Ajoute les events critiques dans les flows existants :

**Signup** (existing flow) :
```typescript
// app/api/auth/callback/route.ts ou équivalent
await admin.from('product_activation_events').insert({
  user_id: user.id,
  event_name: 'user_signed_up',
  referred_by_influencer_id: getReferredId(req), // from cookie/fingerprint
})
```

**Render success** (existing) :
```typescript
// après le render successful
const { data: existing } = await admin.from('product_activation_events')
  .select('id')
  .eq('user_id', userId)
  .eq('event_name', 'first_render_completed')
  .limit(1)
  .single()

if (!existing) {
  await admin.from('product_activation_events').insert({
    user_id: userId,
    event_name: 'first_render_completed',
  })
}
```

**Platform connected** (existing OAuth callback) :
```typescript
// idempotent insert pour 'first_platform_connected'
```

#### 7.4 Test campaign export
1. Crée 100 influencers de test
2. Ajoute 10 d'entre eux à la suppression list
3. Crée une campagne avec target=tous
4. Export → result : 100 selected, 10 suppressed, 90 exported
5. CSV téléchargeable

**Definition of done J7** :
- Inbox affiche tous les replies (read-only)
- Tu peux créer une campagne et exporter une liste suppression-aware
- CSV généré et téléchargeable
- `campaign_recipients` rempli pour traçabilité
- Product activation events captent signup + first_render + first_platform_connected

---

## 🎯 Definition of Done — Semaine 1 complète

✅ Schema staging + prod migré avec toutes les tables v2.0 + v2.1
✅ Permissions explicites (capability-based), pas hiérarchie
✅ RPC functions pour les updates VA (no direct UPDATE)
✅ Ledger immuable + service_role only
✅ CITEXT pour email + retrait doublon index
✅ CRM influencers : list + detail + change status/notes/tags via RPC
✅ CSV import avec dedupe + suppression check + batch tracking
✅ Suppression list global + page admin + unsubscribe public token-based
✅ Webhook Instantly idempotent (4 events : sent/replied/bounced/unsubscribed)
✅ Inbox read-only avec body masqué pour VAs
✅ Campaign creation + export CSV suppression-aware
✅ `campaign_recipients` tracking
✅ Product activation events instrumentés (signup, first_render, first_platform_connected)

**= Fondation Semaine 1 prête. Tu peux importer 500-1000 leads et envoyer une campagne test propre via Instantly.**

---

## 🚨 Anti-Patterns à éviter cette semaine

1. ❌ Ne pas attacher attribution + commission ledger — c'est Semaine 2
2. ❌ Ne pas builder le reply composer — c'est Semaine 2
3. ❌ Ne pas intégrer Stripe payment ledger — c'est Semaine 2
4. ❌ Ne pas intégrer Claude AI — c'est Vague 2
5. ❌ Ne pas builder le dashboard affilié côté affilié — c'est Vague 2
6. ❌ Ne pas faire Stripe Connect onboarding — c'est Vague 2
7. ❌ Ne pas polish l'UI — focus features
8. ❌ Ne pas push prod avant que staging soit clean
9. ❌ Ne pas UPDATE direct sur influencers depuis le client — toujours via RPC
10. ❌ Ne pas INSERT direct dans commission_ledger — service_role only

---

## 📋 SEMAINE 2 PREVIEW (à planifier après J7)

À faire après Semaine 1 :

**J8-J10 — Attribution + Commission Ledger**
- `/r/[code]` redirect avec affiliate_clicks
- Cookie + fingerprint hash backup
- Signup attribution (cookie → profile.referred_by_influencer_id)
- Stripe webhook `invoice.payment_succeeded` → INSERT INTO commission_ledger
- Refund handler → clawback row

**J11-J12 — Reply Composer + Send**
- Composer dans inbox detail
- Send via Resend (transactional) ou Instantly API
- Track sent message dans email_messages

**J13-J14 — Campaign Sync + Polish**
- Push recipients vers Instantly via API (au lieu de CSV manuel)
- Webhook health UI polish
- Campaign analytics basique

---

## 🛑 Si tu bloques

| Problème | Solution |
|---|---|
| RLS smoke test fail | Check que `auth_role()` est dans schema `public` + SECURITY DEFINER |
| `is_owner()` retourne false pour mon user | Vérifier `INSERT INTO admin_users (user_id, role) VALUES (auth.uid(), 'owner')` exécuté en tant que ton user |
| Webhook ne reçoit rien | Tester avec ngrok local + curl manuel d'abord |
| CSV import slow (> 1000 rows) | Batch insert par 100, montrer progress |
| Cookie cross-domain pas set | `sameSite: 'lax'` + `secure: true` en prod uniquement |
| `citext` extension manque | `CREATE EXTENSION IF NOT EXISTS citext;` avant la migration |
| RPC retourne "permission denied" | Vérifier que la fonction est `SECURITY DEFINER` et que `can_*()` retourne TRUE pour ton role |

---

*Document version 2.0 — Mai 2026*
*Vague 1 Semaine 1 — Realistic & safe*
*Prochain doc : `WEEK-2-PLAN.md` (à créer à la fin de J7)*
