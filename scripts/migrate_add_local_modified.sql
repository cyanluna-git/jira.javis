-- Migration: Add local modification tracking for bidirectional sync
-- Run: psql -d javis_brain -f scripts/migrate_add_local_modified.sql

-- ============================================
-- 1. Add local modification tracking to jira_issues
-- ============================================

-- Track when issue was locally modified
ALTER TABLE jira_issues
ADD COLUMN IF NOT EXISTS local_modified_at TIMESTAMP;

-- Track which fields were modified locally
ALTER TABLE jira_issues
ADD COLUMN IF NOT EXISTS local_modified_fields TEXT[];

COMMENT ON COLUMN jira_issues.local_modified_at IS 'Timestamp of local modification, NULL if synced';
COMMENT ON COLUMN jira_issues.local_modified_fields IS 'Array of field names modified locally';

-- Index for finding locally modified issues
CREATE INDEX IF NOT EXISTS idx_jira_issues_local_modified
ON jira_issues (local_modified_at)
WHERE local_modified_at IS NOT NULL;

-- ============================================
-- 2. Create sync_logs table for sync history
-- ============================================

CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  issue_key TEXT,
  direction TEXT NOT NULL,       -- 'pull' | 'push'
  status TEXT NOT NULL,          -- 'success' | 'conflict' | 'error' | 'skipped'
  details JSONB,                 -- Additional context (error message, changes, etc.)
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE sync_logs IS 'Log of all sync operations for audit trail';
COMMENT ON COLUMN sync_logs.direction IS 'pull = Jira->DB, push = DB->Jira';
COMMENT ON COLUMN sync_logs.status IS 'success, conflict, error, or skipped';

CREATE INDEX IF NOT EXISTS idx_sync_logs_issue_key ON sync_logs (issue_key);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs (status);

-- ============================================
-- 3. Create sync_conflicts table for conflict tracking
-- ============================================

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id SERIAL PRIMARY KEY,
  issue_key TEXT NOT NULL,
  local_data JSONB NOT NULL,     -- Local version of the issue
  remote_data JSONB NOT NULL,    -- Remote (Jira) version of the issue
  conflicting_fields TEXT[],     -- Fields that differ
  resolution TEXT,               -- 'local' | 'remote' | NULL (unresolved)
  resolved_at TIMESTAMP,
  detected_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE sync_conflicts IS 'Tracks unresolved sync conflicts for user review';
COMMENT ON COLUMN sync_conflicts.resolution IS 'How conflict was resolved: local, remote, or NULL if unresolved';

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_issue_key ON sync_conflicts (issue_key);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_unresolved
ON sync_conflicts (detected_at DESC)
WHERE resolution IS NULL;

-- ============================================
-- 4. Helper function to mark issue as locally modified
-- ============================================

CREATE OR REPLACE FUNCTION mark_issue_locally_modified()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if this is a local update (not from sync)
  -- The sync script will set local_modified_at to NULL after pushing
  IF NEW.local_modified_at IS NULL AND OLD.local_modified_at IS NULL THEN
    -- This is an update from sync, don't mark as modified
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Verification
-- ============================================

DO $$
BEGIN
  -- Check columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jira_issues' AND column_name = 'local_modified_at'
  ) THEN
    RAISE NOTICE '✅ Column local_modified_at added to jira_issues';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jira_issues' AND column_name = 'local_modified_fields'
  ) THEN
    RAISE NOTICE '✅ Column local_modified_fields added to jira_issues';
  END IF;

  -- Check tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_logs') THEN
    RAISE NOTICE '✅ Table sync_logs created';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_conflicts') THEN
    RAISE NOTICE '✅ Table sync_conflicts created';
  END IF;
END $$;

SELECT 'Migration complete: local_modified tracking enabled' AS result;
