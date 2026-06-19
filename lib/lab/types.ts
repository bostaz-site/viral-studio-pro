export interface FeatureConfig {
  area: string
  name: string
  doc_path: string
  additional_docs?: string[]
  url: string
  code_paths: string[]
  competitors: string[]
  priority: number
}

export interface LabConfig {
  manual_trigger_only: boolean
  cron_disabled: boolean
  bootstrap_chain_mode: boolean
  min_metric_clarity: number
  kill_switch_required: boolean
  monthly_cost_cap_usd: number
  council_setup: string
  features: FeatureConfig[]
}

export interface DeepDive {
  id: string
  feature_area: string
  cycle_number: number
  status: string

  intuition_solution: string | null
  intuition_risk: string | null
  intuition_metric: string | null

  context_main_doc: string | null
  context_additional_docs: unknown[] | null
  context_vision: string | null
  context_concept: string | null
  context_lab_history: string | null
  context_founder_goals: string | null
  context_code_paths: unknown[] | null
  context_kg_nodes: unknown[] | null

  research_articles: Array<{ url: string; title: string; key_insight: string }> | null
  research_competitors: Array<{ name: string; approach: string }> | null
  research_synthesis: string | null

  target_metric: string
  target_delta_minimum: number | null
  measurement_method: string | null
  metric_clarity_score: number | null

  final_recommendation: string | null
  recommendation_rationale: string | null
  kill_switch_scenario: string | null
  kill_switch_severity: number | null
  alternatives_rejected: Array<{ alt: string; why_rejected: string }> | null
  confidence: number | null
  estimated_effort_hours: number | null

  deliverable_markdown: string | null
  deliverable_file_path: string | null
  claude_code_prompt: string | null

  total_cost_usd: number | null
  created_at: string
}

export interface QueueEntry {
  id: string
  feature_area: string
  current_cycle: number
  last_dived_at: string | null
  next_scheduled_at: string
  priority: number
  active: boolean
  forced_next: boolean
}

export interface CouncilResponse {
  solution: string
  rationale: string
  concerns: string
  effort_estimate_hours: number
  confidence: number
}
