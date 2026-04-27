-- Refund video usage credits for zombie render jobs
-- Used by the cleanup-render-jobs cron to give back credits
-- when a render job times out (VPS crash, network failure).
CREATE OR REPLACE FUNCTION refund_video_usage(p_user_id UUID, p_count INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET monthly_videos_used = GREATEST(0, monthly_videos_used - p_count)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
