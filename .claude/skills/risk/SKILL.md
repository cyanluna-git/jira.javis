---
name: risk
description: 프로젝트 리스크 감지 및 관리. 자동 감지, 리스크 목록, 분석, 해결. 사용법: /risk, /risk detect, /risk list, /risk analyze, /risk resolve
---

# /risk - 프로젝트 리스크 관리

프로젝트 리스크를 자동 감지하고 관리합니다.

## 리스크 유형

| Type | 설명 | 감지 기준 |
|------|------|----------|
| `delay` | 일정 지연 | 스프린트 종료 임박 + 낮은 완료율 |
| `blocker` | 블로커 이슈 | Blocker priority 이슈 존재 |
| `velocity_drop` | Velocity 하락 | 이전 평균 대비 20% 이상 하락 |
| `dependency_block` | 의존성 차단 | 링크된 이슈가 미완료 |
| `resource_conflict` | 리소스 충돌 | 한 명에게 과다 할당 |
| `scope_creep` | 스코프 증가 | 스프린트 중 이슈 추가 |
| `stale_issue` | 방치된 이슈 | In Progress 14일 이상 |

## 데이터 소스

| 정보 | 테이블 |
|------|--------|
| 리스크 | `roadmap_risks` |
| 스프린트 | `jira_sprints`, `jira_issue_sprints` |
| 이슈 | `jira_issues` |
| Epic/Milestone | `roadmap_milestones`, `roadmap_epic_links` |

**DB 연결**: localhost:5439, javis_brain, user: javis

---

## 명령어

### `/risk` 또는 `/risk summary`
현재 오픈된 리스크 요약

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    risk_type,
    severity,
    COUNT(*) as count
FROM roadmap_risks
WHERE status = 'open'
GROUP BY risk_type, severity
ORDER BY
    CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
    count DESC;
"
```

---

### `/risk detect`
자동 리스크 감지 실행

**감지 로직:**

#### 1. 스프린트 지연 리스크 (delay)
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
-- 현재 스프린트: 남은 기간 대비 완료율 낮음
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
    ROUND((1 - a.days_left::numeric / NULLIF(a.total_days, 0)) * 100, 0) as time_elapsed_pct,
    CASE
        WHEN a.days_left <= 3 AND sp.done::numeric / NULLIF(sp.total, 0) < 0.5 THEN 'CRITICAL'
        WHEN a.days_left <= 5 AND sp.done::numeric / NULLIF(sp.total, 0) < 0.6 THEN 'HIGH'
        WHEN sp.done::numeric / NULLIF(sp.total, 0) < (1 - a.days_left::numeric / NULLIF(a.total_days, 0)) - 0.2 THEN 'MEDIUM'
        ELSE 'OK'
    END as risk_level
FROM active_sprint a, sprint_progress sp;
"
```

#### 2. 블로커 리스크 (blocker)
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    ji.key, ji.summary, ji.status,
    ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
    'CRITICAL' as risk_level
FROM jira_issues ji
WHERE ji.raw_data->'fields'->'priority'->>'name' IN ('Highest', 'Blocker')
  AND ji.status NOT IN ('Done', 'Closed', 'Resolved')
ORDER BY ji.updated_at DESC;
"
```

#### 3. Velocity 하락 리스크 (velocity_drop)
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

#### 4. 리소스 충돌 리스크 (resource_conflict)
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

#### 5. 방치된 이슈 리스크 (stale_issue)
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

---

### `/risk list [--type TYPE] [--severity SEVERITY]`
리스크 목록 조회

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT
    id,
    risk_type,
    severity,
    title,
    status,
    detected_at::date,
    epic_key,
    ai_suggestion
FROM roadmap_risks
WHERE status = 'open'
  AND ('{type}' = '' OR risk_type = '{type}')
  AND ('{severity}' = '' OR severity = '{severity}')
ORDER BY
    CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
    detected_at DESC;
"
```

---

### `/risk analyze <epic_key|sprint_name>`
특정 Epic 또는 스프린트의 리스크 분석

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
-- Epic 분석
WITH epic_issues AS (
    SELECT
        ji.key, ji.summary, ji.status,
        ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
        ji.raw_data->'fields'->'priority'->>'name' as priority,
        ji.updated_at
    FROM jira_issues ji
    WHERE ji.key = '{target}' OR ji.raw_data->'fields'->'parent'->>'key' = '{target}'
)
SELECT
    COUNT(*) as total_issues,
    COUNT(CASE WHEN status = 'Done' THEN 1 END) as done,
    COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
    COUNT(CASE WHEN priority IN ('Highest', 'Blocker') AND status != 'Done' THEN 1 END) as blockers,
    COUNT(CASE WHEN updated_at < NOW() - INTERVAL '14 days' AND status = 'In Progress' THEN 1 END) as stale,
    COUNT(DISTINCT assignee) as team_size
FROM epic_issues;
"
```

**AI 분석 포인트:**
- 완료율 vs 일정
- 블로커 존재 여부
- 리소스 분배 균형
- 의존성 체인

---

### `/risk create`
수동 리스크 등록

**필요 정보:**
- `risk_type`: delay, blocker, velocity_drop, dependency_block, resource_conflict, scope_creep, stale_issue, custom
- `severity`: critical, high, medium, low
- `title`: 리스크 제목
- `description`: 상세 설명
- `epic_key` (optional): 관련 Epic

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
INSERT INTO roadmap_risks (risk_type, severity, title, description, epic_key, status)
VALUES ('{type}', '{severity}', '{title}', '{description}', '{epic_key}', 'open')
RETURNING id, title;
"
```

---

### `/risk resolve <risk_id>`
리스크 해결 처리

**실행:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
UPDATE roadmap_risks
SET status = 'resolved',
    resolved_at = NOW(),
    resolution_note = '{note}'
WHERE id = '{risk_id}'
RETURNING id, title, status;
"
```

---

### `/risk report`
리스크 현황 리포트 생성

**출력 포맷:**
```markdown
# Risk Report

## Summary
- Total Open Risks: X
- Critical: X | High: X | Medium: X | Low: X

## By Type
| Type | Count | Critical | High |
|------|-------|----------|------|

## Top Risks
1. [CRITICAL] [title] - [epic_key]
2. [HIGH] [title] - [description]

## Recommendations
- [AI suggestions based on detected risks]
```

---

## 자동 감지 기준

### Severity 판정

| Severity | 기준 |
|----------|------|
| `critical` | 릴리즈/마일스톤 직접 영향, 즉시 대응 필요 |
| `high` | 스프린트 목표 영향, 이번 주 내 대응 필요 |
| `medium` | 잠재적 영향, 모니터링 필요 |
| `low` | 낮은 영향, 인지만 필요 |

### 자동 감지 주기
- `/risk detect` 실행 시 전체 스캔
- 권장: 데일리 스탠드업 전 실행

---

## 워크플로우 예시

### 1. 데일리 리스크 체크
```
/risk detect                  # 자동 감지 실행
/risk                         # 요약 확인
```

### 2. 스프린트 리스크 분석
```
/risk analyze "Sprint14"      # 스프린트 분석
/risk list --severity high    # High 이상 리스크
```

### 3. Epic 리스크 분석
```
/risk analyze EUV-3299        # Epic 분석
```

### 4. 리스크 해결
```
/risk resolve <id>            # 리스크 해결 처리
```

### 5. 주간 리스크 리포트
```
/risk report                  # 전체 현황 리포트
```
