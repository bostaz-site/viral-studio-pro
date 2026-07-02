import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { logger } from '@/lib/logger'

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
        logger.error(`[cleanup-storage] Error fetching ${plan} users:`, usersError.message)
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
        logger.error(`[cleanup-storage] Error fetching expired jobs (${plan}):`, expiredError.message)
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
            logger.warn(`[cleanup-storage] Failed to delete clip ${storagePath}:`, clipDelError.message)
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
          logger.info(`[cleanup-storage] Deleted ${storagePath} (user: ${job.user_id}, plan: ${plan}, age: ${ageDays}d)`)
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

    // --- Orphaned uploads: videos stuck in 'uploading' for >24h ---
    let orphansCleaned = 0
    const orphanCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: orphans } = await admin
      .from('videos')
      .select('id, storage_path')
      .eq('status', 'uploading')
      .lt('created_at', orphanCutoff)
      .limit(50)

    if (orphans && orphans.length > 0) {
      for (const v of orphans) {
        if (v.storage_path) {
          await admin.storage.from('videos').remove([v.storage_path]).catch(() => {})
        }
        await admin.from('videos').delete().eq('id', v.id)
        orphansCleaned++
      }
      logger.info(`[cleanup-storage] Cleaned ${orphansCleaned} orphaned upload(s)`)
    }

    const message = totalDeleted > 0 || orphansCleaned > 0
      ? `${totalDeleted} expired clips + ${orphansCleaned} orphaned uploads cleaned`
      : 'No expired clips or orphans found'

    logger.info(`[cleanup-storage] ${message} (errors: ${totalErrors})`)

    return NextResponse.json({
      data: { deleted: totalDeleted, errors: totalErrors, byPlan, orphansCleaned },
      error: null,
      message,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    logger.error('[cleanup-storage] Error:', message)
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
