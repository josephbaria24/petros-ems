-- scripts/add-trainer-repository-tables.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Trainer Repository Tabs table
CREATE TABLE IF NOT EXISTS tms.trainer_repo_tabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Trainer Repository Columns table
CREATE TABLE IF NOT EXISTS tms.trainer_repo_columns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tab_id UUID REFERENCES tms.trainer_repo_tabs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data_type TEXT DEFAULT 'text', -- can be 'text', 'number', 'date', 'email', etc.
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Trainer Repository Rows table
CREATE TABLE IF NOT EXISTS tms.trainer_repo_rows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tab_id UUID REFERENCES tms.trainer_repo_tabs(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add some default index for performance
CREATE INDEX IF NOT EXISTS idx_trainer_repo_columns_tab_id ON tms.trainer_repo_columns(tab_id);
CREATE INDEX IF NOT EXISTS idx_trainer_repo_rows_tab_id ON tms.trainer_repo_rows(tab_id);

-- Enable RLS (Assuming existing policies or to be refined)
ALTER TABLE tms.trainer_repo_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.trainer_repo_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.trainer_repo_rows ENABLE ROW LEVEL SECURITY;

-- Simple permissive policies for now (to be refined based on auth needs)
CREATE POLICY "Allow all on trainer_repo_tabs" ON tms.trainer_repo_tabs FOR ALL USING (true);
CREATE POLICY "Allow all on trainer_repo_columns" ON tms.trainer_repo_columns FOR ALL USING (true);
CREATE POLICY "Allow all on trainer_repo_rows" ON tms.trainer_repo_rows FOR ALL USING (true);
