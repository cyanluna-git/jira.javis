-- Context Extraction Views - 4단계: AI 맥락 추출을 위한 View
-- Usage: psql -h localhost -p 5439 -U javis -d javis_brain -f scripts/migrate_context_views.sql

-- ============================================================================
-- 1. 진행중 이슈 뷰 (Work In Progress)
-- ============================================================================
DROP VIEW IF EXISTS v_work_in_progress CASCADE;
CREATE VIEW v_work_in_progress AS
SELECT
    ji.key,
    ji.project,
    ji.summary,
    ji.status,
    ji.raw_data->'fields'->'issuetype'->>'name' as issue_type,
    ji.raw_data->'fields'->'priority'->>'name' as priority,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    ji.raw_data->'fields'->'components'->0->>'name' as component,
    ji.raw_data->'fields'->'fixVersions'->0->>'name' as fix_version,
    ji.raw_data->'fields'->'parent'->>'key' as epic_key,
    ji.raw_data->'fields'->'labels' as labels,
    ji.created_at,
    ji.updated_at,
    EXTRACT(DAY FROM NOW() - ji.updated_at) as days_since_update
FROM jira_issues ji
WHERE ji.status IN ('In Progress', 'In Review', 'Testing')
ORDER BY ji.updated_at DESC;

COMMENT ON VIEW v_work_in_progress IS '진행중인 이슈 목록 (In Progress, In Review, Testing)';

-- ============================================================================
-- 2. 차단된 이슈 뷰 (Blocked Items)
-- ============================================================================
DROP VIEW IF EXISTS v_blocked_items CASCADE;
CREATE VIEW v_blocked_items AS
SELECT
    ji.key,
    ji.project,
    ji.summary,
    ji.status,
    ji.raw_data->'fields'->'issuetype'->>'name' as issue_type,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    ji.raw_data->'fields'->'components'->0->>'name' as component,
    ji.raw_data->'fields'->'parent'->>'key' as epic_key,
    -- Extract blocking issues from issuelinks
    (
        SELECT jsonb_agg(link->'inwardIssue'->>'key')
        FROM jsonb_array_elements(ji.raw_data->'fields'->'issuelinks') as link
        WHERE link->>'type' LIKE '%Block%' AND link->'inwardIssue' IS NOT NULL
    ) as blocked_by,
    ji.updated_at,
    EXTRACT(DAY FROM NOW() - ji.updated_at) as days_blocked
FROM jira_issues ji
WHERE ji.status = 'Blocked'
   OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(ji.raw_data->'fields'->'issuelinks') as link
       WHERE link->>'type' LIKE '%Block%' AND link->'inwardIssue' IS NOT NULL
   )
ORDER BY ji.updated_at ASC;

COMMENT ON VIEW v_blocked_items IS '차단된 이슈 목록 (Blocked 상태 또는 blocking 링크 있음)';

-- ============================================================================
-- 3. 리뷰 대기 뷰 (Pending Reviews)
-- ============================================================================
DROP VIEW IF EXISTS v_pending_reviews CASCADE;
CREATE VIEW v_pending_reviews AS
SELECT
    ji.key,
    ji.project,
    ji.summary,
    ji.status,
    ji.raw_data->'fields'->'issuetype'->>'name' as issue_type,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    ji.raw_data->'fields'->'components'->0->>'name' as component,
    ji.raw_data->'fields'->'parent'->>'key' as epic_key,
    ji.updated_at,
    EXTRACT(HOUR FROM NOW() - ji.updated_at) as hours_in_review
FROM jira_issues ji
WHERE ji.status IN ('In Review', 'Code Review', 'Peer Review')
ORDER BY ji.updated_at ASC;

COMMENT ON VIEW v_pending_reviews IS '리뷰 대기중인 이슈 목록';

-- ============================================================================
-- 4. 주의 필요 항목 뷰 (Attention Needed)
-- ============================================================================
DROP VIEW IF EXISTS v_attention_needed CASCADE;
CREATE VIEW v_attention_needed AS
SELECT
    ji.key,
    ji.project,
    ji.summary,
    ji.status,
    ji.raw_data->'fields'->'issuetype'->>'name' as issue_type,
    ji.raw_data->'fields'->'priority'->>'name' as priority,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    ji.raw_data->'fields'->'components'->0->>'name' as component,
    ji.updated_at,
    EXTRACT(DAY FROM NOW() - ji.updated_at) as days_stale,
    CASE
        WHEN ji.status = 'Blocked' THEN 'blocked'
        WHEN ji.raw_data->'fields'->'priority'->>'name' IN ('Highest', 'High') THEN 'high_priority'
        WHEN EXTRACT(DAY FROM NOW() - ji.updated_at) > 7 AND ji.status = 'In Progress' THEN 'stale_wip'
        WHEN EXTRACT(DAY FROM NOW() - ji.updated_at) > 14 THEN 'stale'
        ELSE 'other'
    END as attention_reason
FROM jira_issues ji
WHERE
    -- Blocked
    ji.status = 'Blocked'
    -- Or high priority open items
    OR (ji.raw_data->'fields'->'priority'->>'name' IN ('Highest', 'High')
        AND ji.status NOT IN ('Done', 'Closed', 'Resolved'))
    -- Or stale In Progress (> 7 days no update)
    OR (ji.status = 'In Progress' AND ji.updated_at < NOW() - INTERVAL '7 days')
    -- Or very stale items (> 14 days no update)
    OR (ji.status NOT IN ('Done', 'Closed', 'Resolved', 'Backlog')
        AND ji.updated_at < NOW() - INTERVAL '14 days')
ORDER BY
    CASE
        WHEN ji.status = 'Blocked' THEN 1
        WHEN ji.raw_data->'fields'->'priority'->>'name' = 'Highest' THEN 2
        WHEN ji.raw_data->'fields'->'priority'->>'name' = 'High' THEN 3
        ELSE 4
    END,
    ji.updated_at ASC;

COMMENT ON VIEW v_attention_needed IS '주의 필요 항목 (블로커, 고우선순위, 정체된 작업)';

-- ============================================================================
-- 5. Epic 진행 현황 뷰
-- ============================================================================
DROP VIEW IF EXISTS v_epic_progress CASCADE;
CREATE VIEW v_epic_progress AS
SELECT
    e.key as epic_key,
    e.project,
    e.summary as epic_summary,
    e.status as epic_status,
    e.raw_data->'fields'->'components'->0->>'name' as component,
    e.raw_data->'fields'->'fixVersions'->0->>'name' as fix_version,
    COUNT(s.key) as total_stories,
    COUNT(CASE WHEN s.status IN ('Done', 'Closed', 'Resolved') THEN 1 END) as done_stories,
    COUNT(CASE WHEN s.status = 'In Progress' THEN 1 END) as in_progress_stories,
    COUNT(CASE WHEN s.status IN ('To Do', 'Open', 'Backlog') THEN 1 END) as todo_stories,
    ROUND(
        COUNT(CASE WHEN s.status IN ('Done', 'Closed', 'Resolved') THEN 1 END)::NUMERIC /
        NULLIF(COUNT(s.key), 0) * 100, 1
    ) as completion_percentage
FROM jira_issues e
LEFT JOIN jira_issues s ON s.raw_data->'fields'->'parent'->>'key' = e.key
WHERE e.raw_data->'fields'->'issuetype'->>'name' = 'Epic'
GROUP BY e.key, e.project, e.summary, e.status,
         e.raw_data->'fields'->'components'->0->>'name',
         e.raw_data->'fields'->'fixVersions'->0->>'name'
ORDER BY completion_percentage DESC NULLS LAST;

COMMENT ON VIEW v_epic_progress IS 'Epic별 진행 현황 (Story 완료율 포함)';

-- ============================================================================
-- 6. 컴포넌트별 현황 뷰
-- ============================================================================
DROP VIEW IF EXISTS v_component_summary CASCADE;
CREATE VIEW v_component_summary AS
SELECT
    ji.raw_data->'fields'->'components'->0->>'name' as component,
    ji.project,
    COUNT(*) as total_issues,
    COUNT(CASE WHEN ji.status IN ('Done', 'Closed', 'Resolved') THEN 1 END) as done,
    COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress,
    COUNT(CASE WHEN ji.status IN ('To Do', 'Open', 'Backlog') THEN 1 END) as todo,
    COUNT(CASE WHEN ji.status = 'Blocked' THEN 1 END) as blocked,
    MAX(ji.updated_at) as last_activity
FROM jira_issues ji
WHERE ji.raw_data->'fields'->'components'->0->>'name' IS NOT NULL
  AND ji.created_at > NOW() - INTERVAL '6 months'
GROUP BY ji.raw_data->'fields'->'components'->0->>'name', ji.project
ORDER BY total_issues DESC;

COMMENT ON VIEW v_component_summary IS '컴포넌트별 이슈 현황 요약';

-- ============================================================================
-- 7. 최근 활동 뷰 (Recent Activity)
-- ============================================================================
DROP VIEW IF EXISTS v_recent_activity CASCADE;
CREATE VIEW v_recent_activity AS
SELECT
    ji.key,
    ji.project,
    ji.summary,
    ji.status,
    ji.raw_data->'fields'->'issuetype'->>'name' as issue_type,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    ji.raw_data->'fields'->'components'->0->>'name' as component,
    ji.updated_at,
    EXTRACT(HOUR FROM NOW() - ji.updated_at) as hours_ago
FROM jira_issues ji
WHERE ji.updated_at > NOW() - INTERVAL '3 days'
ORDER BY ji.updated_at DESC
LIMIT 50;

COMMENT ON VIEW v_recent_activity IS '최근 3일 내 업데이트된 이슈';

-- ============================================================================
-- 8. Sprint 현황 뷰 (로컬 Sprint 테이블 사용)
-- ============================================================================
DROP VIEW IF EXISTS v_sprint_status CASCADE;
CREATE VIEW v_sprint_status AS
SELECT
    s.id as sprint_id,
    s.name as sprint_name,
    s.state as sprint_state,
    s.start_date,
    s.end_date,
    s.goal as sprint_goal,
    COUNT(si.issue_key) as total_issues,
    COUNT(CASE WHEN ji.status IN ('Done', 'Closed', 'Resolved') THEN 1 END) as done_issues,
    COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress_issues,
    ROUND(
        COUNT(CASE WHEN ji.status IN ('Done', 'Closed', 'Resolved') THEN 1 END)::NUMERIC /
        NULLIF(COUNT(si.issue_key), 0) * 100, 1
    ) as completion_percentage,
    CASE
        WHEN s.state = 'active' THEN
            EXTRACT(DAY FROM s.end_date - NOW())
        ELSE NULL
    END as days_remaining
FROM jira_sprints s
LEFT JOIN sprint_issues si ON si.sprint_id = s.id
LEFT JOIN jira_issues ji ON ji.key = si.issue_key
GROUP BY s.id, s.name, s.state, s.start_date, s.end_date, s.goal
ORDER BY
    CASE s.state
        WHEN 'active' THEN 1
        WHEN 'future' THEN 2
        ELSE 3
    END,
    s.start_date DESC;

COMMENT ON VIEW v_sprint_status IS 'Sprint별 진행 현황';

-- ============================================================================
-- 9. AI Context 통합 뷰 (Context Aggregator용)
-- ============================================================================
DROP VIEW IF EXISTS v_ai_context_summary CASCADE;
CREATE VIEW v_ai_context_summary AS
SELECT
    'work_in_progress' as category,
    COUNT(*) as count,
    jsonb_agg(jsonb_build_object(
        'key', key,
        'summary', summary,
        'status', status,
        'component', component,
        'days_since_update', days_since_update
    ) ORDER BY days_since_update DESC) as items
FROM v_work_in_progress
UNION ALL
SELECT
    'blocked' as category,
    COUNT(*) as count,
    jsonb_agg(jsonb_build_object(
        'key', key,
        'summary', summary,
        'blocked_by', blocked_by,
        'days_blocked', days_blocked
    ) ORDER BY days_blocked DESC) as items
FROM v_blocked_items
UNION ALL
SELECT
    'pending_review' as category,
    COUNT(*) as count,
    jsonb_agg(jsonb_build_object(
        'key', key,
        'summary', summary,
        'hours_in_review', hours_in_review
    ) ORDER BY hours_in_review DESC) as items
FROM v_pending_reviews
UNION ALL
SELECT
    'attention_needed' as category,
    COUNT(*) as count,
    jsonb_agg(jsonb_build_object(
        'key', key,
        'summary', summary,
        'reason', attention_reason,
        'days_stale', days_stale
    ) ORDER BY days_stale DESC) as items
FROM v_attention_needed;

COMMENT ON VIEW v_ai_context_summary IS 'AI Context Aggregator용 통합 요약 뷰';

-- ============================================================================
-- Done
-- ============================================================================
SELECT 'Context views created successfully' as result;
