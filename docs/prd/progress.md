S1 DONE — Migration 20260915120000_cold_email_v2.sql applied: 8 columns across 4 tables (email_templates, influencers, email_campaigns, mailboxes) verified in prod
S2 DONE — Seed 20260915130000_cold_email_v2_seed.sql: 5 steps (day 0/3/7/12/20), spintax step 1, CASL footer all, no URL step 1/2/4/5, demo link step 3 only
S3 DONE — create-sequence v2: zod schema in lib/schemas/cold-email.ts, trackOpens OFF all, trackClicks step 3 only, dailyLimit 12, stopOnAutoReply false, America/Toronto, blocked viralanimal.com+zoho
S4 DONE — syncMailboxes: DFY→google/12, Zoho→reception_only/0, warmup_score<70→pause+Discord, mailbox-table warmup column + reception only badge
S5 DONE — Reply buckets: Haiku classifier→6 buckets, not_now→resequence_after+60d+dormant+remove, wrong_person→notes, unsubscribed→suppression 4-way, dup admin route deleted, zod validation
S6 DONE — Cron resequence-leads: daily, CRON_SECRET+timingSafeCompare, not_now+resequence_after<=today→cold, suppression/bounce/unsub guard, tag 'resequenced', registered in netlify.toml
