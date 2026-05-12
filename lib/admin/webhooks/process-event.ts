import type { SupabaseClient } from '@supabase/supabase-js'
import { processInstantlyEvent } from './instantly-processor'

/**
 * Factory: routes webhook events to the correct provider processor.
 * Extensible for Stripe, Resend, Smartlead, etc.
 */
export async function processWebhookEvent(
  admin: SupabaseClient,
  webhookEventId: string,
  provider: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  switch (provider) {
    case 'instantly':
      return processInstantlyEvent(admin, webhookEventId, eventType, payload)
    // TODO Week 2+:
    // case 'stripe':
    //   return processStripeEvent(admin, webhookEventId, eventType, payload)
    // case 'resend':
    //   return processResendEvent(admin, webhookEventId, eventType, payload)
    default:
      // Unknown provider — stored but not processed
      break
  }
}
