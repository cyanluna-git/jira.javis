---
name: javis-dev
description: 개발자 대시보드. 내 작업 현황, 커밋/PR 활동, 스프린트 기여도, 팀 비교. 사용법: /javis-dev, /javis-dev <name>, /javis-dev commits, /javis-dev prs, /javis-dev team
---

# /dev - 개발자 대시보드

개발자별 작업 현황, 커밋/PR 활동, 스프린트 기여도를 조회합니다.

## 데이터 소스

| 정보 | 테이블 |
|------|--------|
| 팀원 정보 | `team_members` |
| 멤버 통계 | `member_stats` |
| 할당 이슈 | `jira_issues` (assignee) |
| 커밋 | `bitbucket_commits` (author_name/author_email) |
| PR | `bitbucket_pullrequests` (author_name) |
| Vision 역할 | `roadmap_vision_members` |

**DB 연결**: localhost:5439, javis_brain, user: javis

---

## 명령어

### `/dev` 또는 `/dev me`
내 작업 현황 대시보드 (현재 사용자 기준)

**참고:** 현재 사용자는 `JIRA_EMAIL` 또는 `Gerald Park`으로 식별

**출력 정보:**
- 현재 스프린트 할당 이슈
- 최근 커밋 활동 (7일)
- 오픈 PR
- 스프린트 기여 통계

**실행:**
```bash
# 내 할당 이슈 (현재 스프린트)
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
WHERE ji.raw_data->'fields'->'assignee'->>'displayName' ILIKE '%Gerald%'
ORDER BY
    CASE ji.status
        WHEN 'In Progress' THEN 1
        WHEN 'To Do' THEN 2
        WHEN 'Done' THEN 3
        ELSE 4
    END;
"

# 최근 7일 커밋
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    bc.committed_at::date as date,
    br.slug as repo,
    LEFT(bc.message, 50) as message,
    bc.jira_keys
FROM bitbucket_commits bc
JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
WHERE bc.author_name ILIKE '%Gerald%'
  AND bc.committed_at > NOW() - INTERVAL '7 days'
ORDER BY bc.committed_at DESC
LIMIT 10;
"

# 내 오픈 PR
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    bp.pr_number,
    br.slug as repo,
    LEFT(bp.title, 40) as title,
    bp.source_branch,
    bp.created_at::date
FROM bitbucket_pullrequests bp
JOIN bitbucket_repositories br ON br.uuid = bp.repo_uuid
WHERE bp.author_name ILIKE '%Gerald%'
  AND bp.state = 'OPEN'
ORDER BY bp.created_at DESC;
"
```

---

### `/dev <name>`
특정 개발자 대시보드

**실행:**
```bash
# 개발자 정보
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT display_name, email, role, team, skills
FROM team_members
WHERE display_name ILIKE '%{name}%' AND is_active = true;
"

# Vision 역할
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT v.title as vision, vm.role_title, vm.role_category, vm.mm_allocation
FROM roadmap_vision_members vm
JOIN roadmap_visions v ON v.id = vm.vision_id
JOIN team_members tm ON tm.account_id = vm.member_account_id
WHERE tm.display_name ILIKE '%{name}%';
"

# 현재 스프린트 할당 이슈
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH active_sprint AS (
    SELECT id FROM jira_sprints WHERE state = 'active' LIMIT 1
)
SELECT
    ji.key,
    ji.summary,
    ji.status,
    (ji.raw_data->'fields'->>'customfield_10016')::numeric as points
FROM jira_issue_sprints jis
JOIN jira_issues ji ON ji.key = jis.issue_key
JOIN active_sprint a ON a.id = jis.sprint_id
WHERE ji.raw_data->'fields'->'assignee'->>'displayName' ILIKE '%{name}%'
ORDER BY ji.status;
"

# 최근 커밋 (7일)
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    bc.committed_at::date as date,
    br.slug as repo,
    LEFT(bc.message, 40) as message
FROM bitbucket_commits bc
JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
WHERE bc.author_name ILIKE '%{name}%'
  AND bc.committed_at > NOW() - INTERVAL '7 days'
ORDER BY bc.committed_at DESC
LIMIT 10;
"
```

---

### `/dev commits [--days N] [--name <name>]`
커밋 활동 분석 (기본 7일)

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    bc.author_name,
    COUNT(*) as commits,
    COUNT(DISTINCT br.slug) as repos,
    COUNT(DISTINCT bc.committed_at::date) as active_days,
    COUNT(DISTINCT UNNEST(bc.jira_keys)) FILTER (WHERE bc.jira_keys IS NOT NULL) as issues_touched
FROM bitbucket_commits bc
JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
WHERE bc.committed_at > NOW() - INTERVAL '{days} days'
GROUP BY bc.author_name
ORDER BY commits DESC
LIMIT 15;
"
```

**개인 커밋 상세:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    bc.committed_at::date as date,
    br.slug as repo,
    LEFT(bc.message, 50) as message,
    bc.jira_keys
FROM bitbucket_commits bc
JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
WHERE bc.author_name ILIKE '%{name}%'
  AND bc.committed_at > NOW() - INTERVAL '{days} days'
ORDER BY bc.committed_at DESC;
"
```

---

### `/dev prs [--state OPEN|MERGED] [--name <name>]`
PR 활동 분석

**실행:**
```bash
# 전체 PR 현황 (오픈)
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    bp.author_name,
    COUNT(*) as prs,
    COUNT(DISTINCT br.slug) as repos
FROM bitbucket_pullrequests bp
JOIN bitbucket_repositories br ON br.uuid = bp.repo_uuid
WHERE bp.state = 'OPEN'
GROUP BY bp.author_name
ORDER BY prs DESC;
"

# 개인 PR 목록
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

---

### `/dev team`
팀 전체 현황 비교

**출력 정보:**
- 팀원별 현재 스프린트 할당량
- 팀원별 완료율
- 팀원별 커밋 활동 (7일)

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
    SELECT
        bc.author_name as member,
        COUNT(*) as commits_7d
    FROM bitbucket_commits bc
    WHERE bc.committed_at > NOW() - INTERVAL '7 days'
    GROUP BY bc.author_name
)
SELECT
    s.member,
    s.assigned,
    s.done,
    s.in_progress,
    s.assigned - s.done - s.in_progress as todo,
    ROUND(s.done::numeric / NULLIF(s.assigned, 0) * 100, 0) as completion_pct,
    s.points,
    COALESCE(c.commits_7d, 0) as commits_7d
FROM member_sprint_stats s
LEFT JOIN member_commits c ON LOWER(c.member) LIKE '%' || LOWER(SPLIT_PART(s.member, ' ', 1)) || '%'
WHERE s.member != 'Unassigned'
ORDER BY s.assigned DESC;
"
```

---

### `/dev stats <name>`
개발자 통계 (히스토리 기반)

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

---

### `/dev workload`
팀 작업 부하 분석

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

---

## Bitbucket 연동 상세

### 이슈별 커밋 연결
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

---

## 워크플로우 예시

### 1. 아침 내 작업 확인
```
/dev                         # 내 대시보드
/dev me                      # 동일
```

### 2. 팀원 상황 파악
```
/dev Tushar                  # 특정 팀원 현황
/dev team                    # 팀 전체 비교
```

### 3. 코드 리뷰 대상 파악
```
/dev prs --state OPEN        # 오픈된 PR 목록
/dev prs --name Gerald       # 내 PR 확인
```

### 4. 주간 활동 리뷰
```
/dev commits --days 7        # 7일간 커밋 활동
/dev stats Gerald            # 내 통계 추이
```

### 5. 작업 분배 시
```
/dev workload                # 팀원별 작업 부하
/dev team                    # 스프린트 할당 비교
```
