---
name: report
description: 프로젝트 리포트 생성. 스프린트 리포트, 팀 성과, 프로젝트 현황, Epic 진행률. 사용법: /report sprint, /report team, /report project, /report epic, /report weekly
---

# /report - 프로젝트 리포트 생성

스프린트, 팀, 프로젝트 현황에 대한 리포트를 생성합니다.

## 데이터 소스

| 정보 | 테이블 |
|------|--------|
| 스프린트 | `jira_sprints`, `jira_issue_sprints` |
| 이슈 | `jira_issues` |
| 팀원 | `team_members`, `member_stats` |
| Epic/Vision | `roadmap_visions`, `roadmap_milestones`, `roadmap_epic_links` |
| 커밋/PR | `bitbucket_commits`, `bitbucket_pullrequests` |

**DB 연결**: localhost:5439, javis_brain, user: javis

---

## 명령어

### `/report sprint [sprint_name]`
스프린트 리포트 (기본: 현재 스프린트)

**출력 포맷 (마크다운):**
```markdown
# Sprint Report: [Sprint Name]

## Summary
- Period: [start_date] ~ [end_date]
- Status: [active/closed]
- Completion: [done]/[total] ([pct]%)

## Issue Breakdown
| Status | Count |
|--------|-------|
| Done | X |
| In Progress | X |
| To Do | X |

## By Assignee
| Member | Done | In Progress | To Do |
|--------|------|-------------|-------|

## Highlights
- [완료된 주요 이슈]

## Blockers/Risks
- [미완료 High Priority 이슈]
```

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH target_sprint AS (
    SELECT id, name, state, start_date, end_date, goal
    FROM jira_sprints
    WHERE state = 'active' OR name ILIKE '%{sprint_name}%'
    ORDER BY CASE WHEN state = 'active' THEN 0 ELSE 1 END, start_date DESC
    LIMIT 1
),
sprint_issues AS (
    SELECT
        ji.key, ji.summary, ji.status,
        ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
        ji.raw_data->'fields'->'priority'->>'name' as priority,
        ji.raw_data->'fields'->'issuetype'->>'name' as type
    FROM jira_issue_sprints jis
    JOIN jira_issues ji ON ji.key = jis.issue_key
    JOIN target_sprint ts ON ts.id = jis.sprint_id
)
SELECT
    (SELECT name FROM target_sprint) as sprint,
    (SELECT state FROM target_sprint) as state,
    (SELECT start_date::date FROM target_sprint) as start_date,
    (SELECT end_date::date FROM target_sprint) as end_date,
    (SELECT goal FROM target_sprint) as goal,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'Done' THEN 1 END) as done,
    COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
    COUNT(CASE WHEN status = 'To Do' THEN 1 END) as todo,
    ROUND(COUNT(CASE WHEN status = 'Done' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as completion_pct
FROM sprint_issues;
"

-- 담당자별 현황
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH target_sprint AS (
    SELECT id FROM jira_sprints
    WHERE state = 'active' OR name ILIKE '%{sprint_name}%'
    ORDER BY CASE WHEN state = 'active' THEN 0 ELSE 1 END, start_date DESC
    LIMIT 1
)
SELECT
    COALESCE(ji.raw_data->'fields'->'assignee'->>'displayName', 'Unassigned') as assignee,
    COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
    COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress,
    COUNT(CASE WHEN ji.status NOT IN ('Done', 'In Progress') THEN 1 END) as other
FROM jira_issue_sprints jis
JOIN jira_issues ji ON ji.key = jis.issue_key
JOIN target_sprint ts ON ts.id = jis.sprint_id
GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
ORDER BY done DESC, in_progress DESC;
"

-- 완료된 주요 이슈
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH target_sprint AS (
    SELECT id FROM jira_sprints
    WHERE state = 'active' OR name ILIKE '%{sprint_name}%'
    ORDER BY CASE WHEN state = 'active' THEN 0 ELSE 1 END, start_date DESC
    LIMIT 1
)
SELECT ji.key, ji.summary
FROM jira_issue_sprints jis
JOIN jira_issues ji ON ji.key = jis.issue_key
JOIN target_sprint ts ON ts.id = jis.sprint_id
WHERE ji.status = 'Done'
ORDER BY ji.updated_at DESC
LIMIT 10;
"
```

---

### `/report team [--sprint <name>]`
팀 성과 리포트

**출력 포맷:**
```markdown
# Team Performance Report

## Sprint: [name]

## Individual Performance
| Member | Issues Done | Points | Commits (7d) | PRs |
|--------|-------------|--------|--------------|-----|

## Team Velocity
- Current Sprint: X issues / Y points
- Average (last 6): X issues / Y points

## Top Contributors
1. [name] - X issues completed
2. ...
```

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH active_sprint AS (
    SELECT id, name FROM jira_sprints WHERE state = 'active' LIMIT 1
),
member_issues AS (
    SELECT
        COALESCE(ji.raw_data->'fields'->'assignee'->>'displayName', 'Unassigned') as member,
        COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
        COUNT(*) as assigned,
        COALESCE(SUM(CASE WHEN ji.status = 'Done'
            THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as points_done
    FROM jira_issue_sprints jis
    JOIN jira_issues ji ON ji.key = jis.issue_key
    JOIN active_sprint a ON a.id = jis.sprint_id
    GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
),
member_commits AS (
    SELECT author_name, COUNT(*) as commits
    FROM bitbucket_commits
    WHERE committed_at > NOW() - INTERVAL '7 days'
    GROUP BY author_name
),
member_prs AS (
    SELECT author_name, COUNT(*) as prs
    FROM bitbucket_pullrequests
    WHERE created_at > NOW() - INTERVAL '14 days'
    GROUP BY author_name
)
SELECT
    mi.member,
    mi.done,
    mi.assigned,
    mi.points_done,
    COALESCE(mc.commits, 0) as commits_7d,
    COALESCE(mp.prs, 0) as prs_14d
FROM member_issues mi
LEFT JOIN member_commits mc ON LOWER(mc.author_name) LIKE '%' || LOWER(SPLIT_PART(mi.member, ' ', 1)) || '%'
LEFT JOIN member_prs mp ON LOWER(mp.author_name) LIKE '%' || LOWER(SPLIT_PART(mi.member, ' ', 1)) || '%'
WHERE mi.member != 'Unassigned'
ORDER BY mi.done DESC, mi.assigned DESC;
"
```

---

### `/report project [project_key]`
프로젝트 전체 현황 리포트

**출력 포맷:**
```markdown
# Project Status Report: [Project]

## Overview
- Total Issues: X
- Open: X | In Progress: X | Done: X

## By Epic
| Epic | Total | Done | Progress |
|------|-------|------|----------|

## Recent Activity (7 days)
- Issues Created: X
- Issues Resolved: X
- Commits: X
- PRs Merged: X

## Upcoming
- Next Sprint: [name] ([date])
- Backlog Size: X issues
```

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
-- 프로젝트 전체 현황
SELECT
    project,
    COUNT(*) as total,
    COUNT(CASE WHEN status IN ('To Do', 'Backlog', 'Refined') THEN 1 END) as open,
    COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
    COUNT(CASE WHEN status = 'Done' THEN 1 END) as done,
    ROUND(COUNT(CASE WHEN status = 'Done' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as done_pct
FROM jira_issues
WHERE project = '{project_key}'
GROUP BY project;
"

-- Epic별 현황
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    e.key as epic_key,
    e.summary as epic,
    COUNT(s.key) as total,
    COUNT(CASE WHEN s.status = 'Done' THEN 1 END) as done,
    ROUND(COUNT(CASE WHEN s.status = 'Done' THEN 1 END)::numeric / NULLIF(COUNT(s.key), 0) * 100, 0) as pct
FROM jira_issues e
LEFT JOIN jira_issues s ON s.raw_data->'fields'->'parent'->>'key' = e.key
WHERE e.project = '{project_key}'
  AND e.raw_data->'fields'->'issuetype'->>'name' = 'Epic'
GROUP BY e.key, e.summary
HAVING COUNT(s.key) > 0
ORDER BY pct DESC;
"

-- 최근 7일 활동
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    (SELECT COUNT(*) FROM jira_issues WHERE project = '{project_key}' AND created_at > NOW() - INTERVAL '7 days') as created_7d,
    (SELECT COUNT(*) FROM jira_issues WHERE project = '{project_key}' AND status = 'Done' AND updated_at > NOW() - INTERVAL '7 days') as resolved_7d,
    (SELECT COUNT(*) FROM bitbucket_commits WHERE committed_at > NOW() - INTERVAL '7 days') as commits_7d,
    (SELECT COUNT(*) FROM bitbucket_pullrequests WHERE state = 'MERGED' AND updated_at > NOW() - INTERVAL '7 days') as prs_merged_7d;
"
```

---

### `/report epic <epic_key>`
Epic 상세 리포트

**출력 포맷:**
```markdown
# Epic Report: [Epic Key]

## Summary
- Title: [summary]
- Status: [status]
- Component: [component]

## Progress
- Stories: [done]/[total] ([pct]%)
- Story Points: [done_pts]/[total_pts]

## Stories
| Key | Summary | Status | Assignee | Points |
|-----|---------|--------|----------|--------|

## Development Activity
- Commits: X (last 7 days)
- Open PRs: X
- Contributors: [names]

## Timeline
- Created: [date]
- Last Updated: [date]
```

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
-- Epic 정보
SELECT
    key, summary, status,
    raw_data->'fields'->'components'->0->>'name' as component,
    created_at::date, updated_at::date
FROM jira_issues WHERE key = '{epic_key}';

-- Story 현황
SELECT
    key, summary, status,
    raw_data->'fields'->'assignee'->>'displayName' as assignee,
    (raw_data->'fields'->>'customfield_10016')::numeric as points
FROM jira_issues
WHERE raw_data->'fields'->'parent'->>'key' = '{epic_key}'
ORDER BY CASE status WHEN 'Done' THEN 3 WHEN 'In Progress' THEN 1 ELSE 2 END, key;

-- 진행률
SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'Done' THEN 1 END) as done,
    ROUND(COUNT(CASE WHEN status = 'Done' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 0) as pct,
    COALESCE(SUM((raw_data->'fields'->>'customfield_10016')::numeric), 0) as total_pts,
    COALESCE(SUM(CASE WHEN status = 'Done' THEN (raw_data->'fields'->>'customfield_10016')::numeric END), 0) as done_pts
FROM jira_issues
WHERE raw_data->'fields'->'parent'->>'key' = '{epic_key}';
"

-- Bitbucket 활동
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH epic_keys AS (
    SELECT key FROM jira_issues
    WHERE key = '{epic_key}' OR raw_data->'fields'->'parent'->>'key' = '{epic_key}'
)
SELECT
    COUNT(DISTINCT bc.hash) as commits_7d,
    COUNT(DISTINCT CASE WHEN bp.state = 'OPEN' THEN bp.id END) as open_prs,
    STRING_AGG(DISTINCT bc.author_name, ', ') as contributors
FROM epic_keys ek
LEFT JOIN bitbucket_commits bc ON ek.key = ANY(bc.jira_keys) AND bc.committed_at > NOW() - INTERVAL '7 days'
LEFT JOIN bitbucket_pullrequests bp ON ek.key = ANY(bp.jira_keys);
"
```

---

### `/report weekly [--date YYYY-MM-DD]`
주간 리포트 (기본: 이번 주)

**출력 포맷:**
```markdown
# Weekly Report: [Week of date]

## Sprint Progress
- Sprint: [name]
- Week Start: X done / Y total
- Week End: X done / Y total
- Progress This Week: +X issues

## Completed This Week
| Key | Summary | Assignee |
|-----|---------|----------|

## Development Activity
- Commits: X
- PRs Opened: X
- PRs Merged: X

## Team Highlights
- Top contributor: [name] (X issues)
- Most commits: [name] (X commits)

## Next Week Focus
- [Remaining high priority items]
```

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
-- 이번 주 완료된 이슈
SELECT
    ji.key, ji.summary,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    ji.updated_at::date as completed_date
FROM jira_issues ji
WHERE ji.status = 'Done'
  AND ji.updated_at > NOW() - INTERVAL '7 days'
ORDER BY ji.updated_at DESC;
"

-- 이번 주 개발 활동
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    (SELECT COUNT(*) FROM bitbucket_commits WHERE committed_at > NOW() - INTERVAL '7 days') as commits,
    (SELECT COUNT(*) FROM bitbucket_pullrequests WHERE state = 'OPEN' AND created_at > NOW() - INTERVAL '7 days') as prs_opened,
    (SELECT COUNT(*) FROM bitbucket_pullrequests WHERE state = 'MERGED' AND updated_at > NOW() - INTERVAL '7 days') as prs_merged;
"

-- Top Contributors
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    ji.raw_data->'fields'->'assignee'->>'displayName' as member,
    COUNT(*) as issues_completed
FROM jira_issues ji
WHERE ji.status = 'Done'
  AND ji.updated_at > NOW() - INTERVAL '7 days'
GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
ORDER BY issues_completed DESC
LIMIT 5;
"
```

---

### `/report velocity`
Velocity 추이 리포트

**출력 포맷:**
```markdown
# Velocity Report

## Last 6 Sprints
| Sprint | Committed | Done | Completion % | Points |
|--------|-----------|------|--------------|--------|

## Trends
- Average Velocity: X issues / Y points per sprint
- Trend: [increasing/stable/decreasing]
- Predictability: [high/medium/low]

## Recommendations
- Recommended commitment for next sprint: X-Y issues
```

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH sprint_stats AS (
    SELECT
        s.name,
        s.start_date,
        COUNT(*) as committed,
        COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
        COALESCE(SUM(CASE WHEN ji.status = 'Done'
            THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as points_done
    FROM jira_sprints s
    JOIN jira_issue_sprints jis ON jis.sprint_id = s.id
    JOIN jira_issues ji ON ji.key = jis.issue_key
    WHERE s.state = 'closed'
    GROUP BY s.id, s.name, s.start_date
    ORDER BY s.start_date DESC
    LIMIT 6
)
SELECT
    name,
    committed,
    done,
    ROUND(done::numeric / NULLIF(committed, 0) * 100, 0) as completion_pct,
    points_done
FROM sprint_stats
ORDER BY start_date;
"

-- 평균 및 추천
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH sprint_stats AS (
    SELECT
        COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
        COALESCE(SUM(CASE WHEN ji.status = 'Done'
            THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as points
    FROM jira_sprints s
    JOIN jira_issue_sprints jis ON jis.sprint_id = s.id
    JOIN jira_issues ji ON ji.key = jis.issue_key
    WHERE s.state = 'closed'
    GROUP BY s.id
    ORDER BY s.start_date DESC
    LIMIT 6
)
SELECT
    ROUND(AVG(done), 1) as avg_issues,
    ROUND(AVG(points), 1) as avg_points,
    MIN(done) as min_issues,
    MAX(done) as max_issues,
    ROUND(STDDEV(done), 1) as stddev
FROM sprint_stats;
"
```

---

### `/report vision [vision_title]`
Vision 진행 현황 리포트

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
-- Vision 정보
SELECT
    v.title, v.description, v.status,
    v.north_star_metric, v.north_star_target, v.north_star_current,
    COUNT(m.id) as milestones,
    ROUND(AVG(m.progress_percent), 0) as avg_progress
FROM roadmap_visions v
LEFT JOIN roadmap_milestones m ON m.vision_id = v.id
WHERE v.title ILIKE '%{vision_title}%'
GROUP BY v.id;

-- Milestone 현황
SELECT
    m.title, m.quarter, m.status, m.progress_percent,
    COUNT(el.epic_key) as epics
FROM roadmap_milestones m
JOIN roadmap_visions v ON v.id = m.vision_id
LEFT JOIN roadmap_epic_links el ON el.milestone_id = m.id
WHERE v.title ILIKE '%{vision_title}%'
GROUP BY m.id
ORDER BY m.quarter;

-- Epic 현황
SELECT
    el.epic_key, ji.summary, ji.status,
    COUNT(s.key) as stories,
    COUNT(CASE WHEN s.status = 'Done' THEN 1 END) as done
FROM roadmap_epic_links el
JOIN roadmap_milestones m ON m.id = el.milestone_id
JOIN roadmap_visions v ON v.id = m.vision_id
JOIN jira_issues ji ON ji.key = el.epic_key
LEFT JOIN jira_issues s ON s.raw_data->'fields'->'parent'->>'key' = el.epic_key
WHERE v.title ILIKE '%{vision_title}%'
GROUP BY el.epic_key, ji.summary, ji.status
ORDER BY el.epic_key;
"
```

---

## 리포트 출력 형식

모든 리포트는 **마크다운 형식**으로 생성됩니다:
- 제목: `# Report Title`
- 섹션: `## Section`
- 테이블: `| Col | Col |`
- 리스트: `- item`

**AI가 쿼리 결과를 기반으로 마크다운 리포트 문서를 작성합니다.**

---

## 워크플로우 예시

### 1. 데일리 스탠드업
```
/report sprint
```

### 2. 스프린트 회고
```
/report sprint "Scaled Sprint13"
/report velocity
```

### 3. 주간 보고
```
/report weekly
/report team
```

### 4. 프로젝트 현황 공유
```
/report project EUV
/report vision OQC
```

### 5. Epic 진행 확인
```
/report epic EUV-3299
```
