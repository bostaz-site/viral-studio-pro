import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isTikTokReviewMode, canOverrideTikTokReview } from '@/lib/audit/tiktok-review-mode'
import { generateLabPrompt, buildPromptFilePath } from '@/lib/lab/generate-prompt'
import { pushFileToGitHub } from '@/lib/audit/github-push'

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

    // ── Cold email reply buttons ──
    if (customId.startsWith('generate_promo:')) {
      const email = customId.split(':')[1]
      const code = generatePromoCode(email)
      return NextResponse.json({
        type: 4,
        data: {
          content: `Promo code generated: \`${code}\`\nLink: https://viralanimal.com/upgrade?promo=${code}\n\nSend this to ${email} in your reply.`,
          flags: 64,
        },
      })
    }

    if (customId.startsWith('suggest_reply:')) {
      const email = customId.split(':')[1]
      return NextResponse.json({
        type: 4,
        data: {
          content: `Draft reply for ${email}:\n\n> Hey! Thanks for your interest in Viral Animal. I'd love to set you up with a free trial — here's a personal link: https://viralanimal.com/signup\n>\n> If you want to try the full editor, use code **COLLAB20** for 20% off.\n>\n> Let me know if you have any questions!`,
          flags: 64,
        },
      })
    }

    if (customId.startsWith('mark_spam:')) {
      const email = customId.split(':')[1]
      return NextResponse.json({
        type: 4,
        data: { content: `Marked ${email} as spam. Will be excluded from future campaigns.`, flags: 64 },
      })
    }

    // ── Lab deep dive buttons ──
    if (customId.startsWith('lab_accept:')) {
      const diveId = customId.split(':')[1]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const labAdmin = createAdminClient() as any

      const { data: dive } = await labAdmin
        .from('lab_deep_dives')
        .select('feature_area, cycle_number, target_metric, target_delta_minimum, measurement_method, final_recommendation, recommendation_rationale, kill_switch_scenario, kill_switch_severity, alternatives_rejected, estimated_effort_hours, confidence')
        .eq('id', diveId)
        .single()

      await labAdmin.from('lab_deep_dives').update({
        user_action: 'accepted',
        user_action_at: new Date().toISOString(),
      }).eq('id', diveId)

      let workflowTriggered = false

      if (dive) {
        // Generate prompt file and push to GitHub
        const prompt = generateLabPrompt(dive)
        const { filepath } = buildPromptFilePath(dive)

        try {
          await pushFileToGitHub(filepath, prompt, `lab: accept ${dive.feature_area} cycle ${dive.cycle_number}`)
        } catch {
          // Best-effort
        }

        await labAdmin.from('lab_deep_dives').update({ accepted_prompt_path: filepath }).eq('id', diveId)

        // Trigger auto-execute workflow
        const githubToken = process.env.GITHUB_TOKEN
        if (githubToken) {
          try {
            const wfRes = await fetch(
              'https://api.github.com/repos/bostaz-site/viral-studio-pro/actions/workflows/lab-auto-execute.yml/dispatches',
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${githubToken}`,
                  'Accept': 'application/vnd.github+json',
                  'X-GitHub-Api-Version': '2022-11-28',
                },
                body: JSON.stringify({
                  ref: 'master',
                  inputs: {
                    prompt_path: filepath,
                    dive_id: diveId,
                    feature_area: dive.feature_area,
                  },
                }),
              }
            )
            workflowTriggered = wfRes.status === 204
          } catch {
            // Best-effort
          }
        }

        await labAdmin.from('lab_deep_dives').update({
          status: workflowTriggered ? 'executing' : 'completed',
        }).eq('id', diveId)
      }

      const featureName = dive?.feature_area ?? diveId.slice(0, 8)
      const msg = workflowTriggered
        ? `Lab dive **${featureName}** accepted.\n\nClaude Code is auto-executing now. Check Discord in 5-15 min for the PR.`
        : `Lab dive **${featureName}** accepted. Check /admin/lab for the prompt.`
      return NextResponse.json({
        type: 4,
        data: { content: msg, flags: 64 },
      })
    }

    if (customId.startsWith('lab_later:')) {
      const diveId = customId.split(':')[1]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const labAdmin = createAdminClient() as any
      await labAdmin.from('lab_deep_dives').update({ user_action: 'later', user_action_at: new Date().toISOString() }).eq('id', diveId)
      return NextResponse.json({
        type: 4,
        data: { content: 'Lab dive parked for later.', flags: 64 },
      })
    }

    if (customId.startsWith('lab_discard:')) {
      const diveId = customId.split(':')[1]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const labAdmin = createAdminClient() as any
      await labAdmin.from('lab_deep_dives').update({ status: 'discarded', user_action: 'discarded', user_action_at: new Date().toISOString() }).eq('id', diveId)
      return NextResponse.json({
        type: 4,
        data: { content: 'Lab dive discarded.', flags: 64 },
      })
    }

    if (customId.startsWith('lab_force:')) {
      const area = customId.split(':')[1]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const labAdmin = createAdminClient() as any
      await labAdmin.from('lab_queue').update({ forced_next: true, next_scheduled_at: new Date().toISOString() }).eq('feature_area', area)
      return NextResponse.json({
        type: 4,
        data: { content: `Forced ${area} to front of lab queue.`, flags: 64 },
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

function generatePromoCode(email: string): string {
  const name = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10)
  return `${name}20`
}
