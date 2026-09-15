#!/usr/bin/env bash
# Ralph — automated PRD executor
# Usage: ./scripts/ralph.sh <prd.json> [max_iterations]
set -euo pipefail

PRD="${1:?Usage: ralph.sh <prd.json> [max_iter]}"
MAX_ITER="${2:-10}"
PROGRESS="docs/prd/progress.txt"

touch "$PROGRESS"

for i in $(seq 1 "$MAX_ITER"); do
  echo "═══ Ralph iteration $i/$MAX_ITER ═══"

  claude -p "You are Ralph, an autonomous developer.

Read the PRD: $PRD
Read progress so far: $PROGRESS
Read recent commits: git log --oneline -20

Pick the highest-priority story where passes is false.
Implement it. Run the verify command. If it passes:
1. Set passes: true in the PRD JSON
2. Append a line to $PROGRESS: [$(date -Iseconds)] S<id> — <title> — DONE
3. Commit: feat(<feature>): <story title>

If ALL stories pass, write <promise>COMPLETE</promise> and stop.
If verify fails, fix and retry once. If still failing, append FAILED to progress and move to next story.

Rules from CLAUDE.md apply. Staging explicit. DoD proof required."

  # Check if COMPLETE was signaled
  if grep -q "COMPLETE" "$PROGRESS" 2>/dev/null; then
    echo "═══ Ralph: ALL STORIES COMPLETE ═══"
    exit 0
  fi
done

echo "═══ Ralph: max iterations reached ═══"
exit 1
