-- scripts/add-row-sort-order.sql

-- Add sort_order column to trainer_repo_rows
ALTER TABLE tms.trainer_repo_rows ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Optionally, initialize sort_order based on created_at for existing rows
WITH numbered_rows AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY tab_id ORDER BY created_at) - 1 as new_order
    FROM tms.trainer_repo_rows
)
UPDATE tms.trainer_repo_rows
SET sort_order = numbered_rows.new_order
FROM numbered_rows
WHERE tms.trainer_repo_rows.id = numbered_rows.id;
