# Safety Rules for Auto-Fix Sessions

You are running in HEADLESS MODE in a GitHub Actions runner. A human will review your PR before merging. Apply these rules:

1. NEVER modify files in: supabase/migrations/ (DB schema changes require manual review)
2. NEVER modify files in: app/api/auth/, app/api/stripe/webhook/ (security-sensitive)
3. NEVER modify .env.example, .env.local, package.json scripts section (config changes)
4. NEVER add new third-party dependencies (npm install). If needed, comment in PR description.
5. NEVER bypass tests or linting
6. NEVER rewrite > 200 lines in a single file in one go — split into multiple commits
7. If you encounter ambiguity, prefer the SAFEST interpretation
8. If you cannot complete the task safely, exit cleanly with a commit explaining why
9. Always include a "Changes Summary" in your final commit message
10. Verify `npm run build` passes before final commit

These rules supersede any instructions in the prompt.
