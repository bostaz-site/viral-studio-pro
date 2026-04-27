import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'

/**
 * POST /api/cron/cleanup-storage
 *
 * Cron quotidien (4h du matin via Netlify Scheduled Functions).
 * Supprime les clips rendus dont le TTL est expiré selon le plan de l'utilisateur :
 * - free: 7 jours
 * - pro: 30 jours
 * - studio: 90 jours
 *
 * Ne supprime que les render_jobs avec status = 'done'.
 * Met storage_path à NULL après suppression (garde la row pour l'historique).
 */

const TTL_DAYS: Record<string, number> = {
  free: 7,
  pro: 30,
  studio: 90,
}

const BATCH_LIMIT = 50

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  if (!apiKey || !cronSecret) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'API key missing' },
      { status: 401 }
    )
  }

  if (!timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Invalid API key' },
      { status: 401 }
    )
  }

  const admin = createAdminClient()

  try {
    const byPlan: Record<string, number> = {}
    let totalDeleted = 0
    let totalErrors = 0
    let remaining = BATCH_LIMIT

    for (const [plan, ttlDays] of Object.entries(TTL_DAYS)) {
      if (remaining <= 0) break

      const cutoff = new Date(Date.now() - ttlDays * 86400000).toISOString()

      // Get user IDs with this plan
      const { data: users, error: usersError } = await admin
        .from('profiles')
        .select('id')
        .eq('plan', plan)

      if (usersError) {
        console.error(`[cleanup-storage] Error fetching ${plan} users:`, usersError.message)
        continue
      }
      if (!users || users.length === 0) continue

      const userIds = users.map(u => u.id)

      // Find expired render_jobs for these users
      const { data: expired, error: expiredError } = await admin
        .from('render_jobs')
        .select('id, storage_path, user_id')
        .eq('status', 'done')
        .not('storage_path', 'is', null)
        .in('user_id', userIds)
        .lt('created_at', cutoff)
        .limit(remaining)

      if (expiredError) {
        console.error(`[cleanup-storage] Error fetching expired jobs (${plan}):`, expiredError.message)
        continue
      }
      if (!expired || expired.length === 0) continue

      // Delete files from Storage and null out storage_path
      const results = await Promise.allSettled(
        expired.map(async (job) => {
          const storagePath = job.storage_path as string
          const thumbPath = storagePath.replace(/\.mp4$/, '_thumb.png')

          // Delete clip from storage
          const { error: clipDelError } = await admin.storage
            .from('clips')
            .remove([storagePath])

          if (clipDelError) {
            console.warn(`[cleanup-storage] Failed to delete clip ${storagePath}:`, clipDelError.message)
          }

          // Delete thumbnail (best-effort)
          await admin.storage
            .from('thumbnails')
            .remove([thumbPath])

          // Mark as expired and null out storage_path (keep row for history)
          const { error: updateError } = await admin
            .from('render_jobs')
            .update({ status: 'expired', storage_path: null, updated_at: new Date().toISOString() })
            .eq('id', job.id)

          if (updateError) throw updateError

          const ageDays = Math.round((Date.now() - new Date(cutoff).getTime()) / 86400000 + ttlDays)
          console.log(`[cleanup-storage] Deleted ${storagePath} (user: ${job.user_id}, plan: ${plan}, age: ${ageDays}d)`)
        })
      )

      let planDeleted = 0
      for (const r of results) {
        if (r.status === 'fulfilled') planDeleted++
        else totalErrors++
      }

      byPlan[plan] = planDeleted
      totalDeleted += planDeleted
      remaining -= expired.length
    }

    const message = totalDeleted > 0
      ? `${totalDeleted} expired clips cleaned up`
      : 'No expired clips found'

    console.log(`[cleanup-storage] ${message} (errors: ${totalErrors})`)

    return NextResponse.json({
      data: { deleted: totalDeleted, errors: totalErrors, byPlan },
      error: null,
      message,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[cleanup-storage] Error:', message)
    return NextResponse.json({ data: null, error: message }, { status: 500 })
  }
}

// GET shortcut for manual testing
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 401 })
  const headers = new Headers(req.headers)
  headers.set('x-api-key', key)
  return POST(new NextRequest(req.url, { method: 'POST', headers }))
}
