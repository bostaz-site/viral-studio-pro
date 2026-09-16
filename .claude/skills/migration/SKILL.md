---
name: migration
description: Create, apply, and verify a Supabase migration. Use when adding/altering DB columns or tables.
---

# Migration skill

1. Create `supabase/migrations/YYYYMMDDHHmmss_<name>.sql` with the DDL
2. Apply via MCP: `mcp__claude_ai_Supabase__apply_migration` with project_id `swlbdlgwqeinwxuviwgn`
3. Verify with `mcp__claude_ai_Supabase__execute_sql`: query `information_schema.columns` to confirm the column/table exists
4. If verification fails: STOP. Do not write code that depends on this column. Report the failure.
5. Only after verification passes: write the application code that reads/writes the new column
6. Commit the migration file BEFORE or WITH the code, never after

**CHECK constraint rule**: any new value written to a column with a CHECK constraint → query `pg_constraint` first and extend the constraint in the migration. Never assume the existing CHECK accepts the value.

```sql
-- Find CHECK constraints on a table
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.<table>'::regclass AND contype = 'c';
```

Example verify query:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = '<table>' AND column_name = '<column>'
```
