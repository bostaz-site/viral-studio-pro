import { createAdminClient } from '@/lib/supabase/admin'

export async function pushOffersToInstantly(offerIds: string[]): Promise<{
  pushed: number
  failed: number
}> {
  const admin = createAdminClient()

  const { data: offers } = await admin
    .from('generated_offers')
    .select('id')
    .in('id', offerIds)
    .eq('status', 'draft')
    .eq('passed_compliance', true)

  if (!offers || offers.length === 0) return { pushed: 0, failed: 0 }

  // Mark as queued (Instantly push via API or manual CSV export)
  await admin
    .from('generated_offers')
    .update({ status: 'queued' })
    .in('id', offers.map(o => o.id))

  return { pushed: offers.length, failed: 0 }
}
