-- Atomic increment of bonus_videos (replaces read-modify-write in webhook + referral)
CREATE OR REPLACE FUNCTION add_bonus_videos(p_user_id UUID, p_count INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET bonus_videos = bonus_videos + p_count, updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic increment of affiliate conversion totals
CREATE OR REPLACE FUNCTION increment_affiliate_conversion(
  p_affiliate_id UUID,
  p_revenue NUMERIC,
  p_commission NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE affiliates
  SET
    total_conversions = COALESCE(total_conversions, 0) + 1,
    total_revenue = COALESCE(total_revenue, 0) + p_revenue,
    total_commission_earned = COALESCE(total_commission_earned, 0) + p_commission,
    updated_at = NOW()
  WHERE id = p_affiliate_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic paywall save grant: only succeeds if not already used
CREATE OR REPLACE FUNCTION grant_paywall_save(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE profiles
  SET paywall_save_used = true,
      bonus_videos = bonus_videos + 1,
      updated_at = NOW()
  WHERE id = p_user_id
    AND paywall_save_used IS NOT TRUE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
