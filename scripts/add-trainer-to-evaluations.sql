-- Add trainer_name to repo_evaluations to support delegation
ALTER TABLE tms.repo_evaluations 
ADD COLUMN IF NOT EXISTS trainer_name TEXT;

-- Index for performance when aggregating
CREATE INDEX IF NOT EXISTS idx_repo_evaluations_trainer_name ON tms.repo_evaluations(trainer_name);
