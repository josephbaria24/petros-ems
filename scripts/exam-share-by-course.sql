-- Share one exam definition per course (pre/post), keep responses per schedule.
-- Run in Supabase SQL editor against the tms schema.

ALTER TABLE tms.exam_responses
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES tms.schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exam_responses_schedule_id ON tms.exam_responses(schedule_id);
CREATE INDEX IF NOT EXISTS idx_exams_course_id_kind ON tms.exams(course_id, kind);
