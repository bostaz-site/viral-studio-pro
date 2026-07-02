-- Add ip_match to attribution_type CHECK constraint
ALTER TABLE public.affiliate_referrals
  DROP CONSTRAINT IF EXISTS affiliate_referrals_attribution_type_check;

ALTER TABLE public.affiliate_referrals
  ADD CONSTRAINT affiliate_referrals_attribution_type_check
  CHECK (attribution_type IN ('cookie', 'fingerprint', 'ip_match', 'manual_assigned', 'magic_link'));
