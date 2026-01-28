-- Migration: Content Operations Queue and History
-- Run: psql -d javis_brain -f scripts/migrate_content_ops.sql

-- ============================================
-- 1. Content Operations Queue
-- ============================================

CREATE TABLE IF NOT EXISTS content_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Operation Type
  operation_type TEXT NOT NULL,      -- merge, restructure, summarize, update_field, bulk_transition, link_issues
  target_type TEXT NOT NULL,         -- jira | confluence
  target_ids TEXT[] NOT NULL,        -- Target issue keys or page IDs

  -- AI Generation Data
  ai_prompt TEXT,                    -- Prompt sent to AI
  ai_response JSONB,                 -- Raw AI response

  -- Operation Details
  operation_data JSONB NOT NULL,     -- Specific operation parameters
  preview_data JSONB,                -- Generated preview/diff for user review

  -- Status
  status TEXT DEFAULT 'pending',     -- pending, approved, executing, completed, failed, cancelled
  error_message TEXT,

  -- Metadata
  created_by TEXT,                   -- AI agent ID or user identifier
  approved_by TEXT,                  -- User who approved the operation
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  executed_at TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'executing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT valid_target_type CHECK (target_type IN ('jira', 'confluence')),
  CONSTRAINT valid_operation_type CHECK (operation_type IN (
    'merge', 'restructure', 'summarize', 'update_field',
    'bulk_transition', 'link_issues', 'archive', 'move'
  ))
);

COMMENT ON TABLE content_operations IS 'Queue for AI-driven content operations awaiting approval';
COMMENT ON COLUMN content_operations.operation_type IS 'Type of operation: merge, restructure, summarize, update_field, bulk_transition, link_issues';
COMMENT ON COLUMN content_operations.status IS 'Workflow status: pending -> approved -> executing -> completed/failed';
COMMENT ON COLUMN content_operations.preview_data IS 'Generated preview for user review before execution';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_operations_status ON content_operations (status);
CREATE INDEX IF NOT EXISTS idx_operations_target ON content_operations (target_type, status);
CREATE INDEX IF NOT EXISTS idx_operations_created ON content_operations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_pending ON content_operations (created_at DESC) WHERE status = 'pending';

-- ============================================
-- 2. Content History (for rollback support)
-- ============================================

CREATE TABLE IF NOT EXISTS content_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID REFERENCES content_operations(id) ON DELETE SET NULL,

  -- Target identification
  target_type TEXT NOT NULL,         -- jira | confluence
  target_id TEXT NOT NULL,           -- Issue key or page ID

  -- Snapshots
  before_data JSONB NOT NULL,        -- State before operation
  after_data JSONB NOT NULL,         -- State after operation
  changed_fields TEXT[],             -- Which fields were modified

  -- Rollback tracking
  rolled_back BOOLEAN DEFAULT FALSE,
  rolled_back_at TIMESTAMP,
  rolled_back_by TEXT,

  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_history_target_type CHECK (target_type IN ('jira', 'confluence'))
);

COMMENT ON TABLE content_history IS 'Stores before/after snapshots for rollback support';
COMMENT ON COLUMN content_history.before_data IS 'Complete state before operation - used for rollback';
COMMENT ON COLUMN content_history.after_data IS 'Complete state after operation - for audit';

-- Indexes for rollback and audit queries
CREATE INDEX IF NOT EXISTS idx_history_operation ON content_history (operation_id);
CREATE INDEX IF NOT EXISTS idx_history_target ON content_history (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_history_created ON content_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_not_rolled_back
ON content_history (target_type, target_id, created_at DESC)
WHERE rolled_back = FALSE;

-- ============================================
-- 3. Helper Functions
-- ============================================

-- Get pending operations count by type
CREATE OR REPLACE FUNCTION get_pending_operations_count()
RETURNS TABLE (
  operation_type TEXT,
  target_type TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    co.operation_type,
    co.target_type,
    COUNT(*) as count
  FROM content_operations co
  WHERE co.status = 'pending'
  GROUP BY co.operation_type, co.target_type
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Get recent history for a target
CREATE OR REPLACE FUNCTION get_target_history(
  p_target_type TEXT,
  p_target_id TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  history_id UUID,
  operation_id UUID,
  operation_type TEXT,
  changed_fields TEXT[],
  rolled_back BOOLEAN,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ch.id as history_id,
    ch.operation_id,
    co.operation_type,
    ch.changed_fields,
    ch.rolled_back,
    ch.created_at
  FROM content_history ch
  LEFT JOIN content_operations co ON ch.operation_id = co.id
  WHERE ch.target_type = p_target_type
    AND ch.target_id = p_target_id
  ORDER BY ch.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Rollback an operation
CREATE OR REPLACE FUNCTION rollback_operation(
  p_history_id UUID,
  p_rolled_back_by TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_history content_history%ROWTYPE;
BEGIN
  -- Get history record
  SELECT * INTO v_history FROM content_history WHERE id = p_history_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'History record not found: %', p_history_id;
  END IF;

  IF v_history.rolled_back THEN
    RAISE EXCEPTION 'Operation already rolled back';
  END IF;

  -- Mark as rolled back
  UPDATE content_history
  SET
    rolled_back = TRUE,
    rolled_back_at = NOW(),
    rolled_back_by = p_rolled_back_by
  WHERE id = p_history_id;

  -- Note: Actual data restoration must be done by the application
  -- This function only marks the history record

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Sample Operation Templates (as reference)
-- ============================================

COMMENT ON TABLE content_operations IS
E'Sample operation_data structures:

MERGE (Confluence):
{
  "destination_id": "page-1",
  "source_ids": ["page-2", "page-3"],
  "merge_strategy": "append | smart_merge | replace",
  "ai_instructions": "Optional AI processing instructions",
  "archive_sources": true
}

UPDATE_FIELD (Jira):
{
  "field": "summary",
  "old_value": "Old title",
  "new_value": "New title"
}

BULK_TRANSITION (Jira):
{
  "transition_id": "21",
  "transition_name": "Done",
  "issue_keys": ["ASP-1", "ASP-2"]
}

LINK_ISSUES (Jira):
{
  "link_type": "blocks",
  "outward_issue": "ASP-1",
  "inward_issue": "ASP-2"
}

SUMMARIZE (Both):
{
  "source_id": "ASP-1",
  "summary_type": "brief | detailed | bullet_points",
  "language": "ko | en"
}';

-- ============================================
-- Verification
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_operations') THEN
    RAISE NOTICE '✅ Table content_operations created';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_history') THEN
    RAISE NOTICE '✅ Table content_history created';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_pending_operations_count') THEN
    RAISE NOTICE '✅ Function get_pending_operations_count created';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_target_history') THEN
    RAISE NOTICE '✅ Function get_target_history created';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rollback_operation') THEN
    RAISE NOTICE '✅ Function rollback_operation created';
  END IF;
END $$;

SELECT 'Migration complete: content_operations and content_history tables created' AS result;
