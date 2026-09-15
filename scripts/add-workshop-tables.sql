-- Workshop activities (staff-defined) + trainee answer submissions
ALTER TABLE tms.schedules
  ADD COLUMN IF NOT EXISTS workshop_activities jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN tms.schedules.workshop_activities IS
  'Workshop activities for this schedule: [{id, title, instructions, questions:[{id, prompt}]}]';

CREATE TABLE IF NOT EXISTS tms.workshop_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES tms.schedules(id) ON DELETE CASCADE,
  training_id UUID REFERENCES tms.trainings(id) ON DELETE SET NULL,
  respondent_name TEXT,
  respondent_email TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workshop_responses_schedule_id
  ON tms.workshop_responses (schedule_id);

CREATE INDEX IF NOT EXISTS idx_workshop_responses_email
  ON tms.workshop_responses (schedule_id, respondent_email);

ALTER TABLE tms.workshop_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on workshop_responses" ON tms.workshop_responses;
CREATE POLICY "Allow all on workshop_responses"
  ON tms.workshop_responses FOR ALL USING (true) WITH CHECK (true);
