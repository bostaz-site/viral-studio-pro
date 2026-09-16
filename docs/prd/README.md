# PRD Format (Ralph)

## JSON Structure

```json
{
  "feature": "feature-name",
  "description": "One sentence describing the feature",
  "stories": [
    {
      "id": "S1",
      "title": "Short story title",
      "acceptance": [
        "Given X, when Y, then Z",
        "The UI shows ...",
        "The DB contains ..."
      ],
      "verify": "npx tsc --noEmit && curl -s .../api/health | jq .status",
      "passes": false
    }
  ]
}
```

## Rules

1. Stories are small — ≤ 1 hour of work each
2. One story per iteration (Ralph picks the highest priority non-passing one)
3. `passes: true` requires `verify` command to succeed with proof
4. `verify` is a shell command or SQL query — must be automatable
5. Never mark passes:true without running verify and seeing the output
6. Verify for a story that writes to DB = SQL query on the actual data, never a grep alone
