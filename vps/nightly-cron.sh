#!/usr/bin/env bash
# Nightly audit cron script for Railway VPS
#
# Add to crontab on Railway:
#   0 6 * * * /app/vps/nightly-cron.sh >> /var/log/nightly-audit.log 2>&1
#
# This is the PREFERRED approach over Netlify Functions because:
# - No 26s timeout limit (free) / 5min (paid)
# - Full Node.js environment with Playwright support
# - Can run agents sequentially without serverless constraints

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting nightly audit"

cd "$PROJECT_DIR"

# Run the orchestrator
npx tsx scripts/audits/run-nightly.ts

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Nightly audit finished"
