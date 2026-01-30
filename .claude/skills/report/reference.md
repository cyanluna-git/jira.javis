# Report Reference - 상세 쿼리 및 리포트 포맷

## 리포트 포맷 템플릿

### Sprint Report

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

### Weekly Report

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

### Epic Report

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

## SQL 쿼리 모음

### 스프린트 리포트

```sql
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
        ji.raw_data->'fields'->'priority'->>'name' as priority
    FROM jira_issue_sprints jis
    JOIN jira_issues ji ON ji.key = jis.issue_key
    JOIN target_sprint ts ON ts.id = jis.sprint_id
)
SELECT
    (SELECT name FROM target_sprint) as sprint,
    (SELECT state FROM target_sprint) as state,
    (SELECT start_date::date FROM target_sprint) as start_date,
    (SELECT end_date::date FROM target_sprint) as end_date,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'Done' THEN 1 END) as done,
    COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
    COUNT(CASE WHEN status = 'To Do' THEN 1 END) as todo
FROM sprint_issues;
```

### 주간 리포트

```sql
-- 이번 주 완료된 이슈
SELECT
    ji.key, ji.summary,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    ji.updated_at::date as completed_date
FROM jira_issues ji
WHERE ji.status = 'Done'
  AND ji.updated_at > NOW() - INTERVAL '7 days'
ORDER BY ji.updated_at DESC;

-- 이번 주 개발 활동
SELECT
    (SELECT COUNT(*) FROM bitbucket_commits WHERE committed_at > NOW() - INTERVAL '7 days') as commits,
    (SELECT COUNT(*) FROM bitbucket_pullrequests WHERE state = 'OPEN' AND created_at > NOW() - INTERVAL '7 days') as prs_opened,
    (SELECT COUNT(*) FROM bitbucket_pullrequests WHERE state = 'MERGED' AND updated_at > NOW() - INTERVAL '7 days') as prs_merged;
```

### Epic 리포트

```sql
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
```

### Velocity 리포트

```sql
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
```

### Vision 리포트

```sql
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
```
