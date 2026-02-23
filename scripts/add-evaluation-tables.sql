-- scripts/add-evaluation-tables.sql

-- 1. Create Repository Evaluations table (Templates)
CREATE TABLE IF NOT EXISTS tms.repo_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Repository Evaluation Questions table
CREATE TABLE IF NOT EXISTS tms.repo_eval_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID REFERENCES tms.repo_evaluations(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- 'text', 'radio', 'checkbox', 'rating'
    options JSONB DEFAULT '[]', -- For radio/checkbox options
    sort_order INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Repository Evaluation Responses table
CREATE TABLE IF NOT EXISTS tms.repo_eval_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID REFERENCES tms.repo_evaluations(id) ON DELETE CASCADE,
    respondent_name TEXT,
    respondent_email TEXT,
    answers JSONB NOT NULL DEFAULT '{}', -- { "question_id": "answer" }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tms.repo_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.repo_eval_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.repo_eval_responses ENABLE ROW LEVEL SECURITY;

-- Simple policies
CREATE POLICY "Allow all on repo_evaluations" ON tms.repo_evaluations FOR ALL USING (true);
CREATE POLICY "Allow all on repo_eval_questions" ON tms.repo_eval_questions FOR ALL USING (true);
CREATE POLICY "Allow all on repo_eval_responses" ON tms.repo_eval_responses FOR ALL USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_repo_eval_questions_eval_id ON tms.repo_eval_questions(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_repo_eval_responses_eval_id ON tms.repo_eval_responses(evaluation_id);
