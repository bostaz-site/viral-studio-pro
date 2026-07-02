# SYSTEM REFERENCE -- Admin Video Library (v1)

> Source de verite pour la bibliotheque de videos pub admin.
> Derniere mise a jour : 2026-05-13.

---

## Architecture

| Fichier | Role |
|---|---|
| `lib/admin/video-library/upload.ts` | Supabase Storage signed URL generation, path helpers |
| `lib/admin/video-library/metadata.ts` | Client-side video metadata extraction + thumbnail generation |
| `app/api/admin/video-library/upload/route.ts` | POST: get signed upload URL for direct upload |
| `app/api/admin/video-library/route.ts` | GET: list videos with filters, POST: create video record |
| `app/api/admin/video-library/[id]/route.ts` | GET: detail with signed URLs, PUT: update tags, DELETE: archive |
| `app/api/admin/video-library/[id]/assets/route.ts` | GET: list assets, POST: add asset |
| `app/api/admin/video-library/[id]/performance/route.ts` | GET: daily performance data |
| `app/(dashboard)/admin/video-library/page.tsx` | Grid view with filters + upload dialog |
| `app/(dashboard)/admin/video-library/_components/video-card.tsx` | Card component with thumbnail, tags, performance |
| `app/(dashboard)/admin/video-library/_components/upload-dialog.tsx` | Upload flow: select -> upload -> metadata -> save |
| `app/(dashboard)/admin/video-library/_components/tag-editor.tsx` | Inline niche/hook/tone/language editor |
| `app/(dashboard)/admin/video-library/[id]/page.tsx` | Detail page: video player, metadata, performance, tag editor |

---

## Upload Pipeline

```
1. Admin clicks "Upload Video"
   -> UploadDialog opens

2. File selected (drag-drop or click)
   -> Client extracts metadata (duration, dimensions, aspect_ratio) via <video> element
   -> POST /api/admin/video-library/upload { filename }
   -> Returns signed upload URL from Supabase Storage

3. Direct upload to Supabase Storage
   -> PUT signed URL with file body
   -> Progress tracking

4. Client generates thumbnail
   -> <canvas> capture at 1 second
   -> Upload thumbnail via separate signed URL

5. Metadata form
   -> Title, description, niches (multi-select), hook_type, tone, language

6. POST /api/admin/video-library
   -> Creates promo_videos record with storage_path, thumbnail_path, metadata, tags
```

---

## Supabase Storage

Bucket: `promo-videos`

Structure:
```
promo-videos/
  originals/     -- HD source videos
  thumbnails/    -- Auto-generated thumbnail WebP
```

All access via signed URLs (never expose storage_path to client directly).

---

## Database Tables

### `promo_videos`
```
id, title, description,
storage_path, storage_bucket, thumbnail_path,
duration_seconds, width, height, aspect_ratio, codec, file_size_bytes,
niche TEXT[] (GIN indexed), hook_type, tone, language,
status (active/paused/archived), replaces_video_id,
total_kits_generated, total_views, total_posts, total_signups, avg_engagement_rate,
created_at, created_by, updated_at
```

### `promo_video_assets`
```
id, promo_video_id (FK), asset_type (hd/mobile/square/gif_preview/thumbnail),
storage_path, file_size_bytes, created_at
```

### `promo_video_performance_daily`
```
id, promo_video_id (FK), date (UNIQUE with video),
kits_generated, kit_views, video_completions, code_copies,
posts_submitted, signups_attributed, revenue_cents
```

---

## Tag Taxonomy

### Niches (TEXT[], multi-select)
ai_tools, productivity, gaming, creator_tools, side_hustle,
app_reviews, editing, streaming, business, education

### Hook Types (single select)
curiosity, shock, transformation, social_proof,
storytelling, tutorial, comparison, testimonial

### Tones (single select)
casual, professional, funny, inspirational, edgy

### Languages
en, fr, es, pt

---

## UI Pages

### /admin/video-library (Grid View)
```
Header: Film icon + "Video Library" + counts (active/total) + Upload button
Filters: Status tabs (Active/Paused/Archived/All) + Niche dropdown + Search
Grid: 4 columns desktop, 2 mobile
Cards: Thumbnail (hover play icon) + duration badge + title + niche tags + hook badge + performance mini stats
Actions: View detail, Pause/Activate, Archive (via menu)
```

### /admin/video-library/[id] (Detail View)
```
Left (2/3): Video player + metadata grid (duration, resolution, aspect, size) + 30-day performance
Right (1/3): Tag editor (niches, hook, tone, language) + Status display
Actions: Pause/Activate, Archive
Performance: Kits, Views, Posts, Signups, Revenue
```

---

## API Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/video-library/upload` | POST | Get signed upload URL |
| `/api/admin/video-library` | GET | List with filters (status, niche, hook_type, search, page) |
| `/api/admin/video-library` | POST | Create video record after upload |
| `/api/admin/video-library/[id]` | GET | Detail with signed URLs + assets + performance |
| `/api/admin/video-library/[id]` | PUT | Update metadata/tags |
| `/api/admin/video-library/[id]` | DELETE | Archive (soft delete) |
| `/api/admin/video-library/[id]/assets` | GET | List assets with signed URLs |
| `/api/admin/video-library/[id]/assets` | POST | Add asset |
| `/api/admin/video-library/[id]/performance` | GET | Daily performance (last N days) |

---

## Anti-Patterns (DO NOT)

- Upload video via POST body (use signed URL for direct upload)
- Expose storage_path to client (always use signed URLs)
- Hard-delete videos (archive only -- referenced by repost_kit_sessions)
- Limit to 1 niche per video (TEXT[] = multi-select)
- Skip thumbnail generation (critical for grid UX)
- Store thumbnail as base64 (use Supabase Storage)

---

## Performance Tracking

Performance data is aggregated daily in `promo_video_performance_daily`.
Denormalized totals on `promo_videos` (total_kits_generated, total_views, etc.)
are updated periodically for fast grid rendering.

Metrics tracked:
- kits_generated: repost kits created with this video
- kit_views: total views of kits using this video
- video_completions: users who watched 100% in the kit
- code_copies: promo code copies from kits
- posts_submitted: post URLs submitted via kits
- signups_attributed: signups tracked back to this video
- revenue_cents: commission revenue attributed

---

## Systemes connexes

| Systeme | Relation |
|---|---|
| **MATCH-ENGINE** | Consomme les promo_videos pour matcher avec les influencers (scoring 5 facteurs) |
| **REPOST-KIT** | Reference promo_video_id dans repost_kit_sessions (le kit affiche la video assignee) |
| **OFFER-GENERATOR** | Lie les offres generees au promo_video_id pour personnaliser l'email |
| **Production** | 0 videos actuellement — voir PLAN-VIDEOS-PROMO cote founder pour le plan de production |

---

*Document version 1.1 -- Juillet 2026*
