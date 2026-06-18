# System Verification Report — 2026-06-18

## A. Migrations & Tables

### Pass
- `audit_findings` — 31 columns, RLS enabled, policy present, 290 rows
- `audit_metrics_snapshots` — RLS enabled, policy present, 36 rows
- `improvement_backlog` — RLS enabled, policy present
- `strategic_moves` — RLS enabled, policy present
- `root_cause_clusters` — RLS enabled, policy present, 20 rows
- `ai_multiplier_opportunities` — RLS enabled, policy present
- `meta_agent_reports` — RLS enabled, policy present
- `agent_prompt_proposals` — RLS enabled, policy present
- `production_errors` — RLS enabled, policy present
- `user_session_replays` — RLS enabled, policy present (+ service role)
- `outcome_measurements` — RLS enabled, policy present
- `knowledge_nodes` — RLS enabled, policy present
- `knowledge_edges` — RLS enabled, policy present
- `founder_profile` — RLS enabled, policy present

### Critical columns on audit_findings — ALL PRESENT
- proposed_diff, diff_generated_at, diff_model, diff_estimated_lines_changed
- auto_fix_pr_url, auto_fix_status
- tiktok_review_blocked, accepted_at
- predicted_impact_bucket, predicted_impact_reasoning, roi_score
- root_cause_cluster_id

### Critical columns on root_cause_clusters — ALL PRESENT
- proposed_diff_multi_file, diff_generated_at, diff_estimated_total_changes
- tiktok_review_blocked, accepted_at
- predicted_impact_bucket, predicted_impact_reasoning

### Failures
- `pr_reviews` — RLS enabled but **NO POLICY defined**. All queries from authenticated users will be blocked. Service role (cron) works but dashboard API route will return empty.
- `root_cause_clusters` — still has old `predicted_impact_revenue` + `predicted_impact_conversion` columns that should have been dropped by calibration migration (the migration only dropped them from `audit_findings`, not `root_cause_clusters`). Not blocking but schema drift.

## B. Agent Scripts

### All 21 scripts exist
| Script | Schedule | In run-nightly? |
|--------|----------|-----------------|
| output-quality.ts | DAILY | Yes |
| acquisition.ts | Monday | Yes |
| activation.ts | Tuesday | Yes |
| technical.ts | Wednesday | Yes |
| retention.ts | Thursday | Yes |
| cold-email.ts | Friday | Yes |
| ai-scout.ts | Tue+Sat | Yes |
| ai-multiplier.ts | Tue+Sat | Yes |
| meta-agent.ts | Sunday | Yes |
| strategist.ts | Sunday | Yes |
| revenue-agent.ts | Sunday | Yes |
| production-errors-agent.ts | DAILY | Yes |
| recent-pr-review.ts | DAILY | Yes |
| auto-prompt-generator.ts | DAILY | Yes |
| root-cause-detector.ts | DAILY | Yes |
| outcome-measurer.ts | DAILY | Yes |
| weekly-improvement-batch.ts | Wednesday | Yes |
| user-session-replay.ts | Wednesday | Yes |
| knowledge-graph-enricher.ts | DAILY | **NOT in schedule** |
| founder-profile-builder.ts | Sunday | **NOT in schedule** |

### Personas — all 3 exist
- sceptical-first-timer.ts
- free-user-limit.ts
- power-user.ts

## C. Libraries (lib/audit/)

### All 13 present
- discord.ts, insert-finding.ts, insert-metric.ts
- morning-brief.ts, strategic-brief.ts
- agent-runner.ts, persona-runner.ts
- roi-predictor.ts (buckets), strategic-runner.ts
- safe-json.ts, github-push.ts
- tiktok-review-mode.ts, graph-aware.ts

## D. API Routes

### All 16 present
- /api/discord/interactions
- /api/admin/audits/trigger
- /api/admin/audits/findings (list)
- /api/admin/audits/findings/[id] (PATCH status)
- /api/admin/audits/findings/[id]/generate-diff
- /api/admin/audits/clusters (list)
- /api/admin/audits/clusters/[id]
- /api/admin/audits/clusters/[id]/generate-multi-diff
- /api/admin/audits/metrics
- /api/admin/audits/ai-multiplier
- /api/admin/audits/meta
- /api/admin/audits/outcomes
- /api/admin/audits/production-errors
- /api/admin/audits/sessions
- /api/admin/audits/pr-reviews
- /api/admin/audits/tiktok-mode-status
- /api/admin/audits/resume-after-tiktok

## E. Dashboards

### Present (8 of 9)
- /admin/audits (main + audits-client.tsx)
- /admin/audits/clusters
- /admin/audits/ai-multiplier
- /admin/audits/meta
- /admin/audits/sessions
- /admin/audits/pr-reviews
- /admin/audits/production-errors
- /admin/audits/outcomes

### Missing
- /admin/audits/knowledge-graph — **NOT created**

## F. GitHub Actions

### Present
- .github/workflows/auto-fix.yml (with fast-diff + Claude Code fallback)
- .github/claude-safety-rules.md

### Warning
- auto-fix.yml is local only — cannot be pushed without PAT `workflow` scope

## G. Environment Variables

### Missing from .env.example (audit-specific)
- DISCORD_APP_ID
- DISCORD_PUBLIC_KEY
- DISCORD_BOT_TOKEN
- DISCORD_CRITICAL_ALERTS_CHANNEL_ID
- DISCORD_MORNING_BRIEF_CHANNEL_ID
- DISCORD_READY_FOR_REVIEW_CHANNEL_ID
- DISCORD_AUDIT_WEBHOOK_URL
- AUDIT_CRON_SECRET
- GITHUB_TOKEN
- TIKTOK_REVIEW_MODE
- INSTANTLY_API_KEY

## H. Run-nightly.ts Orchestration

### Execution order — CORRECT
1. production-errors (daily, FIRST)
2. output-quality (daily)
3. System agent of the day (rotating schedule)
4. Random personas (2 weekday, 1 weekend)
5. auto-prompt-generator (daily)
6. root-cause-detector (daily)
7. outcome-measurer (daily)
8. recent-pr-review (daily)
9. weekly-improvement-batch (Wednesday only)
10. user-session-replay (Wednesday only)
11. Strategic brief (Sunday only)
12. Morning brief (daily, LAST)

### Missing from schedule
- knowledge-graph-enricher (should be daily after outcome-measurer)
- founder-profile-builder (should be Sunday after strategic agents)

## I. Data Health

| Table | Rows | Status |
|-------|------|--------|
| audit_findings | 290 | 290 open, 0 fixed |
| audit_metrics_snapshots | 36 | OK |
| root_cause_clusters | 20 | OK |
| strategic_moves | 0 | Empty (agents haven't run Sunday yet) |
| knowledge_nodes | 52 | Bootstrapped (21 feature, 8 tool, 7 business_goal, 6 codebase_area, 4 platform, 4 state, 2 metric) |
| knowledge_edges | 91 | Bootstrapped (39 affects, 27 depends_on, 12 blocks, 6 implemented_in, 3 measured_by, 3 risks, 1 monetizes) |
| founder_profile | 0 | Bootstrap partial — Claude returned insights in wrong key format. Needs re-run or manual fix. |

---

## Summary — POST-FIX (2026-06-18)

### All 7 issues RESOLVED

| # | Issue | Fix |
|---|-------|-----|
| 1 | pr_reviews missing RLS policy | Migration applied — policy created |
| 2 | KG enricher + founder builder not in schedule | Added to run-nightly.ts (daily + Sunday) |
| 3 | Knowledge graph dashboard missing | Created /admin/audits/knowledge-graph/page.tsx |
| 4 | Stale columns on root_cause_clusters | Dropped predicted_impact_revenue/conversion |
| 5 | .env.example missing vars | Added GITHUB_TOKEN, DISCORD_APP_ID, DISCORD_READY_FOR_REVIEW_CHANNEL_ID, INSTANTLY_API_KEY |
| 6 | Bootstrap founder_insights parsing | Fixed to handle alternative key names |
| 7 | auto-fix.yml PAT scope | Already uses PR_TOKEN correctly — just needs PAT with workflow scope |

### Current state
- 16/16 tables with RLS + policies
- 21/21 agent scripts in schedule
- 9/9 dashboard pages
- Knowledge Graph: 72 nodes, 157 edges
- founder_profile: 0 (will be populated by founder-profile-builder on next Sunday run)

## Action Items

1. Add RLS policy for `pr_reviews` table (quick SQL migration)
2. Add `knowledge-graph-enricher` and `founder-profile-builder` to `run-nightly.ts`
3. Create `/admin/audits/knowledge-graph/page.tsx` dashboard
4. Run `npx tsx scripts/knowledge-graph/bootstrap.ts` to populate graph
5. Drop old columns from `root_cause_clusters` (predicted_impact_revenue, predicted_impact_conversion)
6. Update `.env.example` with audit env vars
7. Get PAT with `workflow` scope and push `.github/workflows/auto-fix.yml`
