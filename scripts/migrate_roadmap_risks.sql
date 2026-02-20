-- Roadmap Risks Table for AI Risk Detection
-- Run: psql -d javis_brain -f scripts/migrate_roadmap_risks.sql

-- Risk detection table
CREATE TABLE IF NOT EXISTS roadmap_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES roadmap_milestones(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES roadmap_streams(id) ON DELETE SET NULL,
  epic_key TEXT,

  -- Risk classification
  risk_type TEXT NOT NULL,  -- delay, blocker, resource_conflict, dependency_block, velocity_drop
  severity TEXT NOT NULL DEFAULT 'medium',  -- low, medium, high, critical

  -- Risk details
  title TEXT NOT NULL,
  description TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),

  -- Resolution
  status TEXT DEFAULT 'open',  -- open, acknowledged, mitigated, resolved, false_positive
  resolved_at TIMESTAMP,
  resolution_note TEXT,

  -- AI analysis
  ai_suggestion TEXT,  -- AI recommended action
  confidence_score NUMERIC(3,2),  -- 0.00 ~ 1.00

  -- Metrics that triggered the risk
  trigger_data JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_roadmap_risks_milestone ON roadmap_risks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_risks_status ON roadmap_risks(status);
CREATE INDEX IF NOT EXISTS idx_roadmap_risks_severity ON roadmap_risks(severity);
CREATE INDEX IF NOT EXISTS idx_roadmap_risks_type ON roadmap_risks(risk_type);
CREATE INDEX IF NOT EXISTS idx_roadmap_risks_detected ON roadmap_risks(detected_at DESC);

-- Update trigger
CREATE OR REPLACE FUNCTION update_roadmap_risks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS roadmap_risks_updated ON roadmap_risks;
CREATE TRIGGER roadmap_risks_updated
  BEFORE UPDATE ON roadmap_risks
  FOR EACH ROW
  EXECUTE FUNCTION update_roadmap_risks_timestamp();

-- Risk history for tracking (optional, for audit)
CREATE TABLE IF NOT EXISTS roadmap_risk_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID REFERENCES roadmap_risks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- created, status_changed, resolved
  old_status TEXT,
  new_status TEXT,
  changed_by TEXT,
  changed_at TIMESTAMP DEFAULT NOW(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_risk_history_risk ON roadmap_risk_history(risk_id);

COMMENT ON TABLE roadmap_risks IS 'AI-detected risks for roadmap milestones and streams';
COMMENT ON COLUMN roadmap_risks.risk_type IS 'delay: 일정지연, blocker: 차단이슈, resource_conflict: 리소스충돌, dependency_block: 의존성차단, velocity_drop: 속도저하';
COMMENT ON COLUMN roadmap_risks.confidence_score IS 'AI confidence level 0.00~1.00';
