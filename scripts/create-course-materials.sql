-- Course Materials table
-- Run this in your Supabase SQL editor against the tms schema

CREATE TABLE tms.course_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES tms.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by course
CREATE INDEX idx_course_materials_course_id ON tms.course_materials(course_id);

-- Enable RLS (open policy for now — admin-gated by app logic)
ALTER TABLE tms.course_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on course_materials"
  ON tms.course_materials
  FOR ALL
  USING (true)
  WITH CHECK (true);
