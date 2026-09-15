import { z } from 'zod'

/** Zod schema for cold-email create-sequence request */
export const createSequenceSchema = z.object({
  sequenceId: z.string().min(1),
  emailAccountIds: z.array(z.string().min(1)).min(1),
  campaignName: z.string().min(3).max(100).optional(),
})

export type CreateSequenceInput = z.infer<typeof createSequenceSchema>

/** Zod schema for cold-email Instantly webhook inbound body */
export const instantlyWebhookSchema = z.object({
  event_type: z.string().optional(),
  event: z.string().optional(),
}).passthrough()

export type InstantlyWebhookBody = z.infer<typeof instantlyWebhookSchema>
