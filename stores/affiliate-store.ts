import { create } from 'zustand'

export interface Affiliate {
  id: string
  name: string
  email: string | null
  handle: string
  platform: string | null
  niche: string | null
  commission_rate: number | null
  promo_code: string | null
  promo_discount_percent: number | null
  status: string | null
  notes: string | null
  total_clicks: number | null
  total_signups: number | null
  total_conversions: number | null
  total_revenue: number | null
  total_commission_earned: number | null
  total_commission_paid: number | null
  created_at: string | null
  updated_at: string | null
}

export interface Referral {
  id: string
  affiliate_id: string | null
  user_id: string | null
  source: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  status: string | null
  signed_up_at: string | null
  converted_at: string | null
  revenue_generated: number | null
  commission_amount: number | null
  created_at: string | null
}

export interface Payout {
  id: string
  affiliate_id: string | null
  amount: number
  currency: string | null
  status: string | null
  payment_method: string | null
  notes: string | null
  period_start: string | null
  period_end: string | null
  paid_at: string | null
  created_at: string | null
}

export interface AffiliateDetail {
  affiliate: Affiliate
  referrals: Referral[]
  payouts: Payout[]
}

export interface AffiliateState {
  affiliates: Affiliate[]
  loading: boolean
  error: string | null
  selectedDetail: AffiliateDetail | null
  detailLoading: boolean

  fetchAffiliates: (status?: string) => Promise<void>
  createAffiliate: (data: {
    name: string
    handle: string
    email?: string
    platform?: string
    niche?: string
    commission_rate?: number
    promo_discount_percent?: number
    notes?: string
  }) => Promise<Affiliate | null>
  updateAffiliate: (id: string, data: Partial<Affiliate>) => Promise<void>
  deleteAffiliate: (id: string) => Promise<void>
  fetchDetail: (id: string) => Promise<void>
  createPayout: (affiliateId: string, data: {
    amount: number
    notes?: string
    period_start?: string
    period_end?: string
  }) => Promise<void>
}

export const useAffiliateStore = create<AffiliateState>((set, get) => ({
  affiliates: [],
  loading: false,
  error: null,
  selectedDetail: null,
  detailLoading: false,

  fetchAffiliates: async (status) => {
    set({ loading: true, error: null })
    try {
      const params = status ? `?status=${status}` : ''
      const res = await fetch(`/api/admin/affiliates${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set({ affiliates: json.data ?? [], loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch', loading: false })
    }
  },

  createAffiliate: async (data) => {
    try {
      const res = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const affiliate = json.data as Affiliate
      set(state => ({ affiliates: [affiliate, ...state.affiliates] }))
      return affiliate
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create' })
      return null
    }
  },

  updateAffiliate: async (id, data) => {
    try {
      const res = await fetch(`/api/admin/affiliates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set(state => ({
        affiliates: state.affiliates.map(a => a.id === id ? { ...a, ...json.data } : a),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update' })
    }
  },

  deleteAffiliate: async (id) => {
    try {
      const res = await fetch(`/api/admin/affiliates/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set(state => ({ affiliates: state.affiliates.filter(a => a.id !== id) }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete' })
    }
  },

  fetchDetail: async (id) => {
    set({ detailLoading: true })
    try {
      const res = await fetch(`/api/admin/affiliates/${id}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set({ selectedDetail: json.data, detailLoading: false })
    } catch {
      set({ detailLoading: false })
    }
  },

  createPayout: async (affiliateId, data) => {
    try {
      const res = await fetch(`/api/admin/affiliates/${affiliateId}/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      // Refresh detail and affiliates
      await get().fetchDetail(affiliateId)
      await get().fetchAffiliates()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create payout' })
    }
  },
}))
