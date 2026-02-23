-- scripts/link-evaluations-to-schedules.sql

-- Add schedule_id to repo_evaluations to allow tracking which evaluation belongs to which schedule
ALTER TABLE tms.repo_evaluations 
ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES tms.schedules(id) ON DELETE CASCADE;

-- Create an index to speed up lookups by schedule
CREATE INDEX IF NOT EXISTS idx_repo_evaluations_schedule_id ON tms.repo_evaluations(schedule_id);
