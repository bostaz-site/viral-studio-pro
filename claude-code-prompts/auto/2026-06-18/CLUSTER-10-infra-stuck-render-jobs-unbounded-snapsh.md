# Fix: Infra — stuck jobs, snapshot cleanup, SDK vuln, Twitch watermark, format copy

## Context
Multiple infrastructure issues compound: 5 render jobs are stuck with no timeout, clip_snapshots grows unboundedly (406K rows), the Anthropic SDK has a known sandbox escape vulnerability, Twitch watermarks reduce cross-platform distribution, and the upload page shows conflicting format lists.

## Files to modify
- `src/workers/renderWorker.ts` or `src/jobs/renderJob.ts` — add timeout/watchdog
- `src/jobs/cleanup.ts` — create snapshot cleanup job
- `package.json` — upgrade @anthropic-ai/sdk
- `src/pages/upload.tsx` — fix format copy
- `src/render/watermark.ts` — add watermark detection/removal
- Database migration file — add index and cleanup query

## Steps
1. **Stuck jobs timeout**: Add a 30-minute timeout to render jobs. If a job has been in 'processing' state for >30 min, mark it as 'failed' with reason 'timeout' and notify the user. Run an immediate one-off fix: `UPDATE render_jobs SET status='failed', failure_reason='timeout' WHERE status='processing' AND updated_at < NOW() - INTERVAL '1 hour'`. Add monitoring alert if stuck_jobs > 2.
2. **Snapshot cleanup**: Add a nightly cron job: `DELETE FROM clip_snapshots WHERE created_at < NOW() - INTERVAL '30 days'`. Add an index on `clip_snapshots.created_at` if missing. Log rows deleted.
3. **SDK vulnerability**: Run `npm audit fix` or manually upgrade `@anthropic-ai/sdk` to the version that patches GHSA-5474-4w2j-mq4c. If Memory Tool is in use, disable it until patch is confirmed.
4. **Format copy mismatch**: In the upload page, find the two format strings (dropzone: 'MP4, MOV, MKV, AVI, WebM' vs footer: 'MP4, MOV'). Consolidate to a single source of truth — create a constant `ACCEPTED_FORMATS` and reference it in both places. Verify which formats the backend actually supports and use that as the canonical list.
5. **Twitch watermark**: Add a post-render step that detects platform watermarks (Twitch logo in bottom-left corner) and either crops them out or overlays a branded element. For v1, add a 5% bottom crop to clip away the watermark zone when source is detected as a Twitch clip (check clip URL or metadata).
6. **Test**: Assert render jobs older than 30min are auto-failed. Assert snapshot cleanup deletes old rows. Assert npm audit shows no high/critical vulns for @anthropic-ai/sdk. Assert upload page format strings match.

## Definition of Done
- Stuck render jobs auto-fail after 30 minutes with user notification
- clip_snapshots has a 30-day retention policy with nightly cleanup
- @anthropic-ai/sdk upgraded past GHSA-5474-4w2j-mq4c
- Upload page shows one consistent accepted-formats list
- Twitch watermark cropped or masked on cross-platform exports

## Commit message
```
fix(infra): add render job timeout, snapshot cleanup, patch SDK vuln, fix format copy, handle watermarks
```