---
name: improve-system
description: Analyze recent sessions and reports, propose improvements in 3 buckets. Use /improve-system to trigger.
---

# Improve system skill

Read `docs/raw/sessions/` (recent session summaries) and `docs/prompts/REPORT/` (recent DoD reports). Propose improvements in 3 buckets:

## Bucket 1: auto-approve
Small fixes to docs, links, index, typos. Apply directly with a one-line changelog in `docs/wiki/decisions/YYYY-MM.md`. No human review needed.

## Bucket 2: needs-signoff
Bigger changes: new skill, CLAUDE.md edit, hook change, structure change. Write to `docs/prompts/REPORT/review-<date>.md`:

```markdown
# System improvement review — YYYY-MM-DD

## Proposals

### 1. <title>
**What**: description
**Why**: evidence from sessions/reports
**Risk**: what could go wrong

- [ ] approve
- [ ] reject
- [ ] approve & don't ask again
```

Do NOT apply these changes — wait for human review.

## Bucket 3: more-context
Questions for the founder. Ask via AskUserQuestion, don't guess.

## Rules
- Only propose improvements backed by evidence (a session summary, a report finding, a pattern across 2+ sessions)
- Never propose changes "because best practice" — only because something broke or was inefficient
- Max 5 proposals per run
