---
name: update-docs
description: Update docs/wiki/ pages after code changes. Use /update-docs at end of task.
---

# Update docs skill

1. Identify which modules were changed (render, distribution, admin, platforms, scoring, crons)
2. Update the corresponding `docs/wiki/system/<module>.md` — keep ≤ 300 lines, oriented "how it works today"
3. If a product/technical decision was made, add a dated line to `docs/wiki/decisions/YYYY-MM.md`
4. Update `docs/index.md` if any new page was created or a TODO was resolved
5. Never copy-paste from SYSTEM-REFERENCE — compile and summarize
