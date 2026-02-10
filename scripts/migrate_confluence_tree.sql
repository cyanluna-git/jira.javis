-- Confluence Tree Structure Migration
-- Adds hierarchical tree optimization and AI suggestions support
-- Run: PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -f scripts/migrate_confluence_tree.sql

BEGIN;

-- ============================================
-- 1. Tree Optimization Columns
-- ============================================

-- Materialized path for efficient tree traversal (e.g., '/root/parent/page')
ALTER TABLE confluence_v2_content
ADD COLUMN IF NOT EXISTS materialized_path TEXT;

-- Depth level in the tree (0 = root)
ALTER TABLE confluence_v2_content
ADD COLUMN IF NOT EXISTS depth INTEGER DEFAULT 0;

-- Count of direct children
ALTER TABLE confluence_v2_content
ADD COLUMN IF NOT EXISTS child_count INTEGER DEFAULT 0;

-- Flag for orphan pages (parent not found)
ALTER TABLE confluence_v2_content
ADD COLUMN IF NOT EXISTS is_orphan BOOLEAN DEFAULT FALSE;

-- Reason for being orphan (deleted_parent, broken_link, space_mismatch)
ALTER TABLE confluence_v2_content
ADD COLUMN IF NOT EXISTS orphan_reason TEXT;

-- Sort order within siblings
ALTER TABLE confluence_v2_content
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create indexes for tree operations
CREATE INDEX IF NOT EXISTS idx_confluence_materialized_path
ON confluence_v2_content (materialized_path);

CREATE INDEX IF NOT EXISTS idx_confluence_depth
ON confluence_v2_content (depth);

CREATE INDEX IF NOT EXISTS idx_confluence_is_orphan
ON confluence_v2_content (is_orphan) WHERE is_orphan = TRUE;

CREATE INDEX IF NOT EXISTS idx_confluence_parent_sort
ON confluence_v2_content (parent_id, sort_order);

-- ============================================
-- 2. AI Suggestions Table
-- ============================================

CREATE TABLE IF NOT EXISTS confluence_ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Suggestion classification
    suggestion_type TEXT NOT NULL,  -- merge, update, restructure, label, archive, split

    -- Target pages (array of page IDs)
    target_page_ids TEXT[] NOT NULL,

    -- AI analysis results
    confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    ai_reasoning TEXT,

    -- Structured suggestion data
    suggested_action JSONB NOT NULL,
    /*
    Example suggested_action structures:

    merge:
    {
        "primary_page_id": "123",
        "secondary_page_ids": ["456", "789"],
        "merged_title": "Combined Document",
        "merge_strategy": "append"  -- append, interleave, summarize
    }

    update:
    {
        "page_id": "123",
        "stale_sections": ["Overview", "API Reference"],
        "suggested_updates": [{"section": "Overview", "reason": "References deprecated feature"}]
    }

    restructure:
    {
        "page_id": "123",
        "new_parent_id": "456",
        "reason": "Better fits under parent category"
    }

    label:
    {
        "page_id": "123",
        "add_labels": ["sprint-review", "gen3"],
        "remove_labels": ["draft"],
        "reasoning": "Content indicates completed sprint review for Gen3 project"
    }

    archive:
    {
        "page_id": "123",
        "archive_reason": "outdated",
        "last_modified": "2023-01-15",
        "no_recent_views": true
    }
    */

    -- Workflow status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'expired')),

    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by TEXT,
    applied_at TIMESTAMP WITH TIME ZONE,

    -- Link to operation if applied (no FK - content_operations may not exist)
    operation_id UUID
);

-- Indexes for suggestions
CREATE INDEX IF NOT EXISTS idx_confluence_suggestions_type
ON confluence_ai_suggestions (suggestion_type);

CREATE INDEX IF NOT EXISTS idx_confluence_suggestions_status
ON confluence_ai_suggestions (status);

CREATE INDEX IF NOT EXISTS idx_confluence_suggestions_pages
ON confluence_ai_suggestions USING GIN (target_page_ids);

CREATE INDEX IF NOT EXISTS idx_confluence_suggestions_created
ON confluence_ai_suggestions (created_at DESC);

-- ============================================
-- 3. Label Taxonomy Table
-- ============================================

CREATE TABLE IF NOT EXISTS confluence_label_taxonomy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Label definition
    label_name TEXT UNIQUE NOT NULL,

    -- Classification
    category TEXT NOT NULL CHECK (category IN (
        'doc-type',      -- sprint-review, design-note, story-note, meeting-notes
        'product',       -- tumalo, protron, gen2, gen3
        'status',        -- outdated, needs-review, archived, draft
        'team',          -- frontend, backend, devops, qa
        'priority'       -- critical, important, nice-to-have
    )),

    -- Display properties
    color TEXT DEFAULT '#6B7280',
    description TEXT,

    -- Synonyms for auto-labeling (e.g., ["sprint review", "sprint-review", "sprint_review"])
    synonyms TEXT[],

    -- Auto-labeling rules
    keyword_patterns TEXT[],  -- Regex patterns that suggest this label

    -- Metadata
    is_auto_suggested BOOLEAN DEFAULT TRUE,  -- Include in AI suggestions
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for label lookup
CREATE INDEX IF NOT EXISTS idx_confluence_label_category
ON confluence_label_taxonomy (category);

CREATE INDEX IF NOT EXISTS idx_confluence_label_synonyms
ON confluence_label_taxonomy USING GIN (synonyms);

-- ============================================
-- 4. Page Similarity Cache
-- ============================================

CREATE TABLE IF NOT EXISTS confluence_page_similarity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Page pair (always store with page_id_1 < page_id_2 for dedup)
    page_id_1 TEXT NOT NULL,
    page_id_2 TEXT NOT NULL,

    -- Similarity scores (0-1)
    title_similarity NUMERIC(4,3),
    content_similarity NUMERIC(4,3),
    combined_score NUMERIC(4,3),

    -- Analysis metadata
    analysis_method TEXT,  -- tfidf, embedding, trigram
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_page_pair UNIQUE (page_id_1, page_id_2),
    CONSTRAINT ordered_page_ids CHECK (page_id_1 < page_id_2)
);

-- Index for similarity lookups
CREATE INDEX IF NOT EXISTS idx_confluence_similarity_pages
ON confluence_page_similarity (page_id_1, page_id_2);

CREATE INDEX IF NOT EXISTS idx_confluence_similarity_score
ON confluence_page_similarity (combined_score DESC);

-- ============================================
-- 5. Insert Default Label Taxonomy
-- ============================================

INSERT INTO confluence_label_taxonomy (label_name, category, color, description, synonyms, keyword_patterns)
VALUES
    -- Doc types
    ('sprint-review', 'doc-type', '#3B82F6', 'Sprint review documentation',
     ARRAY['sprint review', 'sprint_review'], ARRAY['sprint.*review', 'review.*sprint']),
    ('design-note', 'doc-type', '#8B5CF6', 'Design documentation and decisions',
     ARRAY['design note', 'design_note', 'design-doc'], ARRAY['design.*note', 'design.*doc']),
    ('story-note', 'doc-type', '#EC4899', 'Story implementation notes',
     ARRAY['story note', 'story_note'], ARRAY['story.*note', 'implementation.*note']),
    ('meeting-notes', 'doc-type', '#F59E0B', 'Meeting notes and minutes',
     ARRAY['meeting notes', 'meeting_notes', 'minutes'], ARRAY['meeting.*note', 'minutes']),
    ('api-doc', 'doc-type', '#10B981', 'API documentation',
     ARRAY['api doc', 'api_doc', 'api reference'], ARRAY['api.*doc', 'api.*reference']),
    ('runbook', 'doc-type', '#EF4444', 'Operational runbooks',
     ARRAY['runbook', 'run_book', 'playbook'], ARRAY['runbook', 'playbook', 'how.to.*deploy']),

    -- Products
    ('tumalo', 'product', '#059669', 'Tumalo product', ARRAY['tumalo'], ARRAY['tumalo']),
    ('protron', 'product', '#7C3AED', 'Protron product', ARRAY['protron'], ARRAY['protron']),
    ('gen2', 'product', '#2563EB', 'Gen2 platform', ARRAY['gen2', 'gen-2'], ARRAY['gen.?2']),
    ('gen3', 'product', '#DC2626', 'Gen3 platform', ARRAY['gen3', 'gen-3'], ARRAY['gen.?3']),

    -- Status
    ('outdated', 'status', '#9CA3AF', 'Content is outdated',
     ARRAY['outdated', 'stale', 'old'], ARRAY[]::text[]),
    ('needs-review', 'status', '#F59E0B', 'Content needs review',
     ARRAY['needs review', 'needs_review', 'review needed'], ARRAY[]::text[]),
    ('archived', 'status', '#6B7280', 'Archived content',
     ARRAY['archived', 'archive'], ARRAY[]::text[]),
    ('draft', 'status', '#FCD34D', 'Draft content',
     ARRAY['draft', 'wip', 'work in progress'], ARRAY['draft', 'wip', 'work.in.progress']),

    -- Teams
    ('frontend', 'team', '#06B6D4', 'Frontend team',
     ARRAY['frontend', 'front-end', 'ui', 'fe'], ARRAY['frontend', 'react', 'nextjs', 'css']),
    ('backend', 'team', '#8B5CF6', 'Backend team',
     ARRAY['backend', 'back-end', 'be'], ARRAY['backend', 'api', 'server', 'database']),
    ('devops', 'team', '#F97316', 'DevOps team',
     ARRAY['devops', 'dev-ops', 'infrastructure', 'infra'], ARRAY['devops', 'ci.?cd', 'deploy', 'kubernetes', 'docker']),
    ('qa', 'team', '#22C55E', 'QA team',
     ARRAY['qa', 'quality', 'testing'], ARRAY['qa', 'test', 'quality'])
ON CONFLICT (label_name) DO NOTHING;

-- ============================================
-- 6. Helper Functions
-- ============================================

-- Function to get all ancestors of a page
CREATE OR REPLACE FUNCTION get_confluence_ancestors(page_id_param TEXT)
RETURNS TABLE (
    id TEXT,
    title TEXT,
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE ancestors AS (
        SELECT c.id, c.title, c.parent_id, c.depth
        FROM confluence_v2_content c
        WHERE c.id = page_id_param

        UNION ALL

        SELECT p.id, p.title, p.parent_id, p.depth
        FROM confluence_v2_content p
        JOIN ancestors a ON p.id = a.parent_id
    )
    SELECT ancestors.id, ancestors.title, ancestors.depth
    FROM ancestors
    WHERE ancestors.id != page_id_param
    ORDER BY ancestors.depth;
END;
$$ LANGUAGE plpgsql;

-- Function to get all descendants of a page
CREATE OR REPLACE FUNCTION get_confluence_descendants(page_id_param TEXT, max_depth INTEGER DEFAULT 10)
RETURNS TABLE (
    id TEXT,
    title TEXT,
    parent_id TEXT,
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE descendants AS (
        SELECT c.id, c.title, c.parent_id, c.depth, 0 as relative_depth
        FROM confluence_v2_content c
        WHERE c.parent_id = page_id_param

        UNION ALL

        SELECT c.id, c.title, c.parent_id, c.depth, d.relative_depth + 1
        FROM confluence_v2_content c
        JOIN descendants d ON c.parent_id = d.id
        WHERE d.relative_depth < max_depth
    )
    SELECT descendants.id, descendants.title, descendants.parent_id, descendants.depth
    FROM descendants
    ORDER BY descendants.depth, descendants.title;
END;
$$ LANGUAGE plpgsql;

-- Function to get tree statistics
CREATE OR REPLACE FUNCTION get_confluence_tree_stats()
RETURNS TABLE (
    total_pages BIGINT,
    total_orphans BIGINT,
    max_depth INTEGER,
    avg_depth NUMERIC,
    pages_with_children BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_pages,
        COUNT(*) FILTER (WHERE is_orphan)::BIGINT as total_orphans,
        MAX(depth) as max_depth,
        AVG(depth)::NUMERIC as avg_depth,
        COUNT(*) FILTER (WHERE child_count > 0)::BIGINT as pages_with_children
    FROM confluence_v2_content;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending suggestions count by type
CREATE OR REPLACE FUNCTION get_pending_suggestion_counts()
RETURNS TABLE (
    suggestion_type TEXT,
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.suggestion_type, COUNT(*)::BIGINT
    FROM confluence_ai_suggestions s
    WHERE s.status = 'pending'
    GROUP BY s.suggestion_type
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================
-- Post-migration verification
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration complete. Run compute_confluence_paths.py to populate tree columns.';
END $$;
