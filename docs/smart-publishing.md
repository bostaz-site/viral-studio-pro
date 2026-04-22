# Smart Publishing System

Adaptive publishing system that makes real-time decisions based on clip performance data. Replaces static niche presets with a learning system that evolves through 3 phases.

## Architecture Overview

```
User posts clips
      |
      v
publication_performance  --->  analyzePerformances()
      |                               |
      v                               v
account_intelligence  <---  detectPhase() + patterns
      |
      v
getPublishRecommendation()  --->  UI (settings, queue, widget)
```

## Phases

### Phase 1: Testing (0-15 posts)

- **Goal**: Discover when the audience is most responsive
- **Frequency**: 2-4 posts/day
- **Strategy**: Systematically vary posting times across morning (10-12h), afternoon (15-17h), evening (19-23h)
- **Minimum spacing**: 3h (platform default)
- **Confidence level**: Low

### Phase 2: Optimizing (15-50 posts)

- **Goal**: Refine posting patterns based on data
- **Frequency**: 2 posts/day (focused on best slots)
- **Strategy**: Keep the 2 best time slots, drop the rest
- **Analysis**:
  - Average score per time slot
  - Best performing day of week
  - Optimal clip duration
  - Captions vs no captions impact
  - Split-screen vs no split-screen impact
- **Threshold adjustment**: Hot/flop thresholds adapt to the account's actual distribution
- **Confidence level**: Medium

### Phase 3: Scaling (50+ posts)

- **Goal**: Maximize reach with momentum-based decisions
- **Frequency**: Dynamic based on momentum
- **Momentum rules**:
  - **Viral** (score > viral_threshold): STOP 12-24h, let algo maximize reach
  - **Hot** (score > hot_threshold): Wait for algo push duration, then post
  - **Flop** (score < flop_threshold): Wait recovery hours, switch content type
  - **3+ consecutive flops**: Recovery mode (1 post/day for 2 days)
  - **Rising momentum**: Maintain rhythm
  - **Declining momentum**: Slow down, focus on quality
- **Confidence level**: High

## Decision Rules

### Performance Score Calculation

```
score = velocity * 0.35 + engagement * 0.25 + retention * 0.20 + volume * 0.20
```

| Metric | Weight | Formula | Max Score |
|--------|--------|---------|-----------|
| Velocity | 35% | views_2h / 2 / expectedVelocity * 100 | 100 |
| Engagement | 25% | (likes + comments*3 + shares*5) / views / 0.10 * 100 | 100 |
| Retention | 20% | retention_rate * 100 | 100 |
| Volume | 20% | log10(views_total) / 5 * 100 | 100 |

### Performance Classification

| Label | Condition |
|-------|-----------|
| Viral | score >= viral_threshold (default 90) |
| Hot | score >= hot_threshold (default 75) |
| Warm | score >= flop_threshold (default 25) |
| Cold | score >= flop_threshold * 0.5 |
| Dead | score < flop_threshold * 0.5 |

### Timing Evaluation for Queue Items

| Quality | Condition |
|---------|-----------|
| Great | Within ±1h of a best performing slot |
| OK | Not near best or worst slots |
| Poor | Within ±1h of a worst performing slot |

## Platform Rules

| Rule | TikTok | YouTube Shorts | Instagram Reels |
|------|--------|----------------|-----------------|
| Max safe posts/day | 3 | 3 | 1 |
| Min spacing | 3h | 4h | 24h |
| Critical window | 2h | 4h | 6h |
| Viral cooldown | 12h | 24h | 24h |
| Flop recovery | 4h | 6h | 24h |
| Algo push duration | 6h | 48h | 72h |
| Hashtag impact | Low | Medium | High |
| Best clip duration | 15-45s | 15-60s | 15-30s |
| Default optimal hours | 12, 17, 21 | 14, 20 | 13, 18, 21 |

## SQL Tables

### `publication_performance`

Tracks metrics for each published clip over time.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK -> profiles |
| scheduled_publication_id | UUID | FK -> scheduled_publications (nullable) |
| clip_id | TEXT | Clip identifier |
| platform | TEXT | tiktok/youtube/instagram |
| views_1h - views_48h | INTEGER | Views at checkpoints |
| views_total | INTEGER | Latest total views |
| likes, comments, shares | INTEGER | Engagement metrics |
| watch_time_avg | FLOAT | Average watch time in seconds |
| retention_rate | FLOAT | 0-1 retention percentage |
| posted_at | TIMESTAMPTZ | When the clip was posted |
| day_of_week | INTEGER | 0=Sunday, 6=Saturday |
| hour_of_day | INTEGER | 0-23 |
| niche | TEXT | Content niche |
| has_captions | BOOLEAN | Whether clip had captions |
| has_split_screen | BOOLEAN | Whether clip had split-screen |
| clip_duration_seconds | FLOAT | Clip length |
| performance_score | FLOAT | Calculated 0-100 score |
| is_viral | BOOLEAN | True if score >= 90 |
| velocity | FLOAT | Views per hour (first 2h) |
| last_checked_at | TIMESTAMPTZ | Last metrics check |
| check_count | INTEGER | Number of checks |

**Indexes**: user_id, platform, posted_at, day_of_week, hour_of_day, (user_id, platform)

### `account_intelligence`

Per-account learning state. One record per user+platform (UNIQUE on user_id).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK -> profiles (UNIQUE) |
| platform | TEXT | Platform being analyzed |
| phase | TEXT | testing/optimizing/scaling |
| total_posts | INTEGER | Total analyzed posts |
| best_hours | JSONB | Array of {hour, day, avg_score} |
| worst_hours | JSONB | Array of {hour, day, avg_score} |
| optimal_posts_per_day | FLOAT | Discovered optimal frequency |
| optimal_min_hours_between | FLOAT | Discovered optimal spacing |
| best_clip_duration_range | JSONB | {min, max} in seconds |
| captions_boost_percent | FLOAT | Impact of captions (%) |
| split_screen_boost_percent | FLOAT | Impact of split-screen (%) |
| last_post_performance | TEXT | viral/hot/warm/cold/dead |
| last_post_at | TIMESTAMPTZ | When last post was made |
| consecutive_flops | INTEGER | Current flop streak |
| consecutive_hits | INTEGER | Current hit streak |
| current_momentum | TEXT | rising/neutral/declining |
| hot_threshold | FLOAT | Adapted hot threshold |
| viral_threshold | FLOAT | Adapted viral threshold |
| flop_threshold | FLOAT | Adapted flop threshold |

## API Routes

### `GET /api/distribution/performance`

Fetch performance records with filters.

**Query params**: `platform`, `days` (max 90), `limit` (max 200)

### `POST /api/distribution/performance`

Create or update performance record. If `id` is provided, updates existing record and recalculates score.

**Create body**: `{ clip_id, platform, posted_at, views_*, likes, comments, shares, ... }`

**Update body**: `{ id, views_*, likes, comments, shares, ... }`

### `GET /api/distribution/intelligence`

Get account intelligence and current recommendation.

**Query params**: `platform` (default: tiktok)

**Response**: `{ intelligence, recommendation }`

### `POST /api/distribution/intelligence`

Trigger full analysis: recalculates patterns, updates phase, adjusts thresholds.

**Body**: `{ platform }`

**Response**: `{ intelligence, recommendation, analysis }`

### `POST /api/distribution/optimize` (upgraded)

Now uses real performance data when available:
- Testing phase: applies niche presets (existing behavior)
- Optimizing/Scaling: uses discovered patterns to set optimal hours, frequency
- Also updates `account_intelligence` per platform

### `POST /api/distribution/schedule` (upgraded)

Before scheduling, calls `getPublishRecommendation()`. Returns `timingWarning` if the timing is suboptimal. **Non-blocking** — user can still force the schedule.

## Components

### `DistributionSettings` (upgraded)

Added sections:
- **Smart Publishing status**: Phase badge, momentum indicator, last performance, post count, confidence
- **Recommendation**: Dynamic text based on phase and state
- **Insights**: Best time slots, best clip duration, captions/split-screen impact (requires 15+ posts)
- **Insights locked**: Progress bar showing posts needed to unlock
- **Optimize button**: Phase-aware messaging

### `ScheduleQueue` (upgraded)

Added:
- **Timing indicators**: Colored bar (green/amber/red) on each queue item
- **Timing label**: "Great timing" / "OK timing" / "Poor timing"
- **Viral/hot alert**: Banner when last clip is performing well with wait time
- **Flop alert**: Banner when 3+ consecutive underperformers

### `SmartInsightsWidget` (new)

Compact dashboard widget showing:
- Account phase badge
- Current momentum with icon
- Posts this week count
- Next recommended post with countdown
- Mini sparkline bar chart of last 7 posts performance

## Zustand Store

### `useSmartPublishingStore` (`stores/smart-publishing-store.ts`)

| Field | Type | Description |
|-------|------|-------------|
| intelligence | AccountIntelligence / null | Current account intelligence |
| performances | PublicationPerformance[] | Recent performances |
| recommendation | PublishRecommendation / null | Current posting recommendation |
| loading | boolean | Intelligence loading state |
| insightsLoading | boolean | Insights/analysis loading state |
| fetchIntelligence(platform) | action | GET /api/distribution/intelligence |
| fetchPerformances(platform, days?) | action | GET /api/distribution/performance |
| getRecommendation(platform) | action | Refresh recommendation |
| recordPerformance(data) | action | POST /api/distribution/performance |
| triggerAnalysis(platform) | action | POST /api/distribution/intelligence |

## User Flow

1. User starts posting clips (phase: testing)
2. System records performance data via `publication_performance` table
3. After each post, metrics are updated (manually or via platform APIs when available)
4. At 15 posts, system enters optimizing phase — patterns are discovered
5. "Optimize with AI" now uses real data instead of static presets
6. Queue items show timing quality indicators
7. At 50 posts, system enters scaling phase — momentum-based decisions
8. Dashboard widget shows real-time status and recommendations

## Technical Notes

- All decision logic is in `lib/distribution/smart-publisher.ts` (server-side, reusable)
- Platform rules are in `lib/distribution/platform-rules.ts`
- Performance tracking columns (views, likes, etc.) are future-proof: filled when platform APIs are approved
- Users can manually enter stats or wait for API integration
- Recommendations are **suggestions**, never blockers — user can always force actions
- System works with 0 performance data (falls back to niche presets)
- Thresholds adapt automatically based on account's actual score distribution
- RLS policies ensure users can only access their own data
