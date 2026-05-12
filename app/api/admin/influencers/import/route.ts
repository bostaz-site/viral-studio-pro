import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { influencerRowSchema, type InfluencerCSVRow } from '@/lib/admin/csv-parser'

const BATCH_SIZE = 100

const importSchema = z.object({
  rows: z.array(influencerRowSchema).min(1).max(10000),
  fileName: z.string().optional().default('unknown.csv'),
})

// POST — bulk import influencers from CSV
export const POST = withAdmin(async (req, user) => {
  const body = await req.json()
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { rows, fileName } = parsed.data
  const supabase = createAdminClient()

  // Create import batch
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      imported_by: user.id,
      source: 'csv_upload',
      file_name: fileName,
      rows_total: rows.length,
      status: 'processing',
    })
    .select()
    .single()

  if (batchError) return errorResponse(`Failed to create batch: ${batchError.message}`, 500)

  // Process in background-like chunks
  let imported = 0
  let duplicates = 0
  let suppressed = 0
  let failed = 0
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)

    // 1. Check suppression list (batch query)
    const emails = chunk.map(r => r.email.toLowerCase())
    const { data: suppressedEmails } = await supabase
      .from('suppression_list')
      .select('email')
      .in('email', emails)

    const suppressedSet = new Set(
      (suppressedEmails ?? []).map(s => s.email?.toLowerCase()).filter(Boolean)
    )

    // Filter out suppressed
    const notSuppressed: InfluencerCSVRow[] = []
    for (const row of chunk) {
      if (suppressedSet.has(row.email.toLowerCase())) {
        suppressed++
      } else {
        notSuppressed.push(row)
      }
    }

    if (notSuppressed.length === 0) {
      // Update progress even if all suppressed
      await updateBatchProgress(supabase, batch.id, {
        rows_imported: imported,
        rows_skipped_duplicate: duplicates,
        rows_skipped_suppression: suppressed,
        rows_failed: failed,
      })
      continue
    }

    // 2. Batch insert with ON CONFLICT DO NOTHING
    const insertRows = notSuppressed.map(row => ({
      email: row.email.toLowerCase(),
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      primary_platform: row.primary_platform || null,
      platform_handle: row.platform_handle || null,
      audience_size: row.audience_size ?? null,
      niche: row.niche || null,
      country: row.country || null,
      language: row.language || 'en',
      tags: row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      status: 'cold' as const,
      source: `csv_import:${batch.id}`,
    }))

    const { data: insertedData, error: insertError } = await supabase
      .from('influencers')
      .upsert(insertRows, {
        onConflict: 'email',
        ignoreDuplicates: true,
      })
      .select('id')

    if (insertError) {
      // If batch insert fails, try row by row
      for (let j = 0; j < insertRows.length; j++) {
        const { error: rowError } = await supabase
          .from('influencers')
          .upsert([insertRows[j]], { onConflict: 'email', ignoreDuplicates: true })
          .select('id')

        if (rowError) {
          failed++
          errors.push({ row: i + j + 1, message: rowError.message })
        } else {
          // We can't easily tell if it was a dup or new insert in row-by-row mode
          imported++
        }
      }
    } else {
      const insertedCount = insertedData?.length ?? 0
      imported += insertedCount
      duplicates += notSuppressed.length - insertedCount
    }

    // 3. Update batch progress
    await updateBatchProgress(supabase, batch.id, {
      rows_imported: imported,
      rows_skipped_duplicate: duplicates,
      rows_skipped_suppression: suppressed,
      rows_failed: failed,
    })
  }

  // Mark batch complete
  const finalStatus = failed > 0 && imported === 0 ? 'failed' :
    failed > 0 ? 'partial' : 'completed'

  await supabase
    .from('import_batches')
    .update({
      status: finalStatus,
      rows_imported: imported,
      rows_skipped_duplicate: duplicates,
      rows_skipped_suppression: suppressed,
      rows_failed: failed,
      errors: errors.slice(0, 100), // Cap stored errors
      completed_at: new Date().toISOString(),
    })
    .eq('id', batch.id)

  return jsonResponse({
    batchId: batch.id,
    status: finalStatus,
    imported,
    duplicates,
    suppressed,
    failed,
    errors: errors.slice(0, 20),
  })
})

// GET — get batch status (for polling)
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const batchId = url.searchParams.get('batchId')

  if (!batchId) return errorResponse('batchId is required')

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (error) return errorResponse(error.message, 404)
  return jsonResponse(data)
})

async function updateBatchProgress(
  supabase: ReturnType<typeof createAdminClient>,
  batchId: string,
  counters: {
    rows_imported: number
    rows_skipped_duplicate: number
    rows_skipped_suppression: number
    rows_failed: number
  }
) {
  await supabase
    .from('import_batches')
    .update(counters)
    .eq('id', batchId)
}
