-- Track real Stripe subscription amount for accurate MRR
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_amount_cents INTEGER;
