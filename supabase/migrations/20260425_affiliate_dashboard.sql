-- Affiliate codes pour chaque user (self-service referral program)
CREATE TABLE IF NOT EXISTS public.affiliate_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  code TEXT NOT NULL UNIQUE,
  custom_handle TEXT UNIQUE,
  clicks INTEGER DEFAULT 0,
  signups INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  total_earned NUMERIC(10,2) DEFAULT 0,
  commission_rate NUMERIC(3,2) DEFAULT 0.20,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referral events tracking
CREATE TABLE IF NOT EXISTS public.referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_code_id UUID REFERENCES public.affiliate_codes(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('click', 'signup', 'conversion', 'payout')),
  referred_user_id UUID REFERENCES public.profiles(id),
  amount NUMERIC(10,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_codes_code ON public.affiliate_codes(code);
CREATE INDEX IF NOT EXISTS idx_affiliate_codes_custom_handle ON public.affiliate_codes(custom_handle);
CREATE INDEX IF NOT EXISTS idx_affiliate_codes_user_id ON public.affiliate_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_affiliate_code_id ON public.referral_events(affiliate_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_event_type ON public.referral_events(event_type);

-- RLS
ALTER TABLE public.affiliate_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own affiliate code" ON public.affiliate_codes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own affiliate code" ON public.affiliate_codes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users see own referral events" ON public.referral_events
  FOR SELECT USING (
    affiliate_code_id IN (
      SELECT id FROM public.affiliate_codes WHERE user_id = auth.uid()
    )
  );
