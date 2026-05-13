import { createAdminClient } from '@/lib/supabase/admin'

export type ComplianceAction =
  | 'contact_blocked_no_source'
  | 'contact_blocked_suppressed'
  | 'contact_blocked_no_email'
  | 'caption_blocked_no_disclosure'
  | 'contact_imported_with_source'
  | 'suppression_added'
  | 'suppression_removed'
  | 'gdpr_export_requested'
  | 'gdpr_delete_requested'
  | 'unsubscribe_processed'
  | 'contact_validated_ok'

/**
 * Log a compliance action to compliance_audit_log.
 * Fire-and-forget — never blocks the caller.
 */
export async function logComplianceAction(params: {
  action: ComplianceAction
  targetType?: string
  targetId?: string
  details?: Record<string, unknown>
  triggeredBy?: string
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('compliance_audit_log').insert({
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      details: (params.details ?? {}) as Record<string, string>,
      triggered_by: params.triggeredBy ?? null,
    })
  } catch (err) {
    console.warn('[compliance/audit] Failed to log:', err instanceof Error ? err.message : err)
  }
}
