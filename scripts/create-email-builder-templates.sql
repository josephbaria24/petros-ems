-- Migration: Create email_builder_templates table and add email config columns to courses

-- 1. Create the email builder templates table
CREATE TABLE IF NOT EXISTS tms.email_builder_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    config jsonb NOT NULL DEFAULT '[]',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Grant access
GRANT ALL ON tms.email_builder_templates TO postgres;
GRANT ALL ON tms.email_builder_templates TO service_role;
GRANT ALL ON tms.email_builder_templates TO anon;
GRANT ALL ON tms.email_builder_templates TO authenticated;

-- 2. Add email template columns to courses table
ALTER TABLE tms.courses 
ADD COLUMN IF NOT EXISTS email_template_type text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS email_template_config jsonb DEFAULT NULL;

COMMENT ON COLUMN tms.courses.email_template_type IS 'Email template type: default or custom';
COMMENT ON COLUMN tms.courses.email_template_config IS 'Custom email template configuration (blocks/sections)';
