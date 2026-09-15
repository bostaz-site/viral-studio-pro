# DoD Report — 25-setup-claude
Date: 2026-09-14

## Items

| # | Item | Status | Proof |
|---|------|--------|-------|
| 1 | docs/ structure + archive root .md | DONE | 60 files moved/created. `ls *.md` → CLAUDE.md, README.md, AGENTS.md only. 27 SYSTEM-REFERENCE via git mv (history preserved). |
| 2 | CLAUDE.md ≤80 lines | DONE | `wc -l CLAUDE.md` → 48 lines. 4 sections: project, style, commands, rules. @imports to docs/wiki/. |
| 3 | founder.md from interview | DONE | 6 questions asked via AskUserQuestion, answers recorded verbatim, compiled to docs/about/founder.md (~100 lines). |
| 4 | Skills (6) + hooks + reviewer agent | DONE | .claude/skills/: migration, dod-report, update-docs, render-test, add-resource, cold-email-compliance. .claude/settings.json: PreToolUse blocks git add -A etc., PostToolUse runs tsc. .claude/agents/reviewer.md. |
| 5 | Ralph PRD format + scripts + PRD 24 | DONE | docs/prd/README.md (format spec), scripts/ralph.sh + ralph-once.sh, docs/prd/24-distribution.json (8 stories). |
| 6 | CI minimal | DONE | .github/workflows/ci.yml: 4 jobs (typecheck, build, vps-check, db-drift). No secrets needed. |
| 7 | Nettoyage léger | DONE | Removed __p5_tmp_test.ts, vps/lib/__pycache__/. __pycache__ already in .gitignore. |
| 8 | Vérification | DONE | tsc: 0 errors. node --check VPS: OK. CLAUDE.md: 48 lines. Root: 3 .md only. |

## NOT DONE
- Wiki pages (docs/wiki/system/*.md) marked TODO in index.md — need compilation from raw/system-reference/
- docs/wiki/decisions/ not seeded — REVUE-ORGANISATION and SYNTHESE-VEILLE raw files not provided
- docs/wiki/plans/ not populated — PLAN-30-JOURS not provided
- Hook tests not demonstrated (hooks require interactive session restart to activate)
- mattpocock/skills and Context7 MCP not installed (require CLI commands outside this session)
- improve-system skill not created (specified but lower priority)
- SessionStart/Stop/PreCompact hooks not implemented (require shell scripts + session management)

## Files touched
- CLAUDE.md (rewritten from 585→48 lines)
- AGENTS.md (synced copy)
- .gitignore (updated: .claude/ → .claude/settings.local.json, added MES-API-KEYS.md, CLAUDE.local.md)
- docs/ (entire structure created)
- .claude/settings.json (new)
- .claude/skills/ (6 new files)
- .claude/agents/reviewer.md (new)
- .github/workflows/ci.yml (new)
- scripts/ralph.sh, ralph-once.sh (new)
- 27 SYSTEM-REFERENCE*.md moved to docs/raw/system-reference/
- ~96 root .md archived to docs/raw/archive/

## Migrations applied
- None (no DB changes in this task)

## Docs updated
- [x] docs/index.md — created with full TOC
- [x] docs/about/founder.md — from interview
- [x] docs/about/product.md — from old CLAUDE.md vision
- [x] docs/README.md — system explanation
