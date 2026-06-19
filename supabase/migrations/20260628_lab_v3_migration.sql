-- Lab V3 migration: new columns + queue re-seed + council constraint update

-- New context columns for doc-based gathering
ALTER TABLE lab_deep_dives
  ADD COLUMN IF NOT EXISTS context_main_doc TEXT,
  ADD COLUMN IF NOT EXISTS context_additional_docs JSONB,
  ADD COLUMN IF NOT EXISTS context_vision TEXT,
  ADD COLUMN IF NOT EXISTS context_concept TEXT,
  ADD COLUMN IF NOT EXISTS context_lab_history TEXT,
  ADD COLUMN IF NOT EXISTS deliverable_file_path TEXT;

-- Update council provider constraint to support sonnet/opus split
ALTER TABLE lab_council_responses DROP CONSTRAINT IF EXISTS lab_council_responses_llm_provider_check;
ALTER TABLE lab_council_responses ADD CONSTRAINT lab_council_responses_llm_provider_check
  CHECK (llm_provider IN ('claude', 'claude_sonnet', 'claude_opus', 'openai', 'gemini'));

-- Re-seed queue: remove settings, rename areas, add new features
DELETE FROM lab_queue WHERE feature_area = 'settings';

UPDATE lab_queue SET feature_area = 'browse-clips' WHERE feature_area = 'browse';
UPDATE lab_queue SET feature_area = 'enhance-render' WHERE feature_area = 'enhance';
UPDATE lab_queue SET feature_area = 'distribution-hub' WHERE feature_area = 'distribution';
UPDATE lab_queue SET feature_area = 'landing-pages' WHERE feature_area = 'landing';

INSERT INTO lab_queue (feature_area, current_cycle, next_scheduled_at, priority, active) VALUES
  ('onboarding', 1, NOW(), 1, true),
  ('billing-stripe', 1, NOW(), 2, true),
  ('affiliate-system', 1, NOW(), 3, true)
ON CONFLICT (feature_area) DO NOTHING;
