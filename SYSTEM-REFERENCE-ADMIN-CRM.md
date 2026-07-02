# SYSTEM REFERENCE — Admin CRM

> Technical reference for the Viral Animal Admin CRM module.

---

## Import CSV

### Overview
Bulk import influencers from CSV files into the CRM. Supports drag & drop upload, interactive column mapping, preview/validation, and batch processing with compliance checks.

### User Flow
1. **Upload** — Drag & drop or file picker (max 10 MB, `.csv` only)
2. **Parse** — Client-side parsing with Papaparse, auto-detect column mapping
3. **Map** — Interactive column mapper with sample data preview
4. **Preview** — Shows first 10 rows, valid/invalid counts, validation errors
5. **Import** — POST to API, processes in batches of 100 rows
6. **Result** — Summary: imported / duplicates / suppressed / failed

### Pages
| Route | File | Description |
|-------|------|-------------|
| `/admin/influencers/import` | `app/(dashboard)/admin/influencers/import/page.tsx` | CSV import wizard |
| `/admin/influencers/imports` | `app/(dashboard)/admin/influencers/imports/page.tsx` | Import batch history |
| `/admin/influencers/imports/[id]` | `app/(dashboard)/admin/influencers/imports/[id]/page.tsx` | Batch detail view |

### Components
| File | Description |
|------|-------------|
| `import/_components/csv-uploader.tsx` | Drag & drop file upload (react-dropzone) |
| `import/_components/column-mapper.tsx` | Interactive CSV header → field mapping |
| `import/_components/import-preview.tsx` | Data preview table + validation errors |
| `import/_components/import-progress.tsx` | Progress bar + live counters |
| `import/_components/import-result.tsx` | Final result summary with actions |

### API Routes
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/admin/influencers/import` | Bulk import influencers |
| `GET` | `/api/admin/influencers/import?batchId=X` | Get batch status (polling) |
| `GET` | `/api/admin/influencers/import/batches` | List all import batches |
| `GET` | `/api/admin/influencers/import/batches?id=X` | Get single batch detail |

### Library
| File | Description |
|------|-------------|
| `lib/admin/csv-parser.ts` | Zod schema, auto-detect mapping, apply mapping |

### Import Logic (API Route)
1. Auth check via `withAdmin` middleware
2. Validate rows with Zod schema
3. Create `import_batches` row (status=`processing`)
4. Process in batches of 100:
   - Check `suppression_list` (batch query by email)
   - Upsert into `influencers` with `ON CONFLICT (email) DO NOTHING`
   - Track counters: imported, duplicate, suppressed, failed
   - Update `import_batches` row progressively
5. Mark batch `completed` / `partial` / `failed`

### Mappable Fields
| Field | Required | Auto-detect patterns |
|-------|----------|---------------------|
| `email` | Yes | email, e-mail, contact_email |
| `first_name` | No | first_name, fname, prenom |
| `last_name` | No | last_name, lname, nom, surname |
| `primary_platform` | No | platform, network |
| `platform_handle` | No | handle, username |
| `audience_size` | No | audience_size, followers, subscribers |
| `niche` | No | niche, category, genre |
| `country` | No | country, location |
| `language` | No | language, lang |
| `tags` | No | tags, labels (comma-separated) |

### Database Tables

**`influencers`** — Main CRM table
- Migration: `supabase/migrations/20260511_influencers_crm.sql`
- Email is UNIQUE (case-sensitive in DB, lowercased on insert)
- Status pipeline: unqualified → cold → queued → contacted → ... → paying
- RLS enabled, admin-only via service role

**`import_batches`** — Import tracking
- Migration: `supabase/migrations/20260511_influencers_crm.sql`
- Counters: rows_total, rows_imported, rows_skipped_duplicate, rows_skipped_suppression, rows_failed
- Status: processing → completed / partial / failed
- Errors stored as JSONB array (capped at 100)

**`suppression_list`** — Compliance check
- Migration: `supabase/migrations/20260513_suppression_list.sql`
- Checked before every import (emails in suppression list are skipped)

### Dependencies
- `papaparse` — Client-side CSV parsing
- `react-dropzone` — Drag & drop file upload
- `zod` — Row validation
- `@supabase/supabase-js` — Database access (service role for API)

### Anti-Patterns Avoided
- Batch INSERT (100 rows at a time, not 1-by-1)
- Suppression check before every import (compliance)
- Non-blocking UI (import runs server-side, result returned)
- Batch status always tracked (never lost)
