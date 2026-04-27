import { z } from 'zod'

/**
 * Single source of truth for render settings.
 *
 * Used by:
 * - POST /api/render (inputSchema.settings)
 * - POST /api/render/quick (auto-built from mood preset)
 * - Frontend enhance page (handleRender body)
 * - VPS vps/routes/render.js (destructures req.body.settings)
 */
export const renderSettingsSchema = z.object({
  captions: z.object({
    enabled: z.boolean().optional(),
    style: z.string().optional(),
    fontSize: z.number().optional(),
    color: z.string().optional(),
    position: z.union([z.string(), z.number()]).optional(),
    wordsPerLine: z.number().optional(),
    animation: z.string().optional(),
    emphasisEffect: z.string().optional(),
    emphasisColor: z.string().optional(),
    customImportantWords: z.array(z.string()).optional(),
  }).optional(),
  splitScreen: z.object({
    enabled: z.boolean().optional(),
    layout: z.string().optional(),
    brollCategory: z.string().optional(),
    ratio: z.number().optional(),
  }).optional(),
  hook: z.object({
    enabled: z.boolean().optional(),
    textEnabled: z.boolean().optional(),
    reorderEnabled: z.boolean().optional(),
    text: z.string().optional(),
    style: z.enum(['shock', 'curiosity', 'suspense']).optional(),
    length: z.number().optional(),
    textPosition: z.number().optional(),
    overlayPng: z.string().nullable().optional(),
    overlayCapsuleW: z.number().nullable().optional(),
    overlayCapsuleH: z.number().nullable().optional(),
    reorder: z.object({
      segments: z.array(z.object({
        start: z.number(),
        end: z.number(),
        duration: z.number(),
        label: z.string(),
      })),
      totalDuration: z.number(),
      peakTime: z.number(),
    }).nullable().optional(),
  }).optional(),
  tag: z.object({
    style: z.string().optional(),
    size: z.number().optional(),
    authorName: z.string().nullable().optional(),
    authorHandle: z.string().nullable().optional(),
    overlayPng: z.string().nullable().optional(),
    overlayAnchorX: z.number().nullable().optional(),
    overlayAnchorY: z.number().nullable().optional(),
  }).optional(),
  format: z.object({
    aspectRatio: z.string().optional(),
    videoZoom: z.enum(['contain', 'fill', 'immersive']).optional(),
  }).optional(),
  smartZoom: z.object({
    enabled: z.boolean().optional(),
    mode: z.enum(['micro', 'dynamic', 'follow']).optional(),
  }).optional(),
  audioEnhance: z.object({
    enabled: z.boolean().optional(),
    bassBoost: z.enum(['off', 'mild', 'heavy']).optional().default('off'),
    speedRamp: z.enum(['off', 'subtle', 'dynamic']).optional().default('off'),
  }).optional(),
  autoCut: z.object({
    enabled: z.boolean().optional(),
    silenceThreshold: z.number().min(0.2).max(1.0).optional(),
    mood: z.string().optional(),
  }).optional(),
})

export type RenderSettings = z.infer<typeof renderSettingsSchema>

/**
 * Full render request body schema (clip_id + source + settings).
 */
export const renderInputSchema = z.object({
  clip_id: z.string().uuid(),
  source: z.enum(['clips', 'trending']).optional().default('trending'),
  settings: renderSettingsSchema.optional(),
  force: z.boolean().optional().default(false),
})

export type RenderInput = z.infer<typeof renderInputSchema>
