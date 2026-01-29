-- Vision Members Table (프로젝트별 멤버 역할 관리)
-- Migration for tracking member roles per project/vision
-- Run with: PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -f scripts/migrate_vision_members.sql

-- 1. roadmap_vision_members: 프로젝트(Vision)별 멤버 역할 및 투입 공수
CREATE TABLE IF NOT EXISTS roadmap_vision_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_id UUID NOT NULL REFERENCES roadmap_visions(id) ON DELETE CASCADE,
  member_account_id TEXT NOT NULL REFERENCES team_members(account_id) ON DELETE CASCADE,

  -- 역할 정보
  role_title TEXT NOT NULL,                -- "Technical PM", "Fullstack Engineer"
  role_category TEXT,                      -- 'pm', 'backend', 'frontend', 'plc', 'qa', 'scenario', 'devops', 'fullstack'
  role_description TEXT,                   -- 상세 역할 설명

  -- 투입 공수
  mm_allocation NUMERIC(3,1),              -- 0.5, 1.0 (Man-Month)

  -- 참여 기간
  start_date DATE,
  end_date DATE,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 같은 Vision에 같은 멤버는 한 번만
  UNIQUE (vision_id, member_account_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_vision_members_vision ON roadmap_vision_members(vision_id);
CREATE INDEX IF NOT EXISTS idx_vision_members_member ON roadmap_vision_members(member_account_id);
CREATE INDEX IF NOT EXISTS idx_vision_members_category ON roadmap_vision_members(role_category);

-- updated_at 트리거
DROP TRIGGER IF EXISTS trigger_vision_members_updated ON roadmap_vision_members;
CREATE TRIGGER trigger_vision_members_updated
    BEFORE UPDATE ON roadmap_vision_members
    FOR EACH ROW
    EXECUTE FUNCTION update_roadmap_updated_at();

-- 유용한 뷰: 프로젝트별 멤버 목록 (카테고리별 그룹핑용)
CREATE OR REPLACE VIEW vision_members_with_details AS
SELECT
  vm.id,
  vm.vision_id,
  vm.member_account_id,
  vm.role_title,
  vm.role_category,
  vm.role_description,
  vm.mm_allocation,
  vm.start_date,
  vm.end_date,
  vm.created_at,
  vm.updated_at,
  -- Vision 정보
  v.title as vision_title,
  v.project_key,
  -- Member 정보
  tm.display_name,
  tm.avatar_url,
  tm.email,
  tm.role as company_role,
  tm.team,
  tm.skills
FROM roadmap_vision_members vm
JOIN roadmap_visions v ON v.id = vm.vision_id
JOIN team_members tm ON tm.account_id = vm.member_account_id;

-- 유용한 뷰: 멤버별 프로젝트 참여 목록
CREATE OR REPLACE VIEW member_project_roles AS
SELECT
  tm.account_id,
  tm.display_name,
  tm.avatar_url,
  array_agg(DISTINCT v.title) as projects,
  array_agg(DISTINCT vm.role_title) as roles,
  SUM(vm.mm_allocation) as total_mm_allocation,
  COUNT(DISTINCT vm.vision_id) as project_count
FROM team_members tm
LEFT JOIN roadmap_vision_members vm ON vm.member_account_id = tm.account_id
LEFT JOIN roadmap_visions v ON v.id = vm.vision_id
WHERE tm.is_active = true
GROUP BY tm.account_id, tm.display_name, tm.avatar_url;

-- Verify
SELECT 'Vision members table created successfully' as status;
