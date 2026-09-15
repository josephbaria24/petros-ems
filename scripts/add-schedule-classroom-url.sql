-- Optional Teams/Zoom join URL saved from Attendance → Online classroom details.
ALTER TABLE tms.schedules
  ADD COLUMN IF NOT EXISTS online_classroom_url text;

COMMENT ON COLUMN tms.schedules.online_classroom_url IS 'Join URL pasted on the attendance page for Teams/Zoom meeting details.';
