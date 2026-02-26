# Dev Reference - 상세 쿼리 및 분석

## 데이터베이스 스키마

```sql
-- 팀원
team_members (account_id, display_name, email, role, team, skills, is_active)

-- 멤버 통계
member_stats (member_id, period_type, period_id, stories_completed, story_points_earned, 
              bugs_fixed, tasks_completed, development_score, velocity_avg)

-- Bitbucket 커밋
bitbucket_commits (hash, repo_uuid, author_name, author_email, message, 
                   jira_keys[], committed_at, synced_at)

-- Bitbucket PR
bitbucket_pullrequests (id, repo_uuid, pr_number, title, state, 
                        author_name, source_branch, jira_keys[], created_at)
```

## SQL 쿼리 모음

### 개발자 할당 이슈 (현재 스프린트)

```sql
WITH active_sprint AS (
    SELECT id FROM jira_sprints WHERE state = 'active' LIMIT 1
)
SELECT
    ji.key,
    ji.summary,
    ji.status,
    ji.raw_data->'fields'->'issuetype'->>'name' as type,
    (ji.raw_data->'fields'->>'customfield_10016')::numeric as points,
    ji.raw_data->'fields'->'parent'->>'key' as epic
FROM jira_issue_sprints jis
JOIN jira_issues ji ON ji.key = jis.issue_key
JOIN active_sprint a ON a.id = jis.sprint_id
WHERE ji.raw_data->'fields'->'assignee'->>'displayName' ILIKE '%{name}%'
ORDER BY
    CASE ji.status
        WHEN 'In Progress' THEN 1
        WHEN 'To Do' THEN 2
        WHEN 'Done' THEN 3
        ELSE 4
    END;
```

### 최근 커밋 (7일)

```sql
SELECT
    bc.committed_at::date as date,
    br.slug as repo,
    LEFT(bc.message, 50) as message,
    bc.jira_keys
FROM bitbucket_commits bc
JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
WHERE bc.author_name ILIKE '%{name}%'
  AND bc.committed_at > NOW() - INTERVAL '7 days'
ORDER BY bc.committed_at DESC
LIMIT 10;
```

### 커밋 활동 분석

```sql
SELECT
    bc.author_name,
    COUNT(*) as commits,
    COUNT(DISTINCT br.slug) as repos,
    COUNT(DISTINCT bc.committed_at::date) as active_days
FROM bitbucket_commits bc
JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
WHERE bc.committed_at > NOW() - INTERVAL '7 days'
GROUP BY bc.author_name
ORDER BY commits DESC
LIMIT 15;
```

### PR 현황

```sql
SELECT
    bp.pr_number,
    br.slug as repo,
    bp.title,
    bp.state,
    bp.source_branch,
    bp.jira_keys,
    bp.created_at::date
FROM bitbucket_pullrequests bp
JOIN bitbucket_repositories br ON br.uuid = bp.repo_uuid
WHERE bp.author_name ILIKE '%{name}%'
ORDER BY bp.created_at DESC
LIMIT 20;
```

### 팀 현황 비교

```sql
WITH active_sprint AS (
    SELECT id FROM jira_sprints WHERE state = 'active' LIMIT 1
),
member_sprint_stats AS (
    SELECT
        COALESCE(ji.raw_data->'fields'->'assignee'->>'displayName', 'Unassigned') as member,
        COUNT(*) as assigned,
        COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
        COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress,
        COALESCE(SUM((ji.raw_data->'fields'->>'customfield_10016')::numeric), 0) as points
    FROM jira_issue_sprints jis
    JOIN jira_issues ji ON ji.key = jis.issue_key
    JOIN active_sprint a ON a.id = jis.sprint_id
    GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
),
member_commits AS (
    SELECT author_name, COUNT(*) as commits_7d
    FROM bitbucket_commits
    WHERE committed_at > NOW() - INTERVAL '7 days'
    GROUP BY author_name
)
SELECT
    s.member,
    s.assigned,
    s.done,
    s.in_progress,
    ROUND(s.done::numeric / NULLIF(s.assigned, 0) * 100, 0) as completion_pct,
    s.points,
    COALESCE(c.commits_7d, 0) as commits_7d
FROM member_sprint_stats s
LEFT JOIN member_commits c 
    ON LOWER(c.author_name) LIKE '%' || LOWER(SPLIT_PART(s.member, ' ', 1)) || '%'
WHERE s.member != 'Unassigned'
ORDER BY s.assigned DESC;
```

### 작업 부하 분석

```sql
SELECT
    COALESCE(ji.raw_data->'fields'->'assignee'->>'displayName', 'Unassigned') as member,
    COUNT(CASE WHEN ji.status = 'To Do' THEN 1 END) as todo,
    COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress,
    COUNT(CASE WHEN ji.status NOT IN ('Done', 'Closed', 'Resolved') THEN 1 END) as open_total,
    COALESCE(SUM(CASE WHEN ji.status NOT IN ('Done', 'Closed', 'Resolved')
        THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as open_points
FROM jira_issues ji
WHERE ji.raw_data->'fields'->'assignee' IS NOT NULL
  AND ji.status NOT IN ('Done', 'Closed', 'Resolved')
GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
ORDER BY open_total DESC;
```

### 이슈별 커밋 연결

```sql
SELECT
    ji.key,
    ji.summary,
    COUNT(bc.hash) as commit_count,
    STRING_AGG(DISTINCT bc.author_name, ', ') as contributors
FROM jira_issues ji
JOIN bitbucket_commits bc ON ji.key = ANY(bc.jira_keys)
WHERE ji.raw_data->'fields'->'assignee'->>'displayName' ILIKE '%{name}%'
GROUP BY ji.key, ji.summary
ORDER BY commit_count DESC
LIMIT 10;
```

### 개발자 통계 히스토리

```sql
SELECT
    ms.period_id as sprint,
    ms.stories_completed,
    ms.story_points_earned,
    ms.bugs_fixed,
    ms.tasks_completed,
    ms.development_score,
    ms.velocity_avg
FROM member_stats ms
JOIN team_members tm ON tm.id = ms.member_id
WHERE tm.display_name ILIKE '%{name}%'
  AND ms.period_type = 'sprint'
ORDER BY ms.period_id DESC
LIMIT 10;
```
