-- Jira Sprint Board Tables
-- Run with: psql -h localhost -p 5439 -U javis -d javis_brain -f scripts/create_sprint_tables.sql

-- jira_boards: Board information
CREATE TABLE IF NOT EXISTS jira_boards (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,                    -- 'scrum', 'kanban'
    project_key TEXT,
    raw_data JSONB,
    last_synced_at TIMESTAMP DEFAULT NOW()
);

-- jira_sprints: Sprint information
CREATE TABLE IF NOT EXISTS jira_sprints (
    id INTEGER PRIMARY KEY,
    board_id INTEGER REFERENCES jira_boards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    state TEXT,                   -- 'future', 'active', 'closed'
    goal TEXT,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    raw_data JSONB,
    last_synced_at TIMESTAMP DEFAULT NOW()
);

-- jira_issue_sprints: Issue-Sprint mapping
-- FK to jira_issues(key) ensures referential integrity
CREATE TABLE IF NOT EXISTS jira_issue_sprints (
    issue_key TEXT REFERENCES jira_issues(key) ON DELETE CASCADE,
    sprint_id INTEGER REFERENCES jira_sprints(id) ON DELETE CASCADE,
    PRIMARY KEY (issue_key, sprint_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_jira_sprints_board ON jira_sprints(board_id);
CREATE INDEX IF NOT EXISTS idx_jira_sprints_state ON jira_sprints(state);
CREATE INDEX IF NOT EXISTS idx_jira_issue_sprints_sprint ON jira_issue_sprints(sprint_id);
CREATE INDEX IF NOT EXISTS idx_jira_issue_sprints_issue ON jira_issue_sprints(issue_key);

-- Verify
SELECT 'Tables created successfully' as status;
