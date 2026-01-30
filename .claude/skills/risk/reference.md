# Risk Reference - 감지 로직 및 기준

## 리스크 유형 상세

| Type | 설명 | 감지 기준 |
|------|------|----------|
| `delay` | 일정 지연 | 스프린트 종료 임박 + 낮은 완료율 |
| `blocker` | 블로커 이슈 | Blocker priority 이슈 존재 |
| `velocity_drop` | Velocity 하락 | 이전 평균 대비 20% 이상 하락 |
| `dependency_block` | 의존성 차단 | 링크된 이슈가 미완료 |
| `resource_conflict` | 리소스 충돌 | 한 명에게 과다 할당 |
| `scope_creep` | 스코프 증가 | 스프린트 중 이슈 추가 |
| `stale_issue` | 방치된 이슈 | In Progress 14일 이상 |

## Severity 판정

| Severity | 기준 |
|----------|------|
| `critical` | 릴리즈/마일스톤 직접 영향, 즉시 대응 필요 |
| `high` | 스프린트 목표 영향, 이번 주 내 대응 필요 |
| `medium` | 잠재적 영향, 모니터링 필요 |
| `low` | 낮은 영향, 인지만 필요 |

## 감지 쿼리

### 1. 스프린트 지연 리스크 (delay)

```sql
WITH active_sprint AS (
    SELECT id, name, start_date, end_date,
           EXTRACT(DAY FROM end_date - NOW()) as days_left,
           EXTRACT(DAY FROM end_date - start_date) as total_days
    FROM jira_sprints WHERE state = 'active' LIMIT 1
),
sprint_progress AS (
    SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done
    FROM jira_issue_sprints jis
    JOIN jira_issues ji ON ji.key = jis.issue_key
    JOIN active_sprint a ON a.id = jis.sprint_id
)
SELECT
    a.name as sprint,
    a.days_left,
    sp.done, sp.total,
    ROUND(sp.done::numeric / NULLIF(sp.total, 0) * 100, 0) as completion_pct,
    CASE
        WHEN a.days_left <= 3 AND sp.done::numeric / NULLIF(sp.total, 0) < 0.5 THEN 'CRITICAL'
        WHEN a.days_left <= 5 AND sp.done::numeric / NULLIF(sp.total, 0) < 0.6 THEN 'HIGH'
        WHEN sp.done::numeric / NULLIF(sp.total, 0) < (1 - a.days_left::numeric / NULLIF(a.total_days, 0)) - 0.2 THEN 'MEDIUM'
        ELSE 'OK'
    END as risk_level
FROM active_sprint a, sprint_progress sp;
```

### 2. 블로커 리스크 (blocker)

```sql
SELECT
    ji.key, ji.summary, ji.status,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    'CRITICAL' as risk_level
FROM jira_issues ji
WHERE ji.raw_data->'fields'->'priority'->>'name' IN ('Highest', 'Blocker')
  AND ji.status NOT IN ('Done', 'Closed', 'Resolved')
ORDER BY ji.updated_at DESC;
```

### 3. Velocity 하락 리스크 (velocity_drop)

```sql
WITH sprint_velocity AS (
    SELECT
        s.name,
        s.start_date,
        COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done
    FROM jira_sprints s
    JOIN jira_issue_sprints jis ON jis.sprint_id = s.id
    JOIN jira_issues ji ON ji.key = jis.issue_key
    WHERE s.state = 'closed'
    GROUP BY s.id, s.name, s.start_date
    ORDER BY s.start_date DESC
    LIMIT 6
),
velocity_stats AS (
    SELECT
        AVG(done) as avg_velocity,
        (SELECT done FROM sprint_velocity ORDER BY start_date DESC LIMIT 1) as last_velocity
    FROM sprint_velocity
)
SELECT
    avg_velocity,
    last_velocity,
    ROUND((avg_velocity - last_velocity) / NULLIF(avg_velocity, 0) * 100, 0) as drop_pct,
    CASE
        WHEN last_velocity < avg_velocity * 0.7 THEN 'HIGH'
        WHEN last_velocity < avg_velocity * 0.8 THEN 'MEDIUM'
        ELSE 'OK'
    END as risk_level
FROM velocity_stats;
```

### 4. 리소스 충돌 리스크 (resource_conflict)

```sql
WITH active_sprint AS (
    SELECT id FROM jira_sprints WHERE state = 'active' LIMIT 1
),
member_load AS (
    SELECT
        ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
        COUNT(*) as assigned,
        COUNT(CASE WHEN ji.status NOT IN ('Done', 'Closed') THEN 1 END) as open_issues
    FROM jira_issue_sprints jis
    JOIN jira_issues ji ON ji.key = jis.issue_key
    JOIN active_sprint a ON a.id = jis.sprint_id
    GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
)
SELECT
    assignee,
    assigned,
    open_issues,
    CASE
        WHEN open_issues > 8 THEN 'HIGH'
        WHEN open_issues > 6 THEN 'MEDIUM'
        ELSE 'OK'
    END as risk_level
FROM member_load
WHERE assignee IS NOT NULL
ORDER BY open_issues DESC;
```

### 5. 방치된 이슈 리스크 (stale_issue)

```sql
SELECT
    ji.key, ji.summary,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    ji.updated_at::date as last_update,
    EXTRACT(DAY FROM NOW() - ji.updated_at) as days_stale,
    CASE
        WHEN EXTRACT(DAY FROM NOW() - ji.updated_at) > 21 THEN 'HIGH'
        WHEN EXTRACT(DAY FROM NOW() - ji.updated_at) > 14 THEN 'MEDIUM'
        ELSE 'LOW'
    END as risk_level
FROM jira_issues ji
WHERE ji.status = 'In Progress'
  AND ji.updated_at < NOW() - INTERVAL '14 days'
ORDER BY ji.updated_at;
```

## 데이터베이스 스키마

```sql
-- 리스크 테이블
roadmap_risks (
    id SERIAL PRIMARY KEY,
    risk_type VARCHAR(50),      -- delay, blocker, velocity_drop, etc.
    severity VARCHAR(20),        -- critical, high, medium, low
    title VARCHAR(255),
    description TEXT,
    epic_key VARCHAR(20),
    status VARCHAR(20),          -- open, resolved, dismissed
    detected_at TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_note TEXT,
    ai_suggestion TEXT
);
```

## 리스크 관리 쿼리

### 리스크 생성

```sql
INSERT INTO roadmap_risks (risk_type, severity, title, description, epic_key, status)
VALUES ('{type}', '{severity}', '{title}', '{description}', '{epic_key}', 'open')
RETURNING id, title;
```

### 리스크 해결

```sql
UPDATE roadmap_risks
SET status = 'resolved',
    resolved_at = NOW(),
    resolution_note = '{note}'
WHERE id = '{risk_id}'
RETURNING id, title, status;
```
