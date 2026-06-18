import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isTikTokReviewMode, canOverrideTikTokReview } from '@/lib/audit/tiktok-review-mode'

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY ?? ''

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-signature-ed25519')
  const timestamp = req.headers.get('x-signature-timestamp')
  const body = await req.text()

  if (!signature || !timestamp || !DISCORD_PUBLIC_KEY) {
    return new NextResponse('Missing signature headers', { status: 401 })
  }

  // Verify Discord signature using Web Crypto (no extra dependency)
  const isValid = await verifyDiscordSignature(body, signature, timestamp, DISCORD_PUBLIC_KEY)
  if (!isValid) {
    return new NextResponse('Bad signature', { status: 401 })
  }

  const interaction = JSON.parse(body)

  // PING — Discord verification handshake
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 })
  }

  // MESSAGE_COMPONENT (button click)
  if (interaction.type === 3) {
    const customId: string = interaction.data?.custom_id ?? ''
    const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown'

    if (customId.startsWith('accept_prompt:')) {
      const promptId = customId.split(':')[1]

      if (isTikTokReviewMode()) {
        // Queue the accept instead of executing it
        await handleTikTokQueuedAccept(promptId)
        return NextResponse.json({
          type: 4,
          data: {
            content: `\u23F8\uFE0F **Auto-fix paused — TikTok review in progress.**\n\nPrompt \`${promptId}\` saved as queued.\nIt will auto-launch once TIKTOK_REVIEW_MODE is set to false.`,
            flags: 64,
          },
        })
      }

      await handleAccept(promptId, userId)
      return NextResponse.json({
        type: 4,
        data: { content: `Launched auto-fix for prompt \`${promptId}\`. PR will be ready in ~5-10 min.`, flags: 64 },
      })
    }

    // Emergency override during TikTok review (security/data-loss only)
    if (customId.startsWith('override_accept:')) {
      const promptId = customId.split(':')[1]
      console.log(`[discord-interactions] TIKTOK OVERRIDE: ${promptId} by ${userId}`)
      await handleAccept(promptId, userId)
      return NextResponse.json({
        type: 4,
        data: { content: `\uD83D\uDEA8 **Override executed** — auto-fix launched for \`${promptId}\` despite TikTok review mode.`, flags: 64 },
      })
    }

    if (customId.startsWith('later_prompt:')) {
      return NextResponse.json({
        type: 4,
        data: { content: 'Prompt parked for later.', flags: 64 },
      })
    }

    if (customId.startsWith('discard_prompt:')) {
      const promptId = customId.split(':')[1]
      await handleDiscard(promptId)
      return NextResponse.json({
        type: 4,
        data: { content: `Prompt \`${promptId}\` discarded.`, flags: 64 },
      })
    }

    // ── Root cause cluster buttons ──
    if (customId.startsWith('accept_cluster:')) {
      const clusterId = customId.split(':')[1]

      if (isTikTokReviewMode()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = createAdminClient() as any
        await admin
          .from('root_cause_clusters')
          .update({ tiktok_review_blocked: true, accepted_at: new Date().toISOString() })
          .eq('id', clusterId)
        return NextResponse.json({
          type: 4,
          data: { content: `\u23F8\uFE0F Cluster queued — TikTok review in progress. Will resume after TIKTOK_REVIEW_MODE=false.`, flags: 64 },
        })
      }

      await handleClusterAccept(clusterId, userId)
      return NextResponse.json({
        type: 4,
        data: { content: `\u2705 Cluster accepted! GitHub workflow triggered. PR will be ready in ~5-10 min.`, flags: 64 },
      })
    }

    if (customId.startsWith('later_cluster:')) {
      return NextResponse.json({
        type: 4,
        data: { content: 'Cluster parked for later.', flags: 64 },
      })
    }

    if (customId.startsWith('discard_cluster:')) {
      const clusterId = customId.split(':')[1]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = createAdminClient() as any
      await admin
        .from('root_cause_clusters')
        .update({ status: 'discarded' })
        .eq('id', clusterId)
      return NextResponse.json({
        type: 4,
        data: { content: 'Cluster discarded.', flags: 64 },
      })
    }
  }

  return NextResponse.json({ type: 4, data: { content: 'Unknown interaction', flags: 64 } })
}

async function handleAccept(promptId: string, userId: string) {
  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    console.error('[discord-interactions] GITHUB_TOKEN not set')
    return
  }

  // Mark related findings as auto_fixing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  await admin
    .from('audit_findings')
    .update({ auto_fix_status: 'in_progress' })
    .eq('status', 'open')

  // Trigger GitHub Actions workflow via repository_dispatch
  const res = await fetch('https://api.github.com/repos/bostaz-site/viral-studio-pro/dispatches', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      event_type: 'auto-fix-launch',
      client_payload: { prompt_id: promptId, accepted_by: userId },
    }),
  })

  if (!res.ok) {
    console.error(`[discord-interactions] GitHub dispatch failed: ${res.status} ${await res.text()}`)
  } else {
    console.log(`[discord-interactions] Dispatched auto-fix for prompt ${promptId}`)
  }
}

async function handleClusterAccept(clusterId: string, userId: string) {
  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    console.error('[discord-interactions] GITHUB_TOKEN not set')
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  await admin
    .from('root_cause_clusters')
    .update({ status: 'in_progress', accepted_at: new Date().toISOString() })
    .eq('id', clusterId)

  const res = await fetch('https://api.github.com/repos/bostaz-site/viral-studio-pro/dispatches', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      event_type: 'auto-fix-launch',
      client_payload: { cluster_id: clusterId, accepted_by: userId },
    }),
  })

  if (!res.ok) {
    console.error(`[discord-interactions] GitHub dispatch failed for cluster: ${res.status}`)
  } else {
    console.log(`[discord-interactions] Dispatched auto-fix for cluster ${clusterId}`)
  }
}

async function handleTikTokQueuedAccept(promptId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Mark related findings as blocked by TikTok review
  await admin
    .from('audit_findings')
    .update({
      tiktok_review_blocked: true,
      accepted_at: new Date().toISOString(),
    })
    .eq('status', 'open')

  // Also mark clusters
  await admin
    .from('root_cause_clusters')
    .update({
      tiktok_review_blocked: true,
      accepted_at: new Date().toISOString(),
    })
    .eq('status', 'identified')

  console.log(`[discord-interactions] TikTok review mode: queued accept for ${promptId}`)
}

async function handleDiscard(promptId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  await admin
    .from('audit_findings')
    .update({ auto_fix_status: 'not_attempted' })
    .eq('status', 'open')
    .ilike('id', `${promptId}%`)
}

// ── Ed25519 signature verification using Web Crypto API ──────────────────
async function verifyDiscordSignature(
  body: string,
  signature: string,
  timestamp: string,
  publicKey: string,
): Promise<boolean> {
  try {
    const keyData = hexToUint8Array(publicKey)
    const keyBuf = new ArrayBuffer(keyData.byteLength)
    new Uint8Array(keyBuf).set(keyData)
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuf,
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify'],
    )
    const message = new TextEncoder().encode(timestamp + body)
    const sig = hexToUint8Array(signature)
    const sigBuf = new ArrayBuffer(sig.byteLength)
    new Uint8Array(sigBuf).set(sig)
    return crypto.subtle.verify('Ed25519', key, sigBuf, message)
  } catch {
    return false
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}
