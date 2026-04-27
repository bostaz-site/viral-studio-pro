-- Bulk update scores RPC: replaces N individual UPDATEs with a single call
CREATE OR REPLACE FUNCTION bulk_update_scores(
  p_ids UUID[],
  p_velocity_scores FLOAT[],
  p_momentum_scores FLOAT[],
  p_engagement_scores FLOAT[],
  p_recency_scores FLOAT[],
  p_early_signal_scores FLOAT[],
  p_format_scores FLOAT[],
  p_saturation_scores FLOAT[],
  p_anomaly_scores FLOAT[],
  p_tiers TEXT[],
  p_feed_categories TEXT[],
  p_next_check_ats TIMESTAMPTZ[]
) RETURNS void AS $$
BEGIN
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE trending_clips SET
      velocity_score = p_velocity_scores[i],
      momentum_score = p_momentum_scores[i],
      engagement_score = p_engagement_scores[i],
      recency_score = p_recency_scores[i],
      early_signal_score = p_early_signal_scores[i],
      format_score = p_format_scores[i],
      saturation_score = p_saturation_scores[i],
      anomaly_score = p_anomaly_scores[i],
      tier = p_tiers[i],
      feed_category = p_feed_categories[i],
      next_check_at = p_next_check_ats[i]
    WHERE id = p_ids[i];
  END LOOP;
END;
$$ LANGUAGE plpgsql;
