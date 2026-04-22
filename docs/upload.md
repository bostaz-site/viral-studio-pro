# Upload

## Description

Users can upload their own video clips for enhancement. The upload page provides a drag-and-drop zone, validates file type and size, uploads to Supabase Storage, creates a `videos` record, and redirects to the enhance page.

## SQL Tables

### `videos`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK -> profiles.id |
| title | TEXT | |
| description | TEXT | |
| source_url | TEXT | |
| source_platform | TEXT | |
| storage_path | TEXT | Path in Supabase Storage `videos/` bucket |
| mime_type | TEXT | e.g. 'video/mp4' |
| duration_seconds | INTEGER | |
| file_size_bytes | BIGINT | |
| error_message | TEXT | |
| status | TEXT | 'uploaded' / 'processing' / 'transcribing' / 'analyzing' / 'clipping' / 'done' / 'error' |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

## API Routes

### `POST /api/upload`

Protected via `withAuth`. Max duration: 60s.

**Request**: Multipart form data
- `file` -- Video file (required)
- `title` -- String (optional, defaults to "Untitled clip")

**Validations**:
- File type: MP4, MOV, MKV, AVI, WebM
- File size: max 500 MB

**Flow**:
1. Parse multipart form data
2. Validate file type and size
3. Generate storage path: `{user_id}/{timestamp}.{ext}`
4. Upload to Supabase Storage `videos/` bucket
5. Create `videos` record in database
6. On DB error: clean up uploaded file from storage

**Response** (201):
```json
{
  "data": { "id": "uuid", "title": "...", "storage_path": "...", "status": "uploaded", "created_at": "..." },
  "error": null,
  "message": "Video uploaded successfully"
}
```

## UI Components

### Upload Page (`app/(dashboard)/dashboard/upload/page.tsx`)

Client component with:
- Drag-and-drop zone (using `react-dropzone`)
- File info display (name, size)
- Title input (auto-filled from filename)
- Upload progress bar (simulated)
- Success state with "Enhance this clip" CTA -> `/dashboard/enhance/{videoId}?source=upload`
- Error display
- "Browse trending clips instead" alternative link

**Accepted formats**: `.mp4`, `.mov`, `.mkv`, `.avi`, `.webm`
**Max file size**: 500 MB

## Key Files

| File | Role |
|------|------|
| `app/(dashboard)/dashboard/upload/page.tsx` | Upload UI |
| `app/api/upload/route.ts` | Upload API handler |

## User Flow

1. User navigates to `/dashboard/upload`
2. Drags or selects a video file
3. Optionally edits the title
4. Clicks "Upload & enhance"
5. File is uploaded to Supabase Storage
6. Video record is created in the database
7. Success screen shows "Enhance this clip" button
8. User clicks through to enhance page at `/dashboard/enhance/{videoId}?source=upload`

## Technical Notes

- Storage path format: `{userId}/{timestamp}.{extension}`
- On database insert failure, the uploaded file is deleted from storage (cleanup)
- Upload progress is simulated client-side (no real XHR progress tracking)
- The `videos` table serves as the source for user-uploaded clips in the render flow
- When rendering user-uploaded clips, the API generates a signed URL from Supabase Storage for the VPS to download
