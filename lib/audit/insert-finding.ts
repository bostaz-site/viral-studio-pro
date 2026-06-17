import { createAdminClient } from '../supabase/admin'
import { sendDiscordAlert } from './discord'

export interface NewFinding {
  agent_type: 'output' | 'acquisition' | 'activation' | 'retention' | 'technical'
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

  // New finding
  const { data } = await admin
    .from('audit_findings')
    .insert(finding)
    .select('id')
    .single()

  await sendDiscordAlert(finding)
  return data?.id
}
