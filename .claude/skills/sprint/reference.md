# Sprint Reference - 상세 쿼리 및 분석

## 데이터베이스 스키마

```sql
-- 스프린트
jira_sprints (id, name, state, goal, start_date, end_date, board_id)

-- 보드
jira_boards (id, name, type, project_key)

-- 이슈-스프린트 매핑
jira_issue_sprints (issue_key, sprint_id)

-- 이슈
jira_issues (key, summary, status, raw_data)
  - raw_data->'fields'->'assignee'->>'displayName'
  - raw_data->'fields'->>'customfield_10016' (Story Points)
```

## SQL 쿼리 모음

### 현재 스프린트 상태

```sql
WITH active_sprint AS (
    SELECT id, name, goal, start_date, end_date,
           EXTRACT(DAY FROM end_date - NOW()) as days_remaining
    FROM jira_sprints
    WHERE state = 'active'
    ORDER BY start_date DESC
    LIMIT 1
),
sprint_issues AS (
    SELECT
        ji.key,
        ji.summary,
        ji.status,
        ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
        (ji.raw_data->'fields'->>'customfield_10016')::numeric as story_points
    FROM jira_issue_sprints jis
    JOIN jira_issues ji ON ji.key = jis.issue_key
    JOIN active_sprint a ON a.id = jis.sprint_id
)
SELECT
    (SELECT name FROM active_sprint) as sprint_name,
    (SELECT goal FROM active_sprint) as sprint_goal,
    (SELECT start_date::date FROM active_sprint) as start_date,
    (SELECT end_date::date FROM active_sprint) as end_date,
    (SELECT days_remaining::int FROM active_sprint) as days_left,
    COUNT(*) as total_issues,
    COUNT(CASE WHEN status = 'Done' THEN 1 END) as done,
    COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
    COUNT(CASE WHEN status = 'To Do' THEN 1 END) as todo,
    ROUND(COUNT(CASE WHEN status = 'Done' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as completion_pct,
    COALESCE(SUM(CASE WHEN status = 'Done' THEN story_points END), 0) as points_done,
    COALESCE(SUM(story_points), 0) as points_total
FROM sprint_issues;
```

### 담당자별 작업량

```sql
WITH active_sprint AS (
    SELECT id FROM jira_sprints WHERE state = 'active' LIMIT 1
)
SELECT
    COALESCE(ji.raw_data->'fields'->'assignee'->>'displayName', 'Unassigned') as assignee,
    COUNT(*) as issues,
    COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
    COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress,
    COALESCE(SUM((ji.raw_data->'fields'->>'customfield_10016')::numeric), 0) as points
FROM jira_issue_sprints jis
JOIN jira_issues ji ON ji.key = jis.issue_key
JOIN active_sprint a ON a.id = jis.sprint_id
GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
ORDER BY issues DESC;
```

### Velocity 추이 (최근 6개 스프린트)

```sql
WITH sprint_velocity AS (
    SELECT
        s.name,
        s.start_date,
        COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as stories_done,
        COALESCE(SUM(CASE WHEN ji.status = 'Done' 
            THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as points_done,
        COUNT(jis.issue_key) as total_issues,
        COALESCE(SUM((ji.raw_data->'fields'->>'customfield_10016')::numeric), 0) as total_points
    FROM jira_sprints s
    LEFT JOIN jira_issue_sprints jis ON jis.sprint_id = s.id
    LEFT JOIN jira_issues ji ON ji.key = jis.issue_key
    WHERE s.state = 'closed'
    GROUP BY s.id, s.name, s.start_date
    ORDER BY s.start_date DESC
    LIMIT 6
)
SELECT
    name,
    stories_done,
    points_done,
    total_issues as committed,
    ROUND(stories_done::numeric / NULLIF(total_issues, 0) * 100, 0) as completion_pct
FROM sprint_velocity
ORDER BY start_date;
```

### 평균 Velocity 계산

```sql
WITH recent_sprints AS (
    SELECT
        COALESCE(SUM(CASE WHEN ji.status = 'Done' 
            THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as points_done,
        COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as stories_done
    FROM jira_sprints s
    LEFT JOIN jira_issue_sprints jis ON jis.sprint_id = s.id
    LEFT JOIN jira_issues ji ON ji.key = jis.issue_key
    WHERE s.state = 'closed'
    GROUP BY s.id
    ORDER BY s.start_date DESC
    LIMIT 6
)
SELECT
    ROUND(AVG(points_done), 1) as avg_velocity_points,
    ROUND(AVG(stories_done), 1) as avg_velocity_stories,
    MIN(points_done) as min_points,
    MAX(points_done) as max_points
FROM recent_sprints;
```

### 백로그 이슈 (스프린트 미배정)

```sql
SELECT
    ji.key,
    ji.summary,
    ji.raw_data->'fields'->'priority'->>'name' as priority,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    (ji.raw_data->'fields'->>'customfield_10016')::numeric as points,
    ji.raw_data->'fields'->'parent'->>'key' as epic
FROM jira_issues ji
LEFT JOIN jira_issue_sprints jis ON jis.issue_key = ji.key
WHERE jis.issue_key IS NULL
  AND ji.status = 'To Do'
  AND ji.raw_data->'fields'->'issuetype'->>'name' IN ('Story', 'Task', 'Bug')
ORDER BY
    CASE ji.raw_data->'fields'->'priority'->>'name'
        WHEN 'Highest' THEN 1
        WHEN 'High' THEN 2
        WHEN 'Medium' THEN 3
        WHEN 'Low' THEN 4
        ELSE 5
    END,
    ji.created_at
LIMIT 20;
```

### 번다운 차트 데이터

```sql
WITH active_sprint AS (
    SELECT id, name, start_date, end_date
    FROM jira_sprints WHERE state = 'active' LIMIT 1
),
daily_progress AS (
    SELECT
        DATE(ji.updated_at) as day,
        COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as completed_that_day
    FROM jira_issue_sprints jis
    JOIN jira_issues ji ON ji.key = jis.issue_key
    JOIN active_sprint a ON a.id = jis.sprint_id
    WHERE ji.status = 'Done'
    GROUP BY DATE(ji.updated_at)
)
SELECT
    d.day,
    COALESCE(dp.completed_that_day, 0) as completed,
    SUM(COALESCE(dp.completed_that_day, 0)) OVER (ORDER BY d.day) as cumulative_done
FROM (
    SELECT generate_series(
        (SELECT start_date::date FROM active_sprint),
        LEAST((SELECT end_date::date FROM active_sprint), CURRENT_DATE),
        '1 day'::interval
    )::date as day
) d
LEFT JOIN daily_progress dp ON dp.day = d.day
ORDER BY d.day;
```

## Bitbucket 연동

### 스프린트 이슈 관련 개발 활동

```sql
WITH active_sprint AS (
    SELECT id FROM jira_sprints WHERE state = 'active' LIMIT 1
),
sprint_issues AS (
    SELECT jis.issue_key
    FROM jira_issue_sprints jis
    JOIN active_sprint a ON a.id = jis.sprint_id
)
SELECT
    bc.committed_at::date as date,
    bc.author_name,
    LEFT(bc.message, 50) as message,
    bc.jira_keys,
    br.slug as repo
FROM bitbucket_commits bc
JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
WHERE bc.jira_keys && (SELECT ARRAY_AGG(issue_key) FROM sprint_issues)
ORDER BY bc.committed_at DESC
LIMIT 10;
```
