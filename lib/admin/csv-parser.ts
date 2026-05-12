import { z } from 'zod'

export const CSV_PLATFORMS = ['twitch', 'kick', 'youtube', 'tiktok', 'instagram', 'podcast', 'other'] as const
export type CSVPlatform = typeof CSV_PLATFORMS[number]

export const influencerRowSchema = z.object({
  email: z.string().email('Invalid email format'),
  first_name: z.string().max(100).optional().default(''),
  last_name: z.string().max(100).optional().default(''),
  primary_platform: z.enum(CSV_PLATFORMS).optional(),
  platform_handle: z.string().max(100).optional().default(''),
  audience_size: z.coerce.number().int().min(0).optional(),
  niche: z.string().max(100).optional().default(''),
  country: z.string().max(10).optional().default(''),
  language: z.string().max(10).optional().default(''),
  tags: z.string().optional().default(''),
})

export type InfluencerCSVRow = z.infer<typeof influencerRowSchema>

export interface ColumnMapping {
  [csvHeader: string]: string // csvHeader -> our field name
}

export const MAPPABLE_FIELDS = [
  { key: 'email', label: 'Email', required: true },
  { key: 'first_name', label: 'First Name', required: false },
  { key: 'last_name', label: 'Last Name', required: false },
  { key: 'primary_platform', label: 'Platform', required: false },
  { key: 'platform_handle', label: 'Platform Handle', required: false },
  { key: 'audience_size', label: 'Audience Size', required: false },
  { key: 'niche', label: 'Niche', required: false },
  { key: 'country', label: 'Country', required: false },
  { key: 'language', label: 'Language', required: false },
  { key: 'tags', label: 'Tags (comma-separated)', required: false },
] as const

// Auto-detect column mapping from CSV headers
export function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const lowerHeaders = headers.map(h => h.toLowerCase().trim())

  const patterns: Record<string, RegExp[]> = {
    email: [/^e[-_]?mail$/i, /^email[-_]?addr/i, /^contact[-_]?email/i],
    first_name: [/^first[-_]?name$/i, /^fname$/i, /^prenom$/i, /^given[-_]?name$/i],
    last_name: [/^last[-_]?name$/i, /^lname$/i, /^nom$/i, /^surname$/i, /^family[-_]?name$/i],
    primary_platform: [/^platform$/i, /^social[-_]?platform$/i, /^network$/i],
    platform_handle: [/^handle$/i, /^username$/i, /^user[-_]?name$/i, /^screen[-_]?name$/i, /^platform[-_]?handle$/i],
    audience_size: [/^audience[-_]?size$/i, /^followers$/i, /^subscriber/i, /^follower[-_]?count$/i, /^subs$/i],
    niche: [/^niche$/i, /^category$/i, /^genre$/i, /^vertical$/i],
    country: [/^country$/i, /^location$/i, /^pays$/i, /^country[-_]?code$/i],
    language: [/^lang(uage)?$/i, /^langue$/i],
    tags: [/^tags?$/i, /^labels?$/i, /^categories$/i],
  }

  for (const [field, regexes] of Object.entries(patterns)) {
    for (let i = 0; i < lowerHeaders.length; i++) {
      if (regexes.some(r => r.test(headers[i]))) {
        mapping[headers[i]] = field
        break
      }
    }
  }

  return mapping
}

// Apply mapping to raw CSV rows
export function applyMapping(
  rawRows: Record<string, string>[],
  mapping: Record<string, string>
): { valid: InfluencerCSVRow[]; errors: { row: number; message: string }[] } {
  const valid: InfluencerCSVRow[] = []
  const errors: { row: number; message: string }[] = []

  // Invert mapping: our_field -> csv_header
  const invertedMapping: Record<string, string> = {}
  for (const [csvHeader, ourField] of Object.entries(mapping)) {
    if (ourField && ourField !== '__skip__') {
      invertedMapping[ourField] = csvHeader
    }
  }

  if (!invertedMapping.email) {
    return { valid: [], errors: [{ row: 0, message: 'Email column is required' }] }
  }

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const mapped: Record<string, string> = {}

    for (const [ourField, csvHeader] of Object.entries(invertedMapping)) {
      const val = raw[csvHeader]?.trim() ?? ''
      if (val) mapped[ourField] = val
    }

    // Skip completely empty rows
    if (!mapped.email) {
      errors.push({ row: i + 1, message: 'Missing email' })
      continue
    }

    const result = influencerRowSchema.safeParse(mapped)
    if (result.success) {
      valid.push(result.data)
    } else {
      errors.push({ row: i + 1, message: result.error.issues[0].message })
    }
  }

  return { valid, errors }
}
