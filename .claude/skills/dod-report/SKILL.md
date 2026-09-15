---
name: dod-report
description: Write the mandatory Definition of Done report at end of task. Use /dod-report to trigger.
---

# DoD Report skill

Write to `docs/prompts/REPORT/<prompt-number-or-name>.md`:

## Format

```markdown
# DoD Report — <prompt title>
Date: YYYY-MM-DD

## Items

| # | Item | Status | Proof |
|---|------|--------|-------|
| 1 | ... | DONE | `command` → output |
| 2 | ... | NOT DONE | reason + what remains |
| 3 | ... | NOT VERIFIED | what to check + how |

## Files touched
- path/to/file.ts (new | modified | deleted)

## Migrations
- [ ] Applied: 20260914_name.sql — proven via information_schema

## Docs updated
- [ ] docs/wiki/system/<module>.md
- [ ] docs/wiki/decisions/<month>.md
- [ ] docs/index.md
```

Rules:
- DONE requires proof: command + output, SQL query + result, or screenshot
- NOT DONE requires: why + what remains to do
- NOT VERIFIED requires: what to check + exact command/query
- Never write "terminé" if NOT DONE is not empty
- End with: "update your memory files with what you learned about this codebase"
