/**
 * Provenance enforcement: NO source_url = NO contact.
 * Every contact attempt requires a traceable origin.
 */

export interface ProvenanceCheck {
  allowed: boolean
  reason?: string
}

/**
 * Check if a contact has valid provenance (source_url).
 * Required for all intents except 'import' (import is the act of adding provenance).
 */
export function checkProvenance(params: {
  sourceUrl?: string | null
  intent: 'import' | 'export_campaign' | 'send_email' | 'add_to_kit'
}): ProvenanceCheck {
  // Import is the act of adding provenance — source_url is recorded during import
  if (params.intent === 'import') {
    return { allowed: true }
  }

  if (!params.sourceUrl || params.sourceUrl.trim() === '') {
    return {
      allowed: false,
      reason: 'No source_url provided — cannot contact without provenance',
    }
  }

  return { allowed: true }
}
