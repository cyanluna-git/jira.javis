-- Content Operations Table Migration
-- Usage: psql -h localhost -p 5439 -U javis -d javis_brain -f scripts/migrate_content_operations.sql

-- Content Operations Table
CREATE TABLE IF NOT EXISTS content_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type TEXT NOT NULL,  -- 'update', 'move', 'label', 'archive', 'merge', 'bulk_update'
    target_type TEXT NOT NULL,     -- 'jira_issue', 'confluence_page', 'confluence_folder'
    target_ids TEXT[] NOT NULL,    -- Array of target IDs
    payload JSONB,                 -- Operation-specific data
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'executing', 'completed', 'failed', 'cancelled'
    error_message TEXT,
    created_by TEXT,
    approved_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    executed_at TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_content_operations_status ON content_operations(status);
CREATE INDEX IF NOT EXISTS idx_content_operations_created_at ON content_operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_operations_target_type ON content_operations(target_type);

-- Add comment
COMMENT ON TABLE content_operations IS 'Stores bulk operations for Jira/Confluence content management';
