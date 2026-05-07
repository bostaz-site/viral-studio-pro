# Analytics Charts

Reusable data visualization components for the Analytics page. Built with Recharts, styled to the Viral Animal brand (cyan #38BDF8 + orange #F97316).

## Components

### 1. InsightBarChart
Horizontal bar chart showing multiplier performance by pattern.

```tsx
import { InsightBarChart } from '@/components/analytics/charts/insight-bar-chart'

<InsightBarChart
  title="Best performing patterns"
  data={[
    { label: 'Funny clips', multiplier: 2.4, postCount: 18, platform: 'TikTok' },
    { label: 'Hype clips', multiplier: 1.8, postCount: 12, platform: 'YouTube' },
    { label: 'Short clips', multiplier: 1.4, postCount: 9, platform: 'Instagram' },
  ]}
/>
```

### 2. PostingHeatmap
Hour x weekday grid showing when posts perform best.

```tsx
import { PostingHeatmap } from '@/components/analytics/charts/posting-heatmap'

<PostingHeatmap
  data={[
    { hour: 19, weekday: 0, multiplier: 2.1, postCount: 8 },
    { hour: 21, weekday: 2, multiplier: 1.8, postCount: 5 },
    { hour: 12, weekday: 4, multiplier: 0.7, postCount: 6 },
  ]}
/>
```

### 3. ProgressionLineChart
Line chart with area gradient showing score or follower progression over time.

```tsx
import { ProgressionLineChart } from '@/components/analytics/charts/progression-line-chart'

<ProgressionLineChart
  metric="score"
  data={[
    { date: '2026-04-01', score: 45 },
    { date: '2026-04-08', score: 52 },
    { date: '2026-04-15', score: 61 },
    { date: '2026-04-22', score: 58 },
    { date: '2026-04-29', score: 67 },
  ]}
/>
```

## Style Guide
- Primary: #38BDF8 (cyan)
- Accent: #F97316 (orange) for top performers and last-point highlight
- Penalty: rgba(239,68,68,0.35) (red dim) for underperformers
- Background: transparent (renders inside glass cards)
- Tooltips: dark glass with cyan border
- Animations: 800-1000ms fade-in
