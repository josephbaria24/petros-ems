CREATE TABLE IF NOT EXISTS tms.facilitator_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES tms.courses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facilitator_materials_course_id ON tms.facilitator_materials(course_id);

ALTER TABLE tms.facilitator_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on facilitator_materials" ON tms.facilitator_materials;
CREATE POLICY "Allow all on facilitator_materials" ON tms.facilitator_materials FOR ALL USING (true) WITH CHECK (true);
