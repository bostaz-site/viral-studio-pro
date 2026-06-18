import { createAdminClient } from '../supabase/admin'
import { sendDiscordAlert } from './discord'
import { predictROI } from './roi-predictor'

export interface NewFinding {
  agent_type: 'output' | 'acquisition' | 'activation' | 'retention' | 'technical' | 'cold_email' | 'pr_review' | 'session_replay'
  persona?: 'sceptical' | 'free_limit' | 'power'
  severity: 'critical' | 'high' | 'normal' | 'low'
  title: string
  description: string
  location?: string
  suggested_fix?: string
  screenshot_url?: string
}

export async function insertFinding(finding: NewFinding) {
  const admin = createAdminClient()

  // Deduplicate: check if a similar open finding already exists
  const { data: existing } = await admin
    .from('audit_findings')
    .select('id, cycle_count')
    .eq('agent_type', finding.agent_type)
    .eq('title', finding.title)
    .eq('status', 'open')
    .maybeSingle()

  if (existing) {
    // Re-occurrence: increment cycle_count and escalate if 3+ cycles
    await admin
      .from('audit_findings')
      .update({
        cycle_count: existing.cycle_count + 1,
        updated_at: new Date().toISOString(),
        severity: existing.cycle_count >= 2 ? 'critical' : finding.severity,
      })
      .eq('id', existing.id)
    return existing.id
  }

  // Predict ROI for new findings (non-blocking)
  const roi = await predictROI(finding).catch(() => null)

  // New finding with ROI prediction (bucket-based)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertData: Record<string, any> = { ...finding }
  if (roi) {
    insertData.predicted_impact_bucket = roi.predicted_impact_bucket
    insertData.predicted_impact_reasoning = roi.predicted_impact_reasoning
    insertData.predicted_impact_ux = roi.predicted_impact_ux
    insertData.predicted_effort_hours = roi.predicted_effort_hours
    insertData.predicted_confidence = roi.predicted_confidence
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('audit_findings')
    .insert(insertData)
    .select('id')
    .single()

  await sendDiscordAlert(finding)
  return data?.id
}
