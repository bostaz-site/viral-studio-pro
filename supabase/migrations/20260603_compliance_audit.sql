-- Compliance V3-1C: Audit log for compliance actions
-- NOTE: Already applied via MCP — this file is for record-keeping

CREATE TABLE IF NOT EXISTS public.compliance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN (
    'contact_blocked_no_source',
    'contact_blocked_suppressed',
    'caption_blocked_no_disclosure',
    'contact_imported_with_source',
    'suppression_added',
    'suppression_removed',
    'gdpr_export_requested',
    'gdpr_delete_requested',
    'unsubscribe_processed',
    'bounce_processed',
    'complaint_processed'
  )),
  target_type TEXT,
  target_id UUID,
  details JSONB,
  triggered_by UUID REFERENCES auth.users(id),
  occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_action ON compliance_audit_log(action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_target ON compliance_audit_log(target_type, target_id);
