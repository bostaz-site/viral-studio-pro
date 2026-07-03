-- Pack / comp accounts — free Pro access for testers (friends & family)
-- is_comp = true → treated as plan='pro' for all enforcement
-- comp_note = who/why (e.g. "brother of Samy", "beta tester wave 1")
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_comp BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS comp_note TEXT;

COMMENT ON COLUMN public.profiles.is_comp IS 'Comp/pack account — gets Pro features for free, excluded from MRR';
COMMENT ON COLUMN public.profiles.comp_note IS 'Why this account is comped (who/reason)';
