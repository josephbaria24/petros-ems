-- Add day_trainers JSONB column to tms.schedules
ALTER TABLE tms.schedules ADD COLUMN IF NOT EXISTS day_trainers jsonb DEFAULT '{}'::jsonb;

-- Optional: Comments for documentation
COMMENT ON COLUMN tms.schedules.day_trainers IS 'Mapping of date strings to trainer names for multi-day schedules.';
