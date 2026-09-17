-- Attendance screenshots / snapshots per schedule
ALTER TABLE tms.schedules
  ADD COLUMN IF NOT EXISTS attendance_snapshots jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN tms.schedules.attendance_snapshots IS 'Screenshot photos per training day: [{id, url, name, created_at, day}]';
