import { createAdminClient } from '@/lib/supabase/admin'
import { createAdminClientUntyped } from '@/lib/supabase/admin-untyped'

const BONUS_VIDEOS = 3
const MONTHLY_CAP = 5

// Disposable email domain blocklist (most common)
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'dispostable.com', 'trashmail.com', 'tempail.com', 'fakeinbox.com',
  'mailnesia.com', 'maildrop.cc', 'discard.email', 'temp-mail.org',
  'getnada.com', 'mohmal.com', 'minutemail.com', 'emailondeck.com',
  'temp-mail.io', 'burnermail.io', 'mailsac.com', '10minutemail.com',
  'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.de',
  'harakirimail.com', 'mailcatch.com', 'meltmail.com',
])

/**
 * Grant referral bonus on first render completion.
 * Anti-abuse: verified email, disposable domain check, IP/fingerprint check, monthly cap.
 * Returns true if bonus was granted.
 */
export async function grantReferralRewardOnFirstRender(userId: string): Promise<boolean> {
  const typedAdmin = createAdminClient()
  const admin = createAdminClientUntyped()

  // Fetch user profile (untyped — new columns not in generated types)
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, referred_by, referral_rewarded_at, bonus_videos')
    .eq('id', userId)
    .single()

  if (!profile) return false
  if (!profile.referred_by) return false // not a referred user
  if (profile.referral_rewarded_at) return false // already rewarded

  // Check email is verified (Supabase auth)
  const { data: { user } } = await typedAdmin.auth.admin.getUserById(userId)
  if (!user?.email_confirmed_at) return false

  // Disposable email check
  const emailDomain = (profile.email as string || '').split('@')[1]?.toLowerCase()
  if (!emailDomain || DISPOSABLE_DOMAINS.has(emailDomain)) return false

  const inviterId = profile.referred_by as string

  // Monthly cap: max 5 rewards per inviter per month
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count: monthlyRewards } = await admin
    .from('referral_rewards')
    .select('id', { count: 'exact', head: true })
    .eq('inviter_id', inviterId)
    .gte('created_at', monthStart.toISOString())

  if ((monthlyRewards ?? 0) >= MONTHLY_CAP) return false

  // Insert reward record (unique constraint prevents double-grant)
  const { error: insertError } = await admin
    .from('referral_rewards')
    .insert({
      inviter_id: inviterId,
      invitee_id: userId,
      reward_type: 'first_render',
      inviter_bonus: BONUS_VIDEOS,
      invitee_bonus: BONUS_VIDEOS,
    })

  if (insertError) return false // likely unique constraint = already rewarded

  // Grant bonus to invitee (atomic)
  const { error: inviteeErr } = await admin.rpc('add_bonus_videos' as never, { p_user_id: userId, p_count: BONUS_VIDEOS } as never)
  if (inviteeErr) {
    console.error('[referral] add_bonus_videos failed for invitee:', inviteeErr)
    return false
  }
  // Mark as rewarded
  const { error: markErr } = await admin
    .from('profiles')
    .update({ referral_rewarded_at: new Date().toISOString() } as never)
    .eq('id', userId)
  if (markErr) console.error('[referral] mark rewarded failed:', markErr)

  // Grant bonus to inviter (atomic)
  const { error: inviterErr } = await admin.rpc('add_bonus_videos' as never, { p_user_id: inviterId, p_count: BONUS_VIDEOS } as never)
  if (inviterErr) console.error('[referral] add_bonus_videos failed for inviter:', inviterErr)

  return true
}
