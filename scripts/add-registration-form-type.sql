-- Migration: Add registration_form_type to schedules table
-- This allows schedules to specify which registration form to use

ALTER TABLE tms.schedules 
ADD COLUMN registration_form_type TEXT DEFAULT 'default' 
CHECK (registration_form_type IN ('default', 'acls', 'bls', 'ivt_therapy'));

-- Migration: Add specialized form fields to trainings table
-- These fields are used by ACLS, BLS, and IVT Therapy registration forms

ALTER TABLE tms.trainings
ADD COLUMN training_program TEXT,
ADD COLUMN training_status TEXT CHECK (training_status IN ('First Timer', 'Renewal', 'Remedial')),
ADD COLUMN professional_title TEXT,
ADD COLUMN region TEXT;

-- Add comments for documentation
COMMENT ON COLUMN tms.schedules.registration_form_type IS 'Type of registration form to use: default, acls, bls, or ivt_therapy';
COMMENT ON COLUMN tms.trainings.training_program IS 'Training program selected (for specialized forms): BLS, ACLS, BLS and ACLS, IVT Therapy, Other';
COMMENT ON COLUMN tms.trainings.training_status IS 'Training status: First Timer, Renewal, or Remedial';
COMMENT ON COLUMN tms.trainings.professional_title IS 'Professional title (e.g., RN, MSN, MD)';
COMMENT ON COLUMN tms.trainings.region IS 'Region selected in specialized registration forms';
