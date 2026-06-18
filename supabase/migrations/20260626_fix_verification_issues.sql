-- Fix Issue 1: pr_reviews missing RLS policy
CREATE POLICY "Admin can manage pr_reviews" ON public.pr_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('owner', 'ops')
    )
  );

-- Fix Issue 4: Drop stale columns from root_cause_clusters
ALTER TABLE public.root_cause_clusters
  DROP COLUMN IF EXISTS predicted_impact_revenue,
  DROP COLUMN IF EXISTS predicted_impact_conversion;
