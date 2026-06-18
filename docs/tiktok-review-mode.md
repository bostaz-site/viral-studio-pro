# TikTok Review Mode

Pauses auto-fix execution during TikTok API review to protect the reviewer experience.

## When to activate

Set `TIKTOK_REVIEW_MODE=true` in **both** Netlify and Railway **before** submitting for TikTok review.

## When to deactivate

Set `TIKTOK_REVIEW_MODE=false` after receiving TikTok approval email. Then click "Resume queued auto-fixes" in `/admin/audits`.

## What it does

| Feature | Mode=true | Mode=false |
|---|---|---|
| Nightly audit agents | Run normally | Run normally |
| Auto-prompt generation | Generates prompts + pushes to GitHub | Same |
| Discord Accept button | Queues accept (does NOT trigger fix) | Triggers auto-fix |
| Diff generation | Blocked (saves tokens) | Normal |
| Resume endpoint | Returns error | Dispatches all queued accepts |

## How to verify it's active

```bash
curl -H "Authorization: Bearer <token>" https://viralanimal.com/api/admin/audits/tiktok-mode-status
# { "data": { "mode": "active", "queued_accepts": 12 } }
```

Or check the banner in `/admin/audits`.

## Emergency override

For security/data-loss critical findings, a separate "Override" button appears in Discord. This bypasses the review hold and is logged for traceability.

Override criteria: severity=critical AND title/description contains security keywords (xss, injection, data loss, credential leak, etc.)

## Resume process

1. Set `TIKTOK_REVIEW_MODE=false` in Netlify + Railway
2. Go to `/admin/audits`
3. Click "Resume queued auto-fixes"
4. Each queued accept triggers a GitHub Actions workflow
5. PRs will be created within ~5-10 minutes per fix
