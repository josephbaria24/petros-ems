-- Add custom_data JSONB column to tms.trainings
-- This stores any form fields that don't have a dedicated column
ALTER TABLE tms.trainings 
ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}'::jsonb;

-- Optional: Add a comment to the column
COMMENT ON COLUMN tms.trainings.custom_data IS 'Stores additional form data from custom registration forms.';
