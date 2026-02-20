-- Work-First Planning System - DB Schema
-- Run: PGPASSWORD=javis_password psql -h localhost -p 5432 -U javis -d javis_brain -f scripts/migrate_work_planning.sql

-- ============================================
-- Bitbucket Tables
-- ============================================

CREATE TABLE IF NOT EXISTS bitbucket_repositories (
    uuid TEXT PRIMARY KEY,
    workspace TEXT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    web_url TEXT,
    raw_data JSONB,
    last_synced_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bitbucket_commits (
    hash TEXT PRIMARY KEY,
    repo_uuid TEXT REFERENCES bitbucket_repositories(uuid) ON DELETE CASCADE,
    author_email TEXT,
    author_name TEXT,
    message TEXT,
    committed_at TIMESTAMP,
    jira_keys TEXT[],  -- Extracted from commit message
    raw_data JSONB,
    synced_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bitbucket_pullrequests (
    id TEXT PRIMARY KEY,
    repo_uuid TEXT REFERENCES bitbucket_repositories(uuid) ON DELETE CASCADE,
    pr_number INTEGER,
    title TEXT,
    state TEXT,  -- OPEN, MERGED, DECLINED
    source_branch TEXT,
    destination_branch TEXT,
    author_name TEXT,
    jira_keys TEXT[],
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    merged_at TIMESTAMP,
    raw_data JSONB,
    synced_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Lightweight Tagging System
-- ============================================

CREATE TABLE IF NOT EXISTS work_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6B7280',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issue_tags (
    issue_key TEXT NOT NULL,
    tag_id UUID REFERENCES work_tags(id) ON DELETE CASCADE,
    tagged_at TIMESTAMP DEFAULT NOW(),
    tagged_by TEXT,
    PRIMARY KEY (issue_key, tag_id)
);

-- ============================================
-- AI Suggestions History
-- ============================================

CREATE TABLE IF NOT EXISTS ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_snapshot JSONB,
    prompt TEXT,
    response JSONB,
    provider TEXT,  -- claude | openai
    model TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Bitbucket indexes
CREATE INDEX IF NOT EXISTS idx_bb_commits_jira ON bitbucket_commits USING GIN(jira_keys);
CREATE INDEX IF NOT EXISTS idx_bb_commits_repo ON bitbucket_commits(repo_uuid);
CREATE INDEX IF NOT EXISTS idx_bb_commits_date ON bitbucket_commits(committed_at DESC);

CREATE INDEX IF NOT EXISTS idx_bb_pr_state ON bitbucket_pullrequests(state);
CREATE INDEX IF NOT EXISTS idx_bb_pr_repo ON bitbucket_pullrequests(repo_uuid);
CREATE INDEX IF NOT EXISTS idx_bb_pr_jira ON bitbucket_pullrequests USING GIN(jira_keys);

-- Tag indexes
CREATE INDEX IF NOT EXISTS idx_issue_tags_issue ON issue_tags(issue_key);
CREATE INDEX IF NOT EXISTS idx_work_tags_name ON work_tags(name);

-- AI suggestions index
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_date ON ai_suggestions(created_at DESC);

-- ============================================
-- Seed Default Tags
-- ============================================

INSERT INTO work_tags (name, color, description) VALUES
    ('urgent', '#EF4444', 'Needs immediate attention'),
    ('blocked', '#F59E0B', 'Waiting on external dependency'),
    ('review-needed', '#3B82F6', 'Waiting for code review'),
    ('quick-win', '#10B981', 'Can be done in under 30 minutes'),
    ('tech-debt', '#8B5CF6', 'Technical debt to address')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Verification
-- ============================================

DO $$
BEGIN
    RAISE NOTICE 'Work Planning schema created successfully!';
    RAISE NOTICE 'Tables: bitbucket_repositories, bitbucket_commits, bitbucket_pullrequests';
    RAISE NOTICE 'Tables: work_tags, issue_tags, ai_suggestions';
END $$;
