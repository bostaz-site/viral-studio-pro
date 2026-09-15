# DoD Report — cold-email-v2 (2026-09-15)

## Summary

11 stories implemented. All verify commands pass. All migrations applied in prod before code.

## Stories

| ID | Title | Status | Proof |
|---|---|---|---|
| S1 | Migration: v2 columns | DONE | 8 columns verified via information_schema, `MIGRATION_FILE_OK` |
| S2 | Seed 5-step cold-v2 | DONE | 5 rows in prod, `SEED_OK 10` |
| S3 | create-sequence v2 rules | DONE | `npx tsc --noEmit` clean, trackOpens/trackClicks grep match |
| S4 | Sync DFY mailboxes | DONE | `reception_only` grep match, tsc clean |
| S5 | Reply buckets + classifier | DONE | `resequence_after` grep match, `DUP_ROUTE_REMOVED` |
| S6 | Resequence cron | DONE | `timingSafeCompare` grep match, registered in netlify.toml |
| S7 | Positive-reply rate metric | DONE | `positive_reply_rate_pct` grep match, UI updated |
| S8 | Compliance preflight v2 | DONE | `PREFLIGHT_5_PASS` (5/5 steps pass) |
| S9 | Spike trigger | DONE | `spike` grep match, imported in rescore-clips |
| S10 | Admin inbox demo kit | DONE | `Send demo kit` grep match in thread-detail |
| S11 | Docs + DoD | DONE | This file + outreach.md + cold-email-v2.md + index updated |

## Migrations Applied

1. `20260915120000_cold_email_v2.sql` — 8 columns across 4 tables
2. `20260915130000_cold_email_v2_seed.sql` — 5-step sequence + unique index on name

## Commits

- `1cef5b3` S1 migration
- `7b6b954` S2 seed
- `9098ced` S3 create-sequence
- `07df8a4` S4 sync mailboxes
- `555e9ac` S5 reply buckets
- `b576599` S6 resequence cron
- `d4796fa` S7 positive-reply metric
- `be0adf4` S8 compliance preflight
- `a7121ef` S9 spike trigger
- `56e0b86` S10 demo kit
- `5b140b0` S11 docs + DoD

## Post-merge corrections

- Step 2: removed invented stat "10x the views" (0 clients = 0 data). Replaced with "the same format the big clipping accounts use."
- Step 4: removed fake give-to-receive (pretending clip was already cut). Replaced with honest ask: "Send me the link to your last stream and I'll cut one clip tonight."
- Both updated in migration seed SQL, docs/wiki/plans/cold-email-v2.md, and prod via UPDATE email_templates.
- Compliance re-verified: 5/5 PASS (step 2: 55 words, step 4: 26 words).
- crons.md: added "Who triggers crons" section (cron-job.org), added resequence-leads as NOT VERIFIED (not yet in scheduler).

### Open items

| Item | Status |
|---|---|
| resequence-leads added in cron-job.org | NOT VERIFIED — needs manual setup in cron-job.org dashboard |
