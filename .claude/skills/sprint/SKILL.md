---
name: sprint
description: 스프린트 관리. 현재/과거 스프린트 조회, velocity 추적, 스프린트 계획, 멤버별 작업량. 사용법: /sprint, /sprint list, /sprint velocity, /sprint plan
---

# /sprint - 스프린트 관리

스프린트 현황 조회, velocity 추적, 스프린트 계획을 지원합니다.

## 데이터 소스

| 정보 | 테이블 |
|------|--------|
| 스프린트 | `jira_sprints` (state: active/closed/future) |
| 보드 | `jira_boards` |
| 이슈-스프린트 매핑 | `jira_issue_sprints` |
| 이슈 상세 | `jira_issues` |
| 멤버 통계 | `member_stats` (period_type='sprint') |
| 팀원 | `team_members` |

**DB 연결**: localhost:5439, javis_brain, user: javis

---

## 명령어

### `/sprint` 또는 `/sprint current`
현재 활성 스프린트 상태 조회

**출력 정보:**
- 스프린트 이름, 기간, 남은 일수
- 전체 이슈 수, 완료/진행중/대기 비율
- Story Points (완료/전체)
- 담당자별 작업량

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
-- 현재 활성 스프린트
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
        (ji.raw_data->'fields'->>'customfield_10016')::numeric as story_points,
        ji.raw_data->'fields'->'issuetype'->>'name' as issue_type
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
"
```

**담당자별 작업량:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

---

### `/sprint list [--count N]`
최근 스프린트 목록 (기본 10개)

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    s.name,
    s.state,
    s.start_date::date,
    s.end_date::date,
    COUNT(jis.issue_key) as issues,
    COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
    ROUND(COUNT(CASE WHEN ji.status = 'Done' THEN 1 END)::numeric / NULLIF(COUNT(jis.issue_key), 0) * 100, 0) as completion_pct
FROM jira_sprints s
LEFT JOIN jira_issue_sprints jis ON jis.sprint_id = s.id
LEFT JOIN jira_issues ji ON ji.key = jis.issue_key
WHERE s.state IN ('active', 'closed', 'future')
GROUP BY s.id, s.name, s.state, s.start_date, s.end_date
ORDER BY s.start_date DESC
LIMIT 10;
"
```

---

### `/sprint <sprint_name>`
특정 스프린트 상세 조회

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
-- 스프린트 정보
SELECT name, state, goal, start_date::date, end_date::date
FROM jira_sprints WHERE name ILIKE '%{sprint_name}%';

-- 스프린트 이슈 목록
SELECT
    ji.key,
    ji.summary,
    ji.status,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    ji.raw_data->'fields'->'issuetype'->>'name' as type,
    (ji.raw_data->'fields'->>'customfield_10016')::numeric as points
FROM jira_issue_sprints jis
JOIN jira_sprints s ON s.id = jis.sprint_id
JOIN jira_issues ji ON ji.key = jis.issue_key
WHERE s.name ILIKE '%{sprint_name}%'
ORDER BY
    CASE ji.status
        WHEN 'In Progress' THEN 1
        WHEN 'To Do' THEN 2
        WHEN 'Done' THEN 3
        ELSE 4
    END,
    ji.key;
"
```

---

### `/sprint velocity`
Velocity 추이 분석 (최근 6개 스프린트)

**출력 정보:**
- 스프린트별 완료 포인트
- 평균 velocity
- 완료율 추이
- 예측 가능 capacity

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH sprint_velocity AS (
    SELECT
        s.name,
        s.start_date,
        COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as stories_done,
        COALESCE(SUM(CASE WHEN ji.status = 'Done' THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as points_done,
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
"

-- 평균 velocity 계산
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH recent_sprints AS (
    SELECT
        COALESCE(SUM(CASE WHEN ji.status = 'Done' THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as points_done,
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
"
```

---

### `/sprint plan [epic_key]`
다음 스프린트 계획 지원

**출력 정보:**
- 다음 스프린트 정보 (future)
- Backlog 이슈 (스프린트 미배정)
- 우선순위별 이슈 목록
- 예상 capacity 기반 추천

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
-- 다음 스프린트
SELECT name, start_date::date, end_date::date
FROM jira_sprints
WHERE state = 'future'
ORDER BY start_date
LIMIT 1;

-- 백로그 이슈 (스프린트 미배정, To Do 상태)
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
  AND ('{epic_key}' = '' OR ji.raw_data->'fields'->'parent'->>'key' = '{epic_key}')
ORDER BY
    CASE ji.raw_data->'fields'->'priority'->>'name'
        WHEN 'Highest' THEN 1
        WHEN 'High' THEN 2
        WHEN 'Medium' THEN 3
        WHEN 'Low' THEN 4
        WHEN 'Lowest' THEN 5
        ELSE 6
    END,
    ji.created_at
LIMIT 20;
"
```

---

### `/sprint burndown`
현재 스프린트 번다운 차트 데이터

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

---

### `/sprint member <member_name>`
특정 멤버의 스프린트 현황

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH active_sprint AS (
    SELECT id FROM jira_sprints WHERE state = 'active' LIMIT 1
)
SELECT
    ji.key,
    ji.summary,
    ji.status,
    ji.raw_data->'fields'->'issuetype'->>'name' as type,
    (ji.raw_data->'fields'->>'customfield_10016')::numeric as points
FROM jira_issue_sprints jis
JOIN jira_issues ji ON ji.key = jis.issue_key
JOIN active_sprint a ON a.id = jis.sprint_id
WHERE ji.raw_data->'fields'->'assignee'->>'displayName' ILIKE '%{member_name}%'
ORDER BY
    CASE ji.status
        WHEN 'In Progress' THEN 1
        WHEN 'To Do' THEN 2
        WHEN 'Done' THEN 3
        ELSE 4
    END;
"
```

---

## Bitbucket 연동

스프린트 이슈와 연관된 개발 활동 조회:

```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH active_sprint AS (
    SELECT id FROM jira_sprints WHERE state = 'active' LIMIT 1
),
sprint_issues AS (
    SELECT jis.issue_key
    FROM jira_issue_sprints jis
    JOIN active_sprint a ON a.id = jis.sprint_id
)
-- 스프린트 이슈 관련 최근 커밋
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
"
```

---

## 워크플로우 예시

### 1. 스프린트 시작 시
```
/sprint current              # 현재 스프린트 확인
/sprint velocity             # velocity 추이 확인
```

### 2. 데일리 스크럼
```
/sprint                      # 진행 상황 확인
/sprint member Gerald        # 내 작업 확인
```

### 3. 스프린트 계획
```
/sprint velocity             # 예상 capacity 확인
/sprint plan                 # 백로그에서 이슈 선택
/sprint plan EUV-3299        # 특정 Epic 이슈만 확인
```

### 4. 스프린트 회고
```
/sprint Scaled Sprint13      # 완료된 스프린트 상세
/sprint velocity             # velocity 변화 분석
```
