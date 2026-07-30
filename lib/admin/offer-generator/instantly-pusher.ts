import { createAdminClient } from '@/lib/supabase/admin'
import { filterSuppressed4Way } from '@/lib/admin/compliance/suppression-check'

export async function pushOffersToInstantly(offerIds: string[]): Promise<{
  pushed: number
  failed: number
  suppressed: number
}> {
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: offers } = await (admin as any)
    .from('generated_offers')
    .select('id, influencer_id')
    .in('id', offerIds)
    .eq('status', 'draft')
    .eq('passed_compliance', true)

  if (!offers || offers.length === 0) return { pushed: 0, failed: 0, suppressed: 0 }

  // Re-check suppression at push time (lead may have unsubscribed/bounced since generation)
  const influencerIds = [...new Set((offers as { id: string; influencer_id: string }[]).map(o => o.influencer_id).filter(Boolean))]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: influencers } = await (admin as any)
    .from('influencers')
    .select('id, email, platform_handle')
    .in('id', influencerIds)

  const infList = (influencers ?? []) as { id: string; email: string | null; platform_handle: string | null }[]

  const contacts = infList.map(i => ({
    email: i.email ?? null,
    handle: i.platform_handle ?? null,
  }))

  const suppressionResult = await filterSuppressed4Way(contacts)
  const suppressedInfluencerIds = new Set(
    suppressionResult.suppressed.map(s => infList[s.index]?.id).filter(Boolean)
  )

  const typedOffers = offers as { id: string; influencer_id: string }[]

  // Split offers into pushable and suppressed
  const pushable = typedOffers.filter(o => !suppressedInfluencerIds.has(o.influencer_id))
  const blocked = typedOffers.filter(o => suppressedInfluencerIds.has(o.influencer_id))

  // Mark suppressed offers
  if (blocked.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('generated_offers')
      .update({ status: 'suppressed' })
      .in('id', blocked.map(o => o.id))
  }

  // Mark pushable as queued
  if (pushable.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('generated_offers')
      .update({ status: 'queued' })
      .in('id', pushable.map(o => o.id))
  }

  return { pushed: pushable.length, failed: 0, suppressed: blocked.length }
}
