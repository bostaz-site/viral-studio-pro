import { z } from 'zod'

export const candidateCheckInputSchema = z.object({
  clipId: z.string().min(1),
  videoUrl: z.string().url().optional(),
  fallbackUrl: z.string().url().optional(),
})

export const candidateCheckResultSchema = z.object({
  darkSecondsRatio: z.number().nullable(),
  longestDarkStretch: z.number().nullable(),
  speechRatio: z.number().nullable(),
  longestSilence: z.number().nullable(),
  totalDuration: z.number().optional(),
  flags: z.array(z.enum(['too_dark', 'low_speech'])),
  analyzedAt: z.string(),
  error: z.string().optional(),
})

export type CandidateCheckInput = z.infer<typeof candidateCheckInputSchema>
export type CandidateCheckResult = z.infer<typeof candidateCheckResultSchema>
