-- Migration: Add default_component and default_labels to roadmap_visions
-- Date: 2026-01-31
-- Purpose: Vision별 Jira 컴포넌트/라벨 기본값 관리

-- Add columns
ALTER TABLE roadmap_visions
ADD COLUMN IF NOT EXISTS default_component TEXT,
ADD COLUMN IF NOT EXISTS default_labels TEXT[];

-- Set initial values
UPDATE roadmap_visions
SET default_component = 'OQCDigitalization',
    default_labels = ARRAY['oqc-digitalization']
WHERE project_key = 'EUV';

UPDATE roadmap_visions
SET default_component = 'Unify Plasma',
    default_labels = ARRAY['unify-plasma-single']
WHERE project_key = 'ASP';

-- Add comment
COMMENT ON COLUMN roadmap_visions.default_component IS 'Default Jira component for issues created under this Vision';
COMMENT ON COLUMN roadmap_visions.default_labels IS 'Default Jira labels for issues created under this Vision';
