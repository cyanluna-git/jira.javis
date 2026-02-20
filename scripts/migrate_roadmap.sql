-- Roadmap Management Tables (Phase 1)
-- Run with: psql -h localhost -p 5439 -U javis -d javis_brain -f scripts/migrate_roadmap.sql

-- 1. roadmap_visions: Vision (Why) - Top level strategic goals
CREATE TABLE IF NOT EXISTS roadmap_visions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    north_star_metric TEXT,           -- Key metric name (e.g., 'Monthly Active Users')
    north_star_target NUMERIC(10,2),  -- Target value
    north_star_current NUMERIC(10,2), -- Current value
    target_date DATE,
    status TEXT DEFAULT 'active',     -- 'active', 'achieved', 'archived'
    owner_account_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. roadmap_milestones: Milestone (What) - Deliverables to achieve vision
CREATE TABLE IF NOT EXISTS roadmap_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vision_id UUID REFERENCES roadmap_visions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    quarter TEXT,                     -- '2026-Q1', '2026-Q2', etc.
    progress_percent NUMERIC(5,2) DEFAULT 0,
    status TEXT DEFAULT 'planned',    -- 'planned', 'in_progress', 'completed', 'delayed', 'blocked'
    risk_level TEXT DEFAULT 'low',    -- 'low', 'medium', 'high', 'critical'
    depends_on UUID[],                -- Array of milestone IDs this depends on
    target_start DATE,
    target_end DATE,
    owner_account_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. roadmap_streams: Execution Stream (How) - Work tracks within a milestone
CREATE TABLE IF NOT EXISTS roadmap_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID REFERENCES roadmap_milestones(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,           -- 'backend', 'frontend', 'infra', 'design', 'qa'
    color TEXT,                       -- Hex color for UI
    progress_percent NUMERIC(5,2) DEFAULT 0,
    owner_account_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. roadmap_epic_links: Epic connections to milestones/streams
CREATE TABLE IF NOT EXISTS roadmap_epic_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID REFERENCES roadmap_milestones(id) ON DELETE CASCADE,
    stream_id UUID REFERENCES roadmap_streams(id) ON DELETE SET NULL,
    epic_key TEXT NOT NULL,
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (milestone_id, epic_key)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_roadmap_visions_project ON roadmap_visions(project_key);
CREATE INDEX IF NOT EXISTS idx_roadmap_visions_status ON roadmap_visions(status);
CREATE INDEX IF NOT EXISTS idx_roadmap_milestones_vision ON roadmap_milestones(vision_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_milestones_quarter ON roadmap_milestones(quarter);
CREATE INDEX IF NOT EXISTS idx_roadmap_milestones_status ON roadmap_milestones(status);
CREATE INDEX IF NOT EXISTS idx_roadmap_streams_milestone ON roadmap_streams(milestone_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_epic_links_milestone ON roadmap_epic_links(milestone_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_epic_links_epic ON roadmap_epic_links(epic_key);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_roadmap_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_roadmap_visions_updated ON roadmap_visions;
CREATE TRIGGER trigger_roadmap_visions_updated
    BEFORE UPDATE ON roadmap_visions
    FOR EACH ROW
    EXECUTE FUNCTION update_roadmap_updated_at();

DROP TRIGGER IF EXISTS trigger_roadmap_milestones_updated ON roadmap_milestones;
CREATE TRIGGER trigger_roadmap_milestones_updated
    BEFORE UPDATE ON roadmap_milestones
    FOR EACH ROW
    EXECUTE FUNCTION update_roadmap_updated_at();

-- Verify
SELECT 'Roadmap tables created successfully' as status;
