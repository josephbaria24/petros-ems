-- TMS schedule exams (pre-test / post-test)
-- Run in Supabase SQL editor against the tms schema

CREATE TABLE IF NOT EXISTS tms.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES tms.schedules(id) ON DELETE CASCADE,
  course_id UUID REFERENCES tms.courses(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('pretest', 'posttest')),
  mode TEXT NOT NULL DEFAULT 'external' CHECK (mode IN ('external', 'internal')),
  title TEXT,
  external_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, kind)
);

CREATE TABLE IF NOT EXISTS tms.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES tms.exams(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'identification', 'solving')),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  points NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tms.exam_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES tms.exams(id) ON DELETE CASCADE,
  respondent_name TEXT,
  respondent_email TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC,
  max_score NUMERIC,
  schedule_id UUID REFERENCES tms.schedules(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exams_schedule_id ON tms.exams(schedule_id);
CREATE INDEX IF NOT EXISTS idx_exams_course_id_kind ON tms.exams(course_id, kind);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id ON tms.exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_responses_exam_id ON tms.exam_responses(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_responses_schedule_id ON tms.exam_responses(schedule_id);

ALTER TABLE tms.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.exam_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on exams" ON tms.exams;
CREATE POLICY "Allow all on exams" ON tms.exams FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on exam_questions" ON tms.exam_questions;
CREATE POLICY "Allow all on exam_questions" ON tms.exam_questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on exam_responses" ON tms.exam_responses;
CREATE POLICY "Allow all on exam_responses" ON tms.exam_responses FOR ALL USING (true) WITH CHECK (true);
