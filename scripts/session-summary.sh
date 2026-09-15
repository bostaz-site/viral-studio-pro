#!/usr/bin/env bash
# Generate a session summary in docs/raw/sessions/
# Called by .claude/settings.json SessionEnd/PreCompact hook
set -euo pipefail

TIMESTAMP=$(date +%Y-%m-%d-%H%M)
OUT="docs/raw/sessions/${TIMESTAMP}.md"
mkdir -p docs/raw/sessions

{
  echo "# Session Summary — ${TIMESTAMP}"
  echo ""
  echo "## Files changed"
  echo '```'
  git diff --stat HEAD~5 2>/dev/null || git diff --stat 2>/dev/null || echo "(no changes)"
  echo '```'
  echo ""
  echo "## Recent commits"
  echo '```'
  git log --oneline -10 2>/dev/null || echo "(no commits)"
  echo '```'
  echo ""
  echo "## Decisions made"
  echo "*(fill in from context)*"
  echo ""
  echo "## TODO for next session"
  echo "*(fill in from context)*"
} > "$OUT"

echo "Session summary written to $OUT"
