-- QR Generator bin — saved QR codes for admin reuse
-- Run in Supabase SQL editor against the tms schema

CREATE TABLE IF NOT EXISTS tms.qr_bin_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled QR',
  content TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 512
    CHECK (size IN (256, 512, 1024)),
  fg TEXT NOT NULL DEFAULT '#1A1D66',
  bg TEXT NOT NULL DEFAULT '#ffffff',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_bin_items_updated_at
  ON tms.qr_bin_items (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_bin_items_created_by
  ON tms.qr_bin_items (created_by);

ALTER TABLE tms.qr_bin_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on qr_bin_items" ON tms.qr_bin_items;
CREATE POLICY "Allow all on qr_bin_items"
  ON tms.qr_bin_items FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE tms.qr_bin_items IS 'Saved QR codes from the admin QR Generator tool';
