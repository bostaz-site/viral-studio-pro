# docs/ — Single Source of Truth

## Structure

```
docs/
  index.md              Table of contents (maintained by /update-docs)
  about/
    founder.md           Who Samy is, what drives him, how to work with him
    product.md           Viral Animal vision in 1 page
  wiki/
    system/              How each module works TODAY (≤300 lines each)
    decisions/           One file per month, dated lines
    plans/               Active plans
  prd/                   PRD files (Ralph JSON format)
  prompts/               Numbered prompts + REPORT/ for DoD
  raw/                   Uncompiled material
    archive/             Old root .md files (history preserved)
    sessions/            Auto-generated session summaries
    system-reference/    Original SYSTEM-REFERENCE*.md files
```

## Rules

1. Wiki pages ≤ 300 lines — "how it works today", no history
2. index.md — one line per page with a 1-sentence summary
3. raw/ is input, wiki/ is output — compile raw → wiki, never reverse
4. No .md at repo root except CLAUDE.md, README.md, AGENTS.md
5. Every decision gets a dated line in decisions/YYYY-MM.md
