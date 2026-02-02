-- Migration: Add confluence_labels to jira_sprints
-- This allows manual labeling of sprints for Confluence document connections
-- Date: 2026-01-31

ALTER TABLE jira_sprints
ADD COLUMN IF NOT EXISTS confluence_labels TEXT[] DEFAULT '{}';

COMMENT ON COLUMN jira_sprints.confluence_labels IS
  'Labels for connecting Confluence documents to this sprint (local-only, not synced to Jira)';
