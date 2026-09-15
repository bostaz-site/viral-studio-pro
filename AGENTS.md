# Viral Animal

Clip automation platform — browse/enhance/publish viral clips from Twitch/Kick.
Read `docs/index.md` before any task. Read `docs/about/founder.md` if the task touches product or tone.

## Code style

- TypeScript strict, no `any` (cast via `as never` or `as unknown as X` if truly needed)
- File names: kebab-case. Components: PascalCase. Functions/vars: camelCase
- Server Components by default, `'use client'` only for interactivity
- Images: always `next/image`, remote domains in `next.config.mjs`
- API responses: `{ data, error, message }` — use `jsonResponse()`/`errorResponse()` from `lib/api/withAuth`
- Validation: zod schemas in `lib/schemas/`
- Cron routes: verify `x-api-key` === `CRON_SECRET` via `timingSafeCompare`
- Admin routes: `withAdmin()` from `lib/api/withAdmin` (checks `ADMIN_EMAILS`)
- VPS (Railway): Express + ESM in `vps/`, no TypeScript — `node --check` to verify

## Commands

```bash
npm run dev          # Next.js dev
npm run build        # production build (must pass before push)
npx tsc --noEmit     # typecheck (0 errors required)
node --check vps/routes/render.js vps/lib/sfx.js vps/lib/retention-risk.js  # VPS syntax
cd vps && node test-build-args.mjs   # smoke test render args (catches TDZ)
```

**Migrations**: create `supabase/migrations/YYYYMMDDHHmmss_name.sql`, apply via Supabase MCP `apply_migration`, verify with `execute_sql` on `information_schema`. Migration applied in prod BEFORE code that depends on it.

**Deploy**: Netlify (frontend) and Railway (VPS) auto-deploy on push to master. Verify Railway: `curl https://bostaz-site-production.up.railway.app/api/health`.

## Hard rules

1. **Staging explicit** — `git add <file>` only. Never `git add -A`, `git add .`, `commit -a`, `--no-verify`, `push --force`
2. **Migration first** — applied + proven in prod before the code that reads the column
3. **DoD obligatoire** — every task ends with DONE / NOT DONE / NOT VERIFIED + proof (command output, SQL result). Write to `docs/prompts/REPORT/`
4. **No .md at root** — docs go in `docs/`. Only CLAUDE.md, README.md, AGENTS.md at root
5. **Update docs** — run `/update-docs` at end of task to keep `docs/wiki/` current
6. **Secrets** — never hardcoded, never in tracked files. `.env.local` is gitignored
7. **When in doubt** — `AskUserQuestion`. Don't guess product decisions

## Key references

@docs/wiki/system/render.md
@docs/wiki/system/distribution.md
@docs/wiki/system/platforms.md
@docs/wiki/system/admin.md
@docs/about/founder.md
