-- Atomic quota consumption: prevents race condition where 2 concurrent requests
-- both pass the "remaining > 0" check and exceed the plan limit.
CREATE OR REPLACE FUNCTION try_consume_video_credit(p_user_id UUID, p_max_videos INT)
RETURNS BOOLEAN AS $$
DECLARE
  updated_rows INT;
BEGIN
  -- Atomic conditional update: only increments if under the limit
  UPDATE profiles
  SET monthly_videos_used = monthly_videos_used + 1
  WHERE id = p_user_id
  AND monthly_videos_used < p_max_videos;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  -- If plan quota exhausted, try bonus_videos
  IF updated_rows = 0 THEN
    UPDATE profiles
    SET bonus_videos = bonus_videos - 1
    WHERE id = p_user_id
    AND bonus_videos > 0;

    GET DIAGNOSTICS updated_rows = ROW_COUNT;
  END IF;

  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql;
