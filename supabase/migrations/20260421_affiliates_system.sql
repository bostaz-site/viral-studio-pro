-- Affiliates system: affiliates + referrals + affiliate_payouts

-- Affiliates (influencer partners)
CREATE TABLE IF NOT EXISTS public.affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    handle TEXT NOT NULL UNIQUE,
    platform TEXT,
    niche TEXT,
    commission_rate FLOAT DEFAULT 0.20,
    promo_code TEXT UNIQUE,
    promo_discount_percent INTEGER DEFAULT 20,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
    notes TEXT,
    total_clicks INTEGER DEFAULT 0,
    total_signups INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_revenue FLOAT DEFAULT 0,
    total_commission_earned FLOAT DEFAULT 0,
    total_commission_paid FLOAT DEFAULT 0,
    stripe_account_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals (each click/signup/conversion tracked)
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('link', 'promo_code')),
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    status TEXT DEFAULT 'clicked' CHECK (status IN ('clicked', 'signed_up', 'converted', 'churned')),
    signed_up_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    revenue_generated FLOAT DEFAULT 0,
    commission_amount FLOAT DEFAULT 0,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payouts (payments to affiliates)
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    amount FLOAT NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
    payment_method TEXT DEFAULT 'stripe',
    stripe_transfer_id TEXT,
    notes TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliates_handle ON public.affiliates(handle);
CREATE INDEX IF NOT EXISTS idx_affiliates_promo_code ON public.affiliates(promo_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON public.affiliates(status);
CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON public.referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON public.referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON public.affiliate_payouts(affiliate_id);

-- RLS
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Admin-only access for affiliates and payouts (via service role key)
-- No user-facing RLS policies needed since we use createAdminClient()

-- Users can read their own referrals
CREATE POLICY "Users can read own referrals"
    ON public.referrals
    FOR SELECT
    USING (auth.uid() = user_id);
