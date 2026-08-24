import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const bodySchema = z.object({
  clipId: z.string().min(1),
})

interface BankJob {
  id: string
  clip_id: string
  status: string
  storage_path: string | null
  removed_from_bank_at: string | null
  created_at: string
}

export const POST = withAuth(async (request: NextRequest, user) => {
  const body = await request.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: 'Invalid request', message: parsed.error.issues[0]?.message ?? 'Validation error' },
      { status: 400 }
    )
  }

  const { clipId } = parsed.data
  const admin = createAdminClient()

  // Find the latest done render job for this clip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job } = await (admin as any)
    .from('render_jobs')
    .select('id, clip_id, status, storage_path, removed_from_bank_at, created_at')
    .eq('clip_id', clipId)
    .eq('user_id', user.id)
    .in('status', ['done', 'degraded'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as { data: BankJob | null; error: unknown }

  if (!job) {
    return NextResponse.json(
      { data: null, error: 'No completed render found for this clip', message: 'Render le clip d\'abord' },
      { status: 404 }
    )
  }

  // If previously removed from bank, restore it
  if (job.removed_from_bank_at) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (admin as any)
      .from('render_jobs')
      .update({ removed_from_bank_at: null })
      .eq('id', job.id)

    if (updateError) {
      return NextResponse.json(
        { data: null, error: 'Failed to place in bank', message: 'Erreur serveur' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    data: { id: job.id, clipId: job.clip_id, storagePath: job.storage_path },
    error: null,
    message: 'Clip placed in bank',
  })
})
