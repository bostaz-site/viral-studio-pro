/**
 * Pre-launch mode skips findings that depend on real user traffic.
 * Set PRE_LAUNCH_MODE=true until the site has real users (~100 signups).
 */

export function isPreLaunchMode(): boolean {
  return process.env.PRE_LAUNCH_MODE === 'true'
}

const TRAFFIC_DEPENDENT_METRICS = [
  'publish_rate_per_clip',
  'return_user_rate_7d',
  'clips_per_active_user_avg',
  'month_cohort_retention',
  'avg_views_per_post',
  'churn_rate',
  'signup_to_paid_rate',
  'time_to_first_clip_avg',
  'feature_usage_rate',
]

const TRAFFIC_KEYWORDS = [
  'zero publishing', 'no publishing', 'publish rate',
  'return rate', 'return user', 'cohort',
  'churn', 'churn rate',
  'clips/user', 'clips per user', 'per active user',
  'time to first clip', 'avg session', 'feature usage rate',
  'no return users', 'low retention', 'user inactivity',
  'cohort decay', 'low publish',
]

export function isTrafficDependentMetric(metricName: string): boolean {
  return TRAFFIC_DEPENDENT_METRICS.includes(metricName)
}

export function shouldSkipFinding(finding: {
  title: string
  description: string
  location?: string | null
}): boolean {
  if (!isPreLaunchMode()) return false

  const text = `${finding.title} ${finding.description} ${finding.location ?? ''}`.toLowerCase()
  return TRAFFIC_KEYWORDS.some((kw) => text.includes(kw))
}
