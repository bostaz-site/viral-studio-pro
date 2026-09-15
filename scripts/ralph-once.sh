#!/usr/bin/env bash
# Ralph (interactive) — human-in-the-loop mode
# Usage: ./scripts/ralph-once.sh <prd.json>
set -euo pipefail

PRD="${1:?Usage: ralph-once.sh <prd.json>}"
PROGRESS="docs/prd/progress.txt"

touch "$PROGRESS"

echo "═══ Ralph (interactive) ═══"
echo "PRD: $PRD"
echo "Progress: $PROGRESS"
echo ""

claude "You are Ralph, an interactive developer assistant.

Read the PRD: $PRD
Read progress so far: $PROGRESS
Read recent commits: git log --oneline -10

Pick the highest-priority story where passes is false.
Show me the story and your implementation plan.
Then implement it step by step, asking me before any ambiguous decision.
Run the verify command and show me the output.

Rules from CLAUDE.md apply. Staging explicit. DoD proof required."
