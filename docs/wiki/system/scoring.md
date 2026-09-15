# Clip Scoring V2

7-factor scoring system for trending clips. Source: `lib/scoring/clip-scorer.ts`.

## Factors

| # | Factor | Weight | Measures |
|---|--------|--------|---------|
| 1 | Momentum | 25% | Current velocity + acceleration (or sublinear estimate) |
| 2 | Platform Authority | 20% | Clip views vs streamer average |
| 3 | Engagement Proxy | 15% | likes/views ratio + title signals |
| 4 | Recency Decay | 10% | exp(-age/72) — never 0 |
| 5 | Early Signal | 10% | views/min × log(views) × decay |
| 6 | Format Score | 10% | 30-60s=100, 15-30s=90, 60-90s=85, 90-180s=70 |
| 7 | Saturation | -10% | Penalty for old viral (>7d + >1M) and dead clips |

## Edit signals penalty
`edit_signals` (jsonb on `trending_clips`): `{source_has_burned_captions, source_is_vertical}`. Both true → -8 pts (likely TikTok repost).

## Display curve
`-5 + raw × 1.5`, soft ceiling above 88: `88 + 11×(1 - e^(-(x-88)/10))`. Monotonic, cap at 99.

## Tiers
| Score | Tier |
|-------|------|
| ≥ 90 | mega_viral |
| ≥ 75 | viral |
| ≥ 60 | hot |
| ≥ 40 | rising |
| ≥ 15 | normal |
| < 15 | dead |

## Feed categories
- **early_gem**: clip < 6h + strong early signal or authority
- **hot_now**: momentum ≥ 65 + clip < 12h
- **proven**: score ≥ 55 + clip > 12h
- **normal**: everything else

## Rescore cron (`app/api/cron/rescore-clips/route.ts`)
Stratified: < 6h → every 15 min, 6-24h → hourly, > 24h → daily. Spike detection: +20% views → immediate rescore. Passes `edit_signals` to scorer.

## Key files
- `lib/scoring/clip-scorer.ts` — scoring function + types
- `app/api/cron/rescore-clips/route.ts` — stratified rescore
- `app/api/admin/rescore-all/route.ts` — bulk rescore (admin)
