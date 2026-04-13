-- Create the registration form templates table
CREATE TABLE IF NOT EXISTS tms.registration_form_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    config jsonb NOT NULL DEFAULT '[]',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS (Optional, but good practice if you want to restrict templates)
-- ALTER TABLE tms.registration_form_templates ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL ON tms.registration_form_templates TO postgres;
GRANT ALL ON tms.registration_form_templates TO service_role;
GRANT ALL ON tms.registration_form_templates TO anon;
GRANT ALL ON tms.registration_form_templates TO authenticated;
