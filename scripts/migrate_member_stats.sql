-- Team Member Stats Management Schema
-- Migration for member stats, ratings, and evaluation system

-- 1. Team Members Table (기본 정보)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT UNIQUE NOT NULL,      -- Jira accountId
  display_name TEXT NOT NULL,            -- Jira displayName
  email TEXT,
  avatar_url TEXT,                       -- 프로필 이미지 URL

  -- 역할 정보
  role TEXT DEFAULT 'developer',         -- developer, lead, tester, designer, pm
  team TEXT,                             -- 소속 팀

  -- 주요 스킬 (배열)
  skills TEXT[],                         -- ['React', 'TypeScript', 'Python']

  -- 상태
  is_active BOOLEAN DEFAULT TRUE,
  joined_at DATE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_team_members_account_id ON team_members(account_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team);
CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON team_members(is_active);

-- 2. Member Stats Table (누적/집계 스탯)
CREATE TABLE IF NOT EXISTS member_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,

  -- 기간 (NULL = 전체 누적)
  period_type TEXT,                      -- NULL | 'sprint' | 'month' | 'quarter' | 'year'
  period_id TEXT,                        -- sprint_id 또는 '2026-01', '2026-Q1' 등

  -- 개발 스탯
  stories_completed INT DEFAULT 0,       -- 완료한 스토리 수
  story_points_earned NUMERIC(10,2) DEFAULT 0, -- 누적 스토리포인트
  bugs_fixed INT DEFAULT 0,              -- 버그 수정 수
  tasks_completed INT DEFAULT 0,         -- 완료한 태스크 수

  -- 공헌 스탯
  reviews_given INT DEFAULT 0,           -- 코드 리뷰 수
  reviews_received INT DEFAULT 0,        -- 리뷰 받은 수
  tests_written INT DEFAULT 0,           -- 테스트 작성 수
  docs_written INT DEFAULT 0,            -- 문서 작성 수

  -- 품질 스탯
  bugs_introduced INT DEFAULT 0,         -- 도입된 버그 수
  rework_count INT DEFAULT 0,            -- 재작업 횟수
  on_time_delivery INT DEFAULT 0,        -- 기한 내 완료 수
  late_delivery INT DEFAULT 0,           -- 기한 초과 수

  -- 레이팅 (0-100 스케일)
  development_score NUMERIC(5,2) DEFAULT 50,   -- 개발 역량
  review_score NUMERIC(5,2) DEFAULT 50,        -- 리뷰 역량
  testing_score NUMERIC(5,2) DEFAULT 50,       -- 테스트 역량
  collaboration_score NUMERIC(5,2) DEFAULT 50, -- 협업 역량

  -- 종합 스탯
  maturity_level INT DEFAULT 1 CHECK (maturity_level BETWEEN 1 AND 10), -- 성숙도 레벨
  contribution_score NUMERIC(5,2) DEFAULT 50,  -- 종합 공헌도
  velocity_avg NUMERIC(10,2) DEFAULT 0,        -- 평균 속도 (포인트/스프린트)

  calculated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (member_id, period_type, period_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_member_stats_member_id ON member_stats(member_id);
CREATE INDEX IF NOT EXISTS idx_member_stats_period ON member_stats(period_type, period_id);
CREATE INDEX IF NOT EXISTS idx_member_stats_calculated ON member_stats(calculated_at);

-- 3. Stat History Table (변경 이력)
CREATE TABLE IF NOT EXISTS member_stat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,

  -- 변경 원인
  trigger_type TEXT NOT NULL,            -- 'story_completed' | 'bug_fixed' | 'review_done' | 'manual' | 'recalculate'
  trigger_ref TEXT,                      -- issue_key 또는 설명

  -- 변경 내용
  stat_name TEXT NOT NULL,               -- 변경된 스탯 이름
  old_value NUMERIC,
  new_value NUMERIC,
  delta NUMERIC,                         -- 변경량 (+/-)

  -- 메타
  changed_by TEXT,                       -- 'system' | 팀장 account_id
  reason TEXT,                           -- 변경 사유
  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_stat_history_member ON member_stat_history(member_id);
CREATE INDEX IF NOT EXISTS idx_stat_history_trigger ON member_stat_history(trigger_type);
CREATE INDEX IF NOT EXISTS idx_stat_history_created ON member_stat_history(created_at);

-- 4. Manager Evaluations Table (팀장 평가)
CREATE TABLE IF NOT EXISTS manager_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,

  -- 평가 기간
  evaluation_period TEXT NOT NULL,       -- '2026-Q1', '2026-01', 'Sprint 45'
  period_start DATE,
  period_end DATE,

  -- 평가 항목 (1-5 스케일)
  technical_skill INT CHECK (technical_skill BETWEEN 1 AND 5),
  communication INT CHECK (communication BETWEEN 1 AND 5),
  problem_solving INT CHECK (problem_solving BETWEEN 1 AND 5),
  initiative INT CHECK (initiative BETWEEN 1 AND 5),
  teamwork INT CHECK (teamwork BETWEEN 1 AND 5),

  -- 코멘트
  strengths TEXT,
  improvements TEXT,
  notes TEXT,

  -- 스탯 조정 (JSONB)
  score_adjustments JSONB,               -- {"development_score": 5, "review_score": -2}

  -- 메타
  evaluated_by TEXT NOT NULL,            -- 평가자 account_id
  evaluated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (member_id, evaluation_period)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_evaluations_member ON manager_evaluations(member_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_period ON manager_evaluations(evaluation_period);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator ON manager_evaluations(evaluated_by);

-- 5. Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_team_members_updated_at ON team_members;
CREATE TRIGGER update_team_members_updated_at
    BEFORE UPDATE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Helper View: Member Summary (랭킹용)
CREATE OR REPLACE VIEW member_ranking AS
SELECT
    tm.id,
    tm.account_id,
    tm.display_name,
    tm.role,
    tm.team,
    tm.skills,
    tm.avatar_url,
    tm.is_active,
    COALESCE(ms.stories_completed, 0) as total_stories,
    COALESCE(ms.story_points_earned, 0) as total_points,
    COALESCE(ms.bugs_fixed, 0) as total_bugs_fixed,
    COALESCE(ms.contribution_score, 50) as contribution_score,
    COALESCE(ms.maturity_level, 1) as maturity_level,
    RANK() OVER (ORDER BY COALESCE(ms.contribution_score, 50) DESC) as rank_contribution,
    RANK() OVER (ORDER BY COALESCE(ms.story_points_earned, 0) DESC) as rank_points
FROM team_members tm
LEFT JOIN member_stats ms ON tm.id = ms.member_id
    AND ms.period_type IS NULL  -- 전체 누적 스탯
WHERE tm.is_active = TRUE;

-- 7. Helper View: Period Stats Summary
CREATE OR REPLACE VIEW member_period_stats AS
SELECT
    tm.display_name,
    tm.team,
    ms.period_type,
    ms.period_id,
    ms.stories_completed,
    ms.story_points_earned,
    ms.bugs_fixed,
    ms.on_time_delivery,
    ms.late_delivery,
    ms.development_score,
    ms.contribution_score,
    ms.calculated_at
FROM member_stats ms
JOIN team_members tm ON ms.member_id = tm.id
WHERE ms.period_type IS NOT NULL
ORDER BY ms.period_type, ms.period_id DESC;

-- 8. Initial data migration: Extract unique assignees from existing issues
-- This should be run after table creation to populate initial members
INSERT INTO team_members (account_id, display_name, avatar_url)
SELECT DISTINCT
    raw_data->'fields'->'assignee'->>'accountId' as account_id,
    raw_data->'fields'->'assignee'->>'displayName' as display_name,
    raw_data->'fields'->'assignee'->'avatarUrls'->>'48x48' as avatar_url
FROM jira_issues
WHERE raw_data->'fields'->'assignee'->>'accountId' IS NOT NULL
ON CONFLICT (account_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();

-- Also add reporters who might not be assignees
INSERT INTO team_members (account_id, display_name, avatar_url)
SELECT DISTINCT
    raw_data->'fields'->'reporter'->>'accountId' as account_id,
    raw_data->'fields'->'reporter'->>'displayName' as display_name,
    raw_data->'fields'->'reporter'->'avatarUrls'->>'48x48' as avatar_url
FROM jira_issues
WHERE raw_data->'fields'->'reporter'->>'accountId' IS NOT NULL
ON CONFLICT (account_id) DO NOTHING;

-- 9. Create initial cumulative stats for each member
INSERT INTO member_stats (member_id, period_type, period_id)
SELECT id, NULL, NULL
FROM team_members
ON CONFLICT (member_id, period_type, period_id) DO NOTHING;

COMMENT ON TABLE team_members IS '팀 멤버 기본 정보 테이블';
COMMENT ON TABLE member_stats IS '멤버별 스탯/레이팅 (기간별 또는 누적)';
COMMENT ON TABLE member_stat_history IS '스탯 변경 이력 추적';
COMMENT ON TABLE manager_evaluations IS '팀장 정기 평가';
COMMENT ON VIEW member_ranking IS '활성 멤버 랭킹 뷰';
COMMENT ON VIEW member_period_stats IS '기간별 스탯 요약 뷰';
