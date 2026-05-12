// ── Instantly API v2 response types ──────────────────────────────────────────

export interface InstantlyEmailAccount {
  id: string
  email: string
  first_name: string
  last_name: string
  provider_code: number
  warmup_status: string // 'active' | 'paused' | 'disabled'
  status: number
  daily_limit: number
  is_smtp_imap: boolean
  created_at: string
}

export interface InstantlyAccountHealth {
  reputation_score?: number
  bounce_rate?: number
  complaint_rate?: number
  warmup_status?: string
  daily_sent?: number
  spf_valid?: boolean
  dkim_valid?: boolean
  dmarc_valid?: boolean
}

export interface InstantlyCampaign {
  id: string
  name: string
  status: string // 'active' | 'paused' | 'completed' | 'draft' | 'error'
  created_at: string
  updated_at: string
}

export interface InstantlyCampaignAnalytics {
  campaign_id: string
  campaign_name: string
  total_leads: number
  contacted: number
  emails_sent: number
  emails_read: number
  new_leads_contacted: number
  leads_replied: number
  bounced: number
  unsubscribed: number
  completed: number
}

export interface InstantlyPaginatedResponse<T> {
  items: T[]
  next_starting_after?: string
}

// ── Internal sync types ─────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean
  started_at: string
  completed_at: string
  mailboxes_synced: number
  campaigns_synced: number
  errors: SyncError[]
}

export interface SyncError {
  entity: 'mailbox' | 'campaign'
  id: string
  name: string
  error: string
}

export interface SyncStatus {
  last_sync_at: string | null
  last_sync_result: SyncResult | null
  next_sync_at: string | null
  is_syncing: boolean
}
