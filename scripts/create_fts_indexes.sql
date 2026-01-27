-- Full-Text Search Indexes for Javis
-- PostgreSQL GIN indexes with tsvector for fast text search

-- Enable pg_trgm extension for trigram similarity (handles Korean better)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- JIRA ISSUES
-- ============================================

-- Add tsvector column for full-text search
ALTER TABLE jira_issues
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index on search_vector
CREATE INDEX IF NOT EXISTS idx_jira_issues_fts
ON jira_issues USING GIN (search_vector);

-- Create trigram indexes for LIKE queries (Korean support)
CREATE INDEX IF NOT EXISTS idx_jira_issues_key_trgm
ON jira_issues USING GIN (key gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_jira_issues_summary_trgm
ON jira_issues USING GIN (summary gin_trgm_ops);

-- Update search_vector with weighted content
-- A = highest weight (key), B = high (summary), C = normal (description)
UPDATE jira_issues SET search_vector =
  setweight(to_tsvector('simple', COALESCE(key, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(summary, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(raw_data->'fields'->>'description', '')), 'C');

-- Create trigger function to auto-update search_vector
CREATE OR REPLACE FUNCTION jira_issues_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.key, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.raw_data->'fields'->>'description', '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS jira_issues_search_update ON jira_issues;
CREATE TRIGGER jira_issues_search_update
  BEFORE INSERT OR UPDATE ON jira_issues
  FOR EACH ROW EXECUTE FUNCTION jira_issues_search_trigger();

-- ============================================
-- CONFLUENCE CONTENT
-- ============================================

-- Add tsvector column for full-text search
ALTER TABLE confluence_v2_content
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index on search_vector
CREATE INDEX IF NOT EXISTS idx_confluence_content_fts
ON confluence_v2_content USING GIN (search_vector);

-- Create trigram indexes for LIKE queries
CREATE INDEX IF NOT EXISTS idx_confluence_title_trgm
ON confluence_v2_content USING GIN (title gin_trgm_ops);

-- Update search_vector with weighted content
-- A = title, B = body content
UPDATE confluence_v2_content SET search_vector =
  setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(
    regexp_replace(body_storage, '<[^>]*>', '', 'g'),  -- Strip HTML tags
    ''
  )), 'B');

-- Create trigger function for confluence
CREATE OR REPLACE FUNCTION confluence_content_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(
      regexp_replace(NEW.body_storage, '<[^>]*>', '', 'g'),
      ''
    )), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS confluence_content_search_update ON confluence_v2_content;
CREATE TRIGGER confluence_content_search_update
  BEFORE INSERT OR UPDATE ON confluence_v2_content
  FOR EACH ROW EXECUTE FUNCTION confluence_content_search_trigger();

-- ============================================
-- VERIFY INDEXES
-- ============================================
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('jira_issues', 'confluence_v2_content')
  AND indexname LIKE '%trgm%' OR indexname LIKE '%fts%'
ORDER BY tablename, indexname;
