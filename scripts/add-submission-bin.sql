-- Public submission bin for re-entry plans and other trainee files
-- Run in Supabase SQL editor against the tms schema

CREATE TABLE IF NOT EXISTS tms.submission_bin_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES tms.schedules(id) ON DELETE CASCADE,
  training_id UUID REFERENCES tms.trainings(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'reentry_plan'
    CHECK (kind IN ('reentry_plan', 'other')),
  title TEXT,
  respondent_name TEXT,
  respondent_email TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_bin_items_schedule_id
  ON tms.submission_bin_items (schedule_id);

CREATE INDEX IF NOT EXISTS idx_submission_bin_items_email
  ON tms.submission_bin_items (schedule_id, respondent_email);

ALTER TABLE tms.submission_bin_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on submission_bin_items" ON tms.submission_bin_items;
CREATE POLICY "Allow all on submission_bin_items"
  ON tms.submission_bin_items FOR ALL USING (true) WITH CHECK (true);
